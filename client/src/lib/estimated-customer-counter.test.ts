import assert from "node:assert/strict";
import test from "node:test";
import {
  CUSTOMER_COUNTER_DAILY_INCREMENT,
  CUSTOMER_COUNTER_REFRESH_MAX_MS,
  CUSTOMER_COUNTER_REFRESH_MIN_MS,
  ESTIMATED_CUSTOMER_COUNTER_BASE,
  getCustomerCounterRefreshDelayMs,
  getEstimatedCustomerCount,
  getEstimatedCustomerUpdateMinutes,
} from "./estimated-customer-counter";

test("estimates ten visible counter increments between 09:00 and 18:00 Paris time", () => {
  const updates = getEstimatedCustomerUpdateMinutes("2026-10-20");

  assert.equal(updates.length, CUSTOMER_COUNTER_DAILY_INCREMENT);
  assert.ok(updates.every((minute) => minute >= 9 * 60 && minute < 18 * 60));
  assert.deepEqual(
    updates,
    [...updates].sort((left, right) => left - right),
  );
  assert.equal(new Set(updates).size, CUSTOMER_COUNTER_DAILY_INCREMENT);
});

test("starts at 3,788 and does not increase outside the Paris business window", () => {
  assert.equal(
    getEstimatedCustomerCount(new Date("2026-10-19T19:00:00.000Z")),
    ESTIMATED_CUSTOMER_COUNTER_BASE,
  );
  assert.equal(
    getEstimatedCustomerCount(new Date("2026-10-20T07:00:00.000Z")),
    ESTIMATED_CUSTOMER_COUNTER_BASE,
  );
  assert.equal(
    getEstimatedCustomerCount(new Date("2026-10-20T16:00:00.000Z")),
    ESTIMATED_CUSTOMER_COUNTER_BASE + CUSTOMER_COUNTER_DAILY_INCREMENT,
  );
  assert.equal(
    getEstimatedCustomerCount(new Date("2026-10-20T22:00:00.000Z")),
    ESTIMATED_CUSTOMER_COUNTER_BASE + CUSTOMER_COUNTER_DAILY_INCREMENT,
  );
  assert.equal(
    getEstimatedCustomerCount(new Date("2026-10-21T06:59:00.000Z")),
    ESTIMATED_CUSTOMER_COUNTER_BASE + CUSTOMER_COUNTER_DAILY_INCREMENT,
  );
  assert.equal(
    getEstimatedCustomerCount(new Date("2026-10-21T16:00:00.000Z")),
    ESTIMATED_CUSTOMER_COUNTER_BASE + CUSTOMER_COUNTER_DAILY_INCREMENT * 2,
  );
});

test("checks for counter changes at a randomized interval between 30 seconds and 5 minutes", () => {
  assert.equal(
    getCustomerCounterRefreshDelayMs(() => 0),
    CUSTOMER_COUNTER_REFRESH_MIN_MS,
  );
  assert.equal(
    getCustomerCounterRefreshDelayMs(() => 0.999999),
    CUSTOMER_COUNTER_REFRESH_MAX_MS,
  );
});
