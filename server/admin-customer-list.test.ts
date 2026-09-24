import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminCustomerList } from "./admin-customer-list";

test("deduplicates guest customers by normalized email and combines orders across markets", () => {
  const customers = buildAdminCustomerList([], [
    {
      id: 31,
      userId: null,
      market: "ro",
      createdAt: new Date("2026-08-01T10:00:00.000Z"),
      shippingAddress: { firstName: "Ana", lastName: "Pop", email: "Ana@Example.test" },
      billingAddress: {},
    },
    {
      id: 42,
      userId: null,
      market: "fr",
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
      shippingAddress: { firstName: "Ana", lastName: "Pop", email: " ana@example.test " },
      billingAddress: {},
    },
  ], null);

  assert.equal(customers.length, 1);
  assert.equal(customers[0].email, "Ana@Example.test");
  assert.equal(customers[0].displayName, "Ana Pop");
  assert.equal(customers[0].isRegistered, false);
  assert.deepEqual(customers[0].markets, ["fr", "ro"]);
  assert.equal(customers[0].orderCount, 2);
  assert.equal(customers[0].lastOrderId, 42);
  assert.equal(customers[0].lastOrderAt, "2026-09-01T10:00:00.000Z");
});

test("merges guest orders with the matching registered account", () => {
  const customers = buildAdminCustomerList([
    {
      id: 7,
      email: "buyer@example.test",
      firstName: "Bea",
      lastName: "Ionescu",
      isAdmin: false,
      adminMarkets: [],
    },
  ], [
    {
      id: 55,
      userId: null,
      market: "ro",
      createdAt: "2026-09-02T10:00:00.000Z",
      shippingAddress: { email: "BUYER@example.test", firstName: "Bea" },
      billingAddress: {},
    },
  ], null);

  assert.equal(customers.length, 1);
  assert.equal(customers[0].id, 7);
  assert.equal(customers[0].isRegistered, true);
  assert.equal(customers[0].orderCount, 1);
  assert.equal(customers[0].markets[0], "ro");
});

test("keeps account-only records in the all-market view and scopes order customers", () => {
  const accounts = [
    { id: 1, email: "admin@example.test", isAdmin: true, adminMarkets: ["fr"] },
    { id: 2, email: "account-only@example.test", isAdmin: false, adminMarkets: [] },
  ];
  const orders = [
    {
      id: 70,
      userId: null,
      market: "fr",
      createdAt: "2026-09-03T10:00:00.000Z",
      shippingAddress: { email: "guest@example.test" },
      billingAddress: {},
    },
    {
      id: 71,
      userId: null,
      market: "ro",
      createdAt: "2026-09-04T10:00:00.000Z",
      shippingAddress: { email: "other@example.test" },
      billingAddress: {},
    },
  ];

  const allMarkets = buildAdminCustomerList(accounts, orders, null);
  assert.equal(allMarkets.length, 4);
  assert.ok(allMarkets.some((customer) => customer.email === "account-only@example.test"));

  const frenchMarket = buildAdminCustomerList(accounts, orders, ["fr"]);
  assert.deepEqual(frenchMarket.map((customer) => customer.email).sort(), [
    "admin@example.test",
    "guest@example.test",
  ]);
});

test("uses guest email stored in order notes when addresses have none", () => {
  const customers = buildAdminCustomerList([], [
    {
      id: 80,
      userId: null,
      market: "ro",
      createdAt: null,
      shippingAddress: {},
      billingAddress: {},
      notes: "Guest email: buyer@example.test, Phone: 0712345678",
    },
  ], null);

  assert.equal(customers.length, 1);
  assert.equal(customers[0].email, "buyer@example.test");
});