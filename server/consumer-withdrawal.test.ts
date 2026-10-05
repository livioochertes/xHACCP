import assert from "node:assert/strict";
import test from "node:test";
import { parseConsumerWithdrawalInput } from "./consumer-withdrawal";

const validInput = {
  firstName: "Marie",
  lastName: "Dupont",
  email: "marie@example.fr",
  orderNumber: "FR-2026-100",
  items: "Étiquettes alimentaires, lot 2",
};

test("builds a withdrawal declaration for the selected market without asking for a reason", () => {
  const french = parseConsumerWithdrawalInput(validInput, "fr");
  const romanian = parseConsumerWithdrawalInput(validInput, "ro");
  const english = parseConsumerWithdrawalInput(validInput, "com");

  assert.equal(french.ok, true);
  assert.equal(romanian.ok, true);
  assert.equal(english.ok, true);
  if (!french.ok || !romanian.ok || !english.ok) return;

  assert.equal(french.data.category, "withdrawal");
  assert.equal(french.data.orderNumber, validInput.orderNumber);
  assert.match(french.data.message, /Je vous notifie.*commande FR-2026-100/);
  assert.match(french.data.message, /Articles concernés par cette demande/);
  assert.match(romanian.data.message, /Vă notific.*comenzii FR-2026-100/);
  assert.match(english.data.message, /I hereby give notice.*order FR-2026-100/);
  assert.doesNotMatch(french.data.message, /reason|motif|motiv/);
});

test("rejects missing identity, order reference, and invalid email", () => {
  assert.deepEqual(parseConsumerWithdrawalInput({}, "fr"), {
    ok: false,
    error: "required_fields",
  });
  assert.deepEqual(
    parseConsumerWithdrawalInput({ ...validInput, email: "not-an-email" }, "fr"),
    { ok: false, error: "invalid_email" },
  );
});

test("normalizes single-line fields and rejects oversized data", () => {
  const parsed = parseConsumerWithdrawalInput({
    ...validInput,
    firstName: "Marie\nDupont",
    items: "A".repeat(2001),
  }, "fr");
  assert.deepEqual(parsed, { ok: false, error: "required_fields" });

  const normalized = parseConsumerWithdrawalInput({
    ...validInput,
    firstName: "Marie\nDupont",
    items: "<script>alert(1)</script>",
  }, "fr");
  assert.equal(normalized.ok, true);
  if (normalized.ok) {
    assert.equal(normalized.data.name, "Marie Dupont Dupont");
    assert.match(normalized.data.message, /<script>alert\(1\)<\/script>/);
  }
});
