import { pool } from "./db";
import {
  sanitizePaymentObservation, paymentNotificationDecision, PAYMENT_ALERT_COOLDOWN_MS,
  type PaymentObservation, type PaymentMarket,
} from "./payment-health-policy";

export const PAYMENT_HEALTH_ENVIRONMENT = process.env.NODE_ENV === "production" ? "production" : "development";
let schemaReady: Promise<void> | undefined;

/** Additive and idempotent: created automatically on the next deployment/use. */
export function ensurePaymentHealthSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock(hashtext('xhaccp:payment-health-schema'))");
        await client.query(`
      CREATE TABLE IF NOT EXISTS payment_health_states (
        environment text NOT NULL, provider text NOT NULL, market text NOT NULL, stage text NOT NULL,
        status text NOT NULL DEFAULT 'unknown', last_observed_at timestamptz, last_success_at timestamptz,
        last_failure_at timestamptz, error_code text, http_status integer, response_type text, reference text,
        last_alert_at timestamptz, incident_alerted boolean NOT NULL DEFAULT false,
        PRIMARY KEY (environment, provider, market, stage)
      );
      CREATE TABLE IF NOT EXISTS payment_health_events (
        id bigserial PRIMARY KEY, environment text NOT NULL, provider text NOT NULL, market text NOT NULL,
        stage text NOT NULL, status text NOT NULL, code text, http_status integer,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS payment_health_events_scope ON payment_health_events(environment, created_at DESC);
      CREATE TABLE IF NOT EXISTS payment_health_notifications (
        id bigserial PRIMARY KEY, environment text NOT NULL, provider text NOT NULL, market text NOT NULL,
        stage text NOT NULL, kind text NOT NULL, payload jsonb NOT NULL, status text NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0, claimed_at timestamptz, next_attempt_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz
      );
      CREATE INDEX IF NOT EXISTS payment_health_notifications_scope ON payment_health_notifications(environment, next_attempt_at);
        `);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    })().catch(error => { schemaReady = undefined; throw error; });
  }
  return schemaReady;
}

export async function persistPaymentObservation(input: PaymentObservation) {
  const observation = sanitizePaymentObservation(input);
  await ensurePaymentHealthSchema();
  const client = await pool.connect();
  const now = new Date();
  const key = [PAYMENT_HEALTH_ENVIRONMENT, observation.provider, observation.market, observation.stage];
  try {
    await client.query("BEGIN");
    // Serialize all stages for the same provider/account across autoscale instances.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key.slice(0, 3).join(":")]);
    await client.query(`INSERT INTO payment_health_states(environment,provider,market,stage)
      VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, key);
    const { rows: [previous] } = await client.query(`SELECT * FROM payment_health_states
      WHERE environment=$1 AND provider=$2 AND market=$3 AND stage=$4 FOR UPDATE`, key);
    const { rows: other } = await client.query(`SELECT 1 FROM payment_health_states
      WHERE environment=$1 AND provider=$2 AND market=$3 AND stage<>$4 AND status='error'
      AND incident_alerted=true AND last_alert_at>$5 LIMIT 1`,
      [...key, new Date(now.getTime() - PAYMENT_ALERT_COOLDOWN_MS)]);
    const notification = PAYMENT_HEALTH_ENVIRONMENT === "production" ? paymentNotificationDecision({
      status: previous.status, lastAlertAt: previous.last_alert_at, incidentAlerted: previous.incident_alerted,
    }, observation, now, other.length > 0) : undefined;
    const newIncident = observation.status === "error" && previous.status !== "error";
    const incidentAlerted = observation.status === "ok" ? false :
      notification === "failure" || (!newIncident && previous.incident_alerted);
    await client.query(`UPDATE payment_health_states SET status=$5,last_observed_at=$6,
      last_success_at=CASE WHEN $5='ok' THEN $6 ELSE last_success_at END,
      last_failure_at=CASE WHEN $5='error' THEN $6 ELSE last_failure_at END,
      error_code=$7,http_status=$8,response_type=$9,reference=$10,
      last_alert_at=CASE WHEN $11::boolean THEN $6 ELSE last_alert_at END,incident_alerted=$12
      WHERE environment=$1 AND provider=$2 AND market=$3 AND stage=$4`,
      [...key, observation.status, now, observation.code || null, observation.httpStatus || null,
        observation.responseType || null, observation.reference || null, notification === "failure", incidentAlerted]);
    // History records transitions/changed errors, not every successful request.
    if (previous.status !== observation.status || previous.error_code !== (observation.code || null)) {
      await client.query(`INSERT INTO payment_health_events(environment,provider,market,stage,status,code,http_status,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [...key, observation.status, observation.code || null, observation.httpStatus || null, now]);
    }
    if (notification && PAYMENT_HEALTH_ENVIRONMENT === "production") {
      await client.query(`INSERT INTO payment_health_notifications(environment,provider,market,stage,kind,payload,created_at)
        VALUES($1,$2,$3,$4,$5,$6,$7)`, [...key, notification, JSON.stringify(observation), now]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function claimPaymentNotification() {
  await ensurePaymentHealthSchema();
  const { rows } = await pool.query(`UPDATE payment_health_notifications SET status='sending',
    claimed_at=now(),attempts=attempts+1 WHERE id IN (
      SELECT id FROM payment_health_notifications WHERE environment=$1 AND
      ((status='pending' AND next_attempt_at<=now()) OR (status='sending' AND claimed_at<now()-interval '5 minutes'))
      ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, [PAYMENT_HEALTH_ENVIRONMENT]);
  return rows[0];
}

export async function finishPaymentNotification(id: number, sent: boolean, attempts: number) {
  await pool.query(`UPDATE payment_health_notifications SET status=$2,claimed_at=NULL,
    sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END,
    next_attempt_at=now()+($3 * interval '1 minute') WHERE id=$1`,
    [id, sent ? "sent" : "pending", Math.min(60, Math.pow(2, Math.min(attempts, 6)))]);
}

export async function getPaymentHealthOverview(markets: PaymentMarket[]) {
  await ensurePaymentHealthSchema();
  const [stateResult, eventResult, alertResult] = await Promise.all([
    pool.query(`SELECT * FROM payment_health_states WHERE environment=$1 AND market=ANY($2::text[])`, [PAYMENT_HEALTH_ENVIRONMENT, markets]),
    pool.query(`SELECT id,provider,market,stage,status,code,http_status AS "httpStatus",created_at AS "createdAt"
      FROM payment_health_events WHERE environment=$1 AND market=ANY($2::text[]) ORDER BY id DESC LIMIT 100`, [PAYMENT_HEALTH_ENVIRONMENT, markets]),
    pool.query(`SELECT id,provider,market,stage,kind,status,created_at AS "createdAt",sent_at AS "sentAt",attempts
      FROM payment_health_notifications WHERE environment=$1 AND market=ANY($2::text[]) ORDER BY id DESC LIMIT 50`, [PAYMENT_HEALTH_ENVIRONMENT, markets]),
  ]);
  const keys = new Set<string>();
  for (const market of markets) {
    if (market !== "com" || markets.length === 1) keys.add(`viva:${market}`);
    if (market === "fr") keys.add("paypal:fr");
  }
  stateResult.rows.forEach(row => keys.add(`${row.provider}:${row.market}`));
  const channels = Array.from(keys).map(key => {
    const [provider, market] = key.split(":");
    const rows = stateResult.rows.filter(row => row.provider === provider && row.market === market);
    const latest = (column: string) => rows.map(row => row[column]).filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
    return {
      provider, market,
      status: rows.some(row => row.status === "error") ? "error" : rows.some(row => row.stage === "checkout" && row.status === "ok") ? "ok" : "unknown",
      lastObservedAt: latest("last_observed_at"), lastSuccessAt: latest("last_success_at"),
      stages: rows.filter(row => row.status !== "unknown").map(row => ({
        stage: row.stage, status: row.status, lastObservedAt: row.last_observed_at,
        lastSuccessAt: row.last_success_at, lastFailureAt: row.last_failure_at,
        errorCode: row.error_code, httpStatus: row.http_status, responseType: row.response_type,
        reference: row.reference, lastAlertAt: row.last_alert_at,
      })),
    };
  });
  return { channels, events: eventResult.rows, alerts: alertResult.rows, environment: PAYMENT_HEALTH_ENVIRONMENT };
}
