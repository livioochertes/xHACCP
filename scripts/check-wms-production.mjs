#!/usr/bin/env node

const baseUrl = (process.env.WMS_BASE_URL || "http://127.0.0.1:5000").replace(/\/+$/, "");
const checks = [
  { name: "sandbox", envName: "WMS_SANDBOX_API_KEY", prefix: "wms_test_" },
  { name: "production", envName: "WMS_PRODUCTION_API_KEY", prefix: "wms_live_" },
];

function fail(message) {
  console.error(`WMS production check failed: ${message}`);
  process.exitCode = 1;
}

async function run() {
  const health = await fetch(`${baseUrl}/api/wms/v1/health`);
  if (!health.ok) {
    fail(`health endpoint returned HTTP ${health.status}`);
    return;
  }

  for (const check of checks) {
    const key = process.env[check.envName];
    if (!key) {
      fail(`${check.envName} is not configured in the environment`);
      continue;
    }
    if (!key.startsWith(check.prefix)) {
      fail(`${check.envName} does not use the ${check.name} key prefix`);
      continue;
    }

    const response = await fetch(`${baseUrl}/api/wms/v1/orders?limit=1`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!response.ok) {
      fail(`${check.name} key returned HTTP ${response.status}`);
      continue;
    }
    const body = await response.json();
    if (!body || !Array.isArray(body.data) || !body.pagination) {
      fail(`${check.name} key returned an unexpected orders response`);
      continue;
    }
    console.log(`WMS ${check.name} key passed (plaintext not printed).`);
  }
}

run().catch((error) => {
  fail(error instanceof Error ? error.message : "unexpected network error");
});