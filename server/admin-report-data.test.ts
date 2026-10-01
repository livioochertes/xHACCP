import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAdminReportMarketScope,
  resolveAdminReportPeriod,
} from "./admin-report-data";

test("report range validation defaults only when the query parameter is absent", () => {
  assert.equal(resolveAdminReportPeriod(undefined), "7d");
  assert.equal(resolveAdminReportPeriod("24h"), "24h");
  assert.equal(resolveAdminReportPeriod("30d"), "30d");
  assert.equal(resolveAdminReportPeriod("7d,30d"), null);
  assert.equal(resolveAdminReportPeriod(["7d", "30d"]), null);
});

test("superadmins can report across all markets or select one", () => {
  assert.deepEqual(resolveAdminReportMarketScope("all", true), {
    ok: true,
    requestedMarket: "all",
    markets: undefined,
  });
  assert.deepEqual(resolveAdminReportMarketScope("FR", true), {
    ok: true,
    requestedMarket: "fr",
    markets: ["fr"],
  });
});

test("market admins are scoped to their assigned markets", () => {
  assert.deepEqual(resolveAdminReportMarketScope("all", false, ["ro", "fr"]), {
    ok: true,
    requestedMarket: "all",
    markets: ["ro", "fr"],
  });
  assert.deepEqual(resolveAdminReportMarketScope("fr", false, ["RO", "FR", "fr"]), {
    ok: true,
    requestedMarket: "fr",
    markets: ["fr"],
  });
  assert.deepEqual(resolveAdminReportMarketScope("com", false, ["ro"]), {
    ok: false,
    status: 403,
    message: "Access denied for this market",
  });
});

test("invalid markets and admins without assigned markets are rejected", () => {
  assert.deepEqual(resolveAdminReportMarketScope("north", true), {
    ok: false,
    status: 400,
    message: "Invalid market",
  });
  assert.deepEqual(resolveAdminReportMarketScope("all", false, []), {
    ok: false,
    status: 403,
    message: "No markets are assigned to this admin",
  });
});