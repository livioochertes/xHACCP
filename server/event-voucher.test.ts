import assert from "node:assert/strict";
import test from "node:test";
import { buildEventVoucherEmail, getSenderForMarket } from "./email-service";
import { normalizeEventVoucherCampaignUpdate } from "./event-voucher";

test("builds a French event voucher email with the configured sender", () => {
  const email = buildEventVoucherEmail({
    to: "chef@example.com",
    firstName: "<Ana>",
    code: "CHEF20-<SAFE>",
    validUntil: new Date("2027-09-10T10:00:00.000Z"),
    activationDeadline: new Date("2026-10-10T10:00:00.000Z"),
    discountValue: "20.00",
    discountType: "percentage",
    validMonths: 12,
  });

  assert.equal(email.from, getSenderForMarket("fr"));
  assert.equal(email.subject, "Votre offre xHACCP France — 20 % de réduction");
  assert.match(email.text, /CHEF20-<SAFE>/);
  assert.match(email.html, /&lt;Ana&gt;/);
  assert.match(email.html, /CHEF20-&lt;SAFE&gt;/);
  assert.doesNotMatch(email.html, /<Ana>|CHEF20-<SAFE>/);
  assert.match(email.html, /src="https:\/\/xhaccp\.fr\/attached_assets\/logo_xHACCP-S1_1772812623761\.png"/);
  assert.match(email.html, /alt="xHACCP"/);
  assert.match(email.html, /10\/09\/2027/);
  assert.match(email.text, /https:\/\/xhaccp\.fr\/products\?category=etiquettes-alimentaires/);
  assert.match(email.html, /href="https:\/\/xhaccp\.fr\/products\?category=etiquettes-alimentaires"/);
  assert.match(email.text, /30 jours.*10\/10\/2026/i);
  assert.match(email.html, /10\/10\/2026/);
});

test("voucher email formats fixed EUR offers without percentage language", () => {
  const email = buildEventVoucherEmail({
    to: "chef@example.com",
    firstName: "Ana",
    code: "XHACCP-ABC123",
    validUntil: new Date("2027-04-10T10:00:00.000Z"),
    activationDeadline: new Date("2026-10-10T10:00:00.000Z"),
    discountType: "fixed",
    discountValue: "15.00",
    validMonths: 6,
  });

  assert.match(email.subject, /15,00\s*€/);
  assert.match(email.html, /15,00\s*€ de réduction/);
  assert.match(email.text, /valable 6 mois à compter de votre inscription/i);
  assert.doesNotMatch(email.text, /15,00\s*%|20 ?%|12 mois/);
});

test("promotion settings accept fixed and percentage values and reject invalid terms", () => {
  const current = {
    name: "Offre",
    discountType: "percentage",
    discountValue: "20.00",
    validMonths: 12,
  } as any;

  assert.deepEqual(
    normalizeEventVoucherCampaignUpdate({ discountType: "fixed", discountValue: "7.5", validMonths: 3 }, current),
    { discountType: "fixed", discountValue: "7.50", validMonths: 3 },
  );
  assert.throws(
    () => normalizeEventVoucherCampaignUpdate({ discountType: "percentage", discountValue: 101 }, current),
    /100 %/,
  );
  assert.throws(
    () => normalizeEventVoucherCampaignUpdate({ validMonths: 0 }, current),
    /1 et 120 mois/,
  );
});