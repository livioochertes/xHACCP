import test from "node:test";
import assert from "node:assert/strict";
import { FileAlertStateStore, runWmsCheck } from "./check-wms-production.mjs";

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function makeFetch({ sandboxStatus = 200, productionStatus = 200 } = {}) {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (url.endsWith("/health")) return response({ ok: true });
    if (options.headers.Authorization.includes("wms_test_")) {
      return response({ data: [], pagination: { next_cursor: null, limit: 1 } }, sandboxStatus);
    }
    return response({ data: [], pagination: { next_cursor: null, limit: 1 } }, productionStatus);
  };
  return { fetchImpl, requests };
}

test("checks health, sandbox, and production independently without logging keys", async () => {
  const { fetchImpl, requests } = makeFetch({ productionStatus: 401 });
  const logs = [];
  const stateStore = new FileAlertStateStore(`/tmp/wms-monitor-test-${process.pid}-independent.json`);
  const result = await runWmsCheck({
    env: {
      WMS_BASE_URL: "https://published.example",
      WMS_SANDBOX_API_KEY: "wms_test_sandbox_secret",
      WMS_PRODUCTION_API_KEY: "wms_live_production_secret",
    },
    fetchImpl,
    stateStore,
    notify: async failure => {
      logs.push(failure.message);
      return true;
    },
    logger: { log: () => {}, error: message => logs.push(message) },
  });

  assert.equal(result.ok, false);
  assert.equal(requests.length, 3);
  assert.equal(requests.filter(request => request.url.endsWith("/orders?limit=1")).length, 2);
  assert.equal(logs.some(message => message.includes("wms_test_sandbox_secret")), false);
  assert.equal(logs.some(message => message.includes("wms_live_production_secret")), false);
  await stateStore.close();
});

test("suppresses repeated failures until the cooldown expires", async () => {
  const { fetchImpl } = makeFetch({ productionStatus: 401 });
  const stateStore = new FileAlertStateStore(`/tmp/wms-monitor-test-${process.pid}-cooldown.json`);
  const notifications = [];
  const options = {
    env: {
      WMS_BASE_URL: "https://published.example",
      WMS_SANDBOX_API_KEY: "wms_test_sandbox_secret",
      WMS_PRODUCTION_API_KEY: "wms_live_production_secret",
    },
    fetchImpl,
    stateStore,
    notify: async failure => {
      notifications.push(failure.check);
      return true;
    },
    logger: { log: () => {}, error: () => {} },
  };

  await runWmsCheck({ ...options, now: 1_000 });
  await runWmsCheck({ ...options, now: 30_000 });
  await runWmsCheck({ ...options, now: 3_700_001 });

  assert.deepEqual(notifications, ["production", "production"]);
  await stateStore.close();
});