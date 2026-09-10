import assert from "node:assert/strict";
import test from "node:test";
import { buildEventVoucherEmail, getSenderForMarket } from "./email-service";

test("builds a French event voucher email with the configured sender", () => {
  const email = buildEventVoucherEmail({
    to: "chef@example.com",
    firstName: "<Ana>",
    code: "CHEF20-<SAFE>",
    validUntil: new Date("2027-09-10T10:00:00.000Z"),
    discountValue: "20.00",
  });

  assert.equal(email.from, getSenderForMarket("fr"));
  assert.equal(email.subject, "Votre offre xHACCP France — 20 % de réduction");
  assert.match(email.text, /CHEF20-<SAFE>/);
  assert.match(email.html, /&lt;Ana&gt;/);
  assert.match(email.html, /CHEF20-&lt;SAFE&gt;/);
  assert.doesNotMatch(email.html, /<Ana>|CHEF20-<SAFE>/);
  assert.match(email.html, /10\/09\/2027/);
  assert.match(email.text, /https:\/\/xhaccp\.fr\/products\?category=etiquettes-alimentaires/);
  assert.match(email.html, /href="https:\/\/xhaccp\.fr\/products\?category=etiquettes-alimentaires"/);
});