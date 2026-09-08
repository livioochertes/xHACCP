#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "@neondatabase/serverless";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_ALERT_COOLDOWN_MS = 60 * 60 * 1000;
const DEFAULT_STATE_FILE = path.resolve(".cache/wms-monitor-alerts.json");

export const WMS_CHECKS = [
  { name: "sandbox", envName: "WMS_SANDBOX_API_KEY", prefix: "wms_test_" },
  { name: "production", envName: "WMS_PRODUCTION_API_KEY", prefix: "wms_live_" },
];

function baseUrlFromEnv(env) {
  return (env.WMS_BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPaused(env) {
  return ["1", "true", "yes", "on"].includes(String(env.WMS_MONITOR_PAUSED || "").toLowerCase());
}

function safeStatus(status) {
  return Number.isInteger(status) ? status : null;
}

function failure(check, code, message, status = null) {
  return {
    check: check.name,
    code,
    message,
    status: safeStatus(status),
    fingerprint: `${check.name}:${code}:${safeStatus(status) || ""}`,
  };
}

function healthFailure(code, message, status = null) {
  return failure({ name: "health" }, code, message, status);
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    return {
      ok: false,
      status: null,
      monitorFailure: {
        code: aborted ? "timeout" : "network_error",
        message: aborted ? "request timed out" : "request could not be completed",
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function checkHealth({ baseUrl, fetchImpl, timeoutMs }) {
  const response = await fetchWithTimeout(
    fetchImpl,
    `${baseUrl}/api/wms/v1/health`,
    { headers: { "Cache-Control": "no-cache" } },
    timeoutMs,
  );
  if (response.monitorFailure) {
    return healthFailure(response.monitorFailure.code, response.monitorFailure.message);
  }
  if (!response.ok) {
    return healthFailure("http_error", `health endpoint returned HTTP ${response.status}`, response.status);
  }
  try {
    const body = await response.json();
    if (!body || body.ok !== true) {
      return healthFailure("unexpected_response", "health endpoint returned an unexpected response");
    }
  } catch {
    return healthFailure("unexpected_response", "health endpoint returned an unreadable response");
  }
  return null;
}

async function checkOrders({ baseUrl, fetchImpl, timeoutMs, check, key }) {
  const response = await fetchWithTimeout(
    fetchImpl,
    `${baseUrl}/api/wms/v1/orders?limit=1`,
    {
      headers: {
        Authorization: `Bearer ${key}`,
        "Cache-Control": "no-cache",
      },
    },
    timeoutMs,
  );
  if (response.monitorFailure) {
    return failure(check, response.monitorFailure.code, response.monitorFailure.message);
  }
  if (!response.ok) {
    return failure(check, "http_error", `${check.name} orders request returned HTTP ${response.status}`, response.status);
  }
  try {
    const body = await response.json();
    if (!body || !Array.isArray(body.data) || !body.pagination) {
      return failure(check, "unexpected_response", `${check.name} orders request returned an unexpected response`);
    }
  } catch {
    return failure(check, "unexpected_response", `${check.name} orders request returned an unreadable response`);
  }
  return null;
}

export class FileAlertStateStore {
  constructor(filePath = DEFAULT_STATE_FILE) {
    this.filePath = filePath;
  }

  async read() {
    try {
      return JSON.parse(await fs.readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") return {};
      throw error;
    }
  }

  async write(state) {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(temporaryPath, this.filePath);
  }

  async claimFailure(checkName, fingerprint, now, cooldownMs) {
    const state = await this.read();
    const current = state[checkName];
    const changed = !current || current.fingerprint !== fingerprint;
    const due = !current?.lastAlertedAt
      || now - Date.parse(current.lastAlertedAt) >= cooldownMs;
    const shouldAlert = changed || due;
    state[checkName] = {
      status: "failed",
      fingerprint,
      firstFailedAt: changed || !current?.firstFailedAt ? new Date(now).toISOString() : current.firstFailedAt,
      lastCheckedAt: new Date(now).toISOString(),
      lastAlertedAt: shouldAlert ? new Date(now).toISOString() : current.lastAlertedAt,
    };
    await this.write(state);
    return shouldAlert;
  }

  async markHealthy(checkName, now) {
    const state = await this.read();
    state[checkName] = {
      status: "healthy",
      lastCheckedAt: new Date(now).toISOString(),
    };
    await this.write(state);
  }

  async close() {}
}

export class PostgresAlertStateStore {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 10_000,
      max: 1,
    });
  }

  async claimFailure(checkName, fingerprint, now, cooldownMs) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [checkName]);
      const result = await client.query(
        `SELECT status, failure_fingerprint, last_alerted_at
           FROM wms_monitor_alerts
          WHERE check_name = $1
          FOR UPDATE`,
        [checkName],
      );
      const current = result.rows[0];
      const changed = !current || current.failure_fingerprint !== fingerprint;
      const due = !current?.last_alerted_at
        || now - new Date(current.last_alerted_at).getTime() >= cooldownMs;
      const shouldAlert = changed || due;
      await client.query(
        `INSERT INTO wms_monitor_alerts
          (check_name, status, failure_fingerprint, first_failed_at, last_checked_at, last_alerted_at, updated_at)
         VALUES ($1, 'failed', $2, $3, $3, $4, $3)
         ON CONFLICT (check_name) DO UPDATE SET
           status = 'failed',
           failure_fingerprint = EXCLUDED.failure_fingerprint,
           first_failed_at = CASE
             WHEN wms_monitor_alerts.failure_fingerprint IS DISTINCT FROM EXCLUDED.failure_fingerprint
               OR wms_monitor_alerts.first_failed_at IS NULL
             THEN EXCLUDED.first_failed_at
             ELSE wms_monitor_alerts.first_failed_at
           END,
           last_checked_at = EXCLUDED.last_checked_at,
           last_alerted_at = CASE
             WHEN $4::boolean THEN EXCLUDED.last_alerted_at
             ELSE wms_monitor_alerts.last_alerted_at
           END,
           updated_at = EXCLUDED.updated_at`,
        [checkName, fingerprint, new Date(now), shouldAlert, new Date(now)],
      );
      await client.query("COMMIT");
      return shouldAlert;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async markHealthy(checkName, now) {
    await this.pool.query(
      `INSERT INTO wms_monitor_alerts (check_name, status, last_checked_at, updated_at)
       VALUES ($1, 'healthy', $2, $2)
       ON CONFLICT (check_name) DO UPDATE SET
         status = 'healthy',
         failure_fingerprint = NULL,
         first_failed_at = NULL,
         last_checked_at = EXCLUDED.last_checked_at,
         updated_at = EXCLUDED.updated_at`,
      [checkName, new Date(now)],
    );
  }

  async close() {
    await this.pool.end();
  }
}

export function createAlertStateStore(env = process.env) {
  const connectionString = env.DATABASE_URL || env.NEON_DATABASE_URL;
  if (connectionString) return new PostgresAlertStateStore(connectionString);
  return new FileAlertStateStore(env.WMS_ALERT_STATE_FILE || DEFAULT_STATE_FILE);
}

function alertMessage(failureResult, baseUrl, now) {
  const status = failureResult.status ? ` (HTTP ${failureResult.status})` : "";
  let publishedOrigin = baseUrl;
  try {
    publishedOrigin = new URL(baseUrl).origin;
  } catch {
    // The request itself will report an invalid URL; keep alert content safe.
  }
  return {
    subject: `[xHACCP] WMS ${failureResult.check} check failed`,
    text: [
      "The scheduled WMS credential check detected a failure.",
      "",
      `Check: ${failureResult.check}`,
      `Failure: ${failureResult.message}${status}`,
      "Endpoint: /api/wms/v1/health or /api/wms/v1/orders?limit=1",
      `Published app: ${publishedOrigin}`,
      `Observed at: ${new Date(now).toISOString()}`,
      "",
      "No API key value is included in this notification.",
      "Investigate the corresponding Replit Secret and warehouse API-key status.",
    ].join("\n"),
  };
}

export function createSendGridNotifier(env = process.env, fetchImpl = fetch) {
  const apiKey = env.SENDGRID_API_KEY;
  const from = env.WMS_ALERT_FROM_EMAIL || env.SENDGRID_FROM_EMAIL;
  const to = env.WMS_ALERT_EMAIL;
  if (!apiKey || !from || !to) return null;

  return async (failureResult, baseUrl, now) => {
    const message = alertMessage(failureResult, baseUrl, now);
    const response = await fetchImpl("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from },
        subject: message.subject,
        content: [{ type: "text/plain", value: message.text }],
      }),
    });
    return response.ok;
  };
}

export async function runWmsCheck({
  env = process.env,
  fetchImpl = fetch,
  stateStore = createAlertStateStore(env),
  notify = createSendGridNotifier(env, fetchImpl),
  now = Date.now(),
  logger = console,
} = {}) {
  if (isPaused(env)) {
    logger.log("[WMS Monitor] Paused by WMS_MONITOR_PAUSED; no requests or alerts sent.");
    await stateStore.close();
    return { ok: true, paused: true, failures: [], alertsSent: 0 };
  }

  const baseUrl = baseUrlFromEnv(env);
  const timeoutMs = parsePositiveInteger(env.WMS_CHECK_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const cooldownMs = parsePositiveInteger(
    Number(env.WMS_ALERT_COOLDOWN_MINUTES || 60) * 60 * 1000,
    DEFAULT_ALERT_COOLDOWN_MS,
  );
  const failures = [];
  const healthyChecks = [];

  const healthResult = await checkHealth({ baseUrl, fetchImpl, timeoutMs });
  if (healthResult) failures.push(healthResult);
  else healthyChecks.push("health");

  for (const check of WMS_CHECKS) {
    const key = env[check.envName];
    let result = null;
    if (!key) {
      result = failure(check, "credential_missing", `${check.envName} is not configured`);
    } else if (!key.startsWith(check.prefix)) {
      result = failure(check, "credential_prefix", `${check.envName} has an invalid environment prefix`);
    } else {
      result = await checkOrders({ baseUrl, fetchImpl, timeoutMs, check, key });
    }
    if (result) failures.push(result);
    else healthyChecks.push(check.name);
  }

  for (const checkName of healthyChecks) {
    await stateStore.markHealthy(checkName, now);
  }

  let alertsSent = 0;
  for (const result of failures) {
    let shouldAlert;
    try {
      shouldAlert = await stateStore.claimFailure(result.check, result.fingerprint, now, cooldownMs);
    } catch (error) {
      logger.error(`[WMS Monitor] Could not update alert state for ${result.check}; alert suppressed safely.`);
      continue;
    }

    if (!shouldAlert) {
      logger.log(`[WMS Monitor] ${result.check} failure is within the alert cooldown; notification suppressed.`);
      continue;
    }

    if (!notify) {
      logger.error(`[WMS Monitor] Alerting is not configured; no notification sent for ${result.check}.`);
      continue;
    }
    try {
      if (await notify(result, baseUrl, now)) {
        alertsSent++;
        logger.error(`[WMS Monitor] Alert sent for ${result.check}: ${result.message}.`);
      } else {
        logger.error(`[WMS Monitor] Alert provider rejected the notification for ${result.check}.`);
      }
    } catch {
      logger.error(`[WMS Monitor] Alert provider request failed for ${result.check}.`);
    }
  }

  for (const result of failures) {
    logger.error(`[WMS Monitor] ${result.check} failed: ${result.message}.`);
  }

  await stateStore.close();
  return { ok: failures.length === 0, paused: false, failures, alertsSent };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  runWmsCheck()
    .then(result => {
      if (result.paused) return;
      if (result.ok) {
        console.log("[WMS Monitor] Health and sandbox/production orders checks passed.");
      } else {
        process.exitCode = 1;
      }
    })
    .catch(error => {
      console.error(`[WMS Monitor] Check failed before completion: ${error?.message || "unexpected monitor error"}.`);
      process.exitCode = 1;
    });
}