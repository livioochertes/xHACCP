import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeRomanianVatCode,
  toRomanianOrderCustomerSuggestion,
} from "./order-customer-lookup";

test("normalizes equivalent Romanian CUI/VAT formats", () => {
  assert.equal(normalizeRomanianVatCode("RO 12.345.678"), "12345678");
  assert.equal(normalizeRomanianVatCode("ro-12345678"), "12345678");
  assert.equal(normalizeRomanianVatCode("12345678"), "12345678");
});

test("rejects incomplete and non-Romanian VAT identifiers", () => {
  assert.equal(normalizeRomanianVatCode(""), null);
  assert.equal(normalizeRomanianVatCode("RO"), null);
  assert.equal(normalizeRomanianVatCode("FR12345678"), null);
  assert.equal(normalizeRomanianVatCode("RO12345678901"), null);
  assert.equal(normalizeRomanianVatCode(null), null);
});

test("returns only sanitized company, contact, shipping, and billing fields", () => {
  const suggestion = toRomanianOrderCustomerSuggestion({
    id: 91,
    createdAt: new Date("2026-09-24T10:30:00.000Z"),
    shippingAddress: {
      firstName: "Ana",
      lastName: "Pop",
      email: "ana@example.test",
      phone: "0712345678",
      streetAddress: "Strada A 1",
      city: "Cluj",
      county: "Cluj",
      zipCode: "400000",
      country: "Romania",
      companyName: "Example SRL",
      secret: "must not be returned",
    },
    billingAddress: {
      companyName: "Example SRL",
      vatNumber: "RO12345678",
      registrationNumber: "J12/34/2020",
      streetAddress: "Strada B 2",
      city: "Cluj-Napoca",
      county: "Cluj",
      country: "Romania",
      internalNote: "must not be returned",
    },
  });

  assert.deepEqual(suggestion, {
    orderId: 91,
    createdAt: "2026-09-24T10:30:00.000Z",
    companyName: "Example SRL",
    vatNumber: "RO12345678",
    registrationNumber: "J12/34/2020",
    shippingAddress: {
      firstName: "Ana",
      lastName: "Pop",
      email: "ana@example.test",
      phone: "0712345678",
      streetAddress: "Strada A 1",
      city: "Cluj",
      state: "Cluj",
      zipCode: "400000",
      country: "Romania",
    },
    billingAddress: {
      firstName: "Ana",
      lastName: "Pop",
      email: "ana@example.test",
      phone: "0712345678",
      streetAddress: "Strada B 2",
      city: "Cluj-Napoca",
      state: "Cluj",
      zipCode: "400000",
      country: "Romania",
    },
  });
  assert.equal("secret" in (suggestion.shippingAddress as object), false);
});

test("keeps the lookup admin-only and scoped to Romanian orders", () => {
  const routes = readFileSync("server/admin-routes.ts", "utf8");
  const adminSource = readFileSync("admin-src/AdminApp.jsx", "utf8");
  const lookupRoute = routes.match(/app\.get\("\/admin\/api\/orders\/customer-by-vat"[\s\S]*?\n  \}\);/);

  assert.ok(lookupRoute, "customer VAT lookup route exists");
  assert.match(lookupRoute[0], /authenticateAdmin/);
  assert.match(lookupRoute[0], /canAccessMarket\(req,\s*["']ro["']\)/);
  assert.match(lookupRoute[0], /eq\(orders\.market,\s*["']ro["']\)/);
  assert.match(lookupRoute[0], /normalizeRomanianVatCode/);
  assert.match(adminSource, /aoMarket === 'ro' && aoIsCompany/);
  assert.match(adminSource, /setAoVatLookup/);
  assert.match(adminSource, /confirm\(/);
});