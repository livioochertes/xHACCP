import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  clearVivaCheckoutDraft,
  consumeVivaCheckoutDraft,
  saveVivaCheckoutDraft,
  VIVA_CHECKOUT_DRAFT_TTL_MS,
} from "./viva-checkout-draft";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
};
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: { sessionStorage: storage },
});

after(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

test("stores the checkout draft temporarily without account passwords or recurring consent", () => {
  saveVivaCheckoutDraft("fr", {
    step: 3,
    formValues: {
      email: "buyer@example.test",
      accountPassword: "must-not-be-retained",
      confirmAccountPassword: "must-not-be-retained",
      recurringConsent: true,
    },
    voucherInput: "",
    appliedVoucherCode: "WELCOME20",
  });

  const stored = JSON.parse(values.get("xhaccp_viva_checkout_draft:fr") || "null");
  assert.equal(stored.formValues.accountPassword, "");
  assert.equal(stored.formValues.confirmAccountPassword, "");
  assert.equal(stored.formValues.recurringConsent, false);

  const restored = consumeVivaCheckoutDraft("fr");
  assert.equal(restored?.step, 3);
  assert.equal(restored?.formValues.email, "buyer@example.test");
  assert.equal(restored?.appliedVoucherCode, "WELCOME20");
  assert.equal(consumeVivaCheckoutDraft("fr"), null);
});

test("discards expired drafts and keeps markets isolated", () => {
  saveVivaCheckoutDraft("ro", {
    step: 3,
    formValues: { email: "buyer@example.test" },
    voucherInput: "",
    appliedVoucherCode: null,
  });

  assert.equal(consumeVivaCheckoutDraft("fr"), null);
  const expired = consumeVivaCheckoutDraft("ro", Date.now() + VIVA_CHECKOUT_DRAFT_TTL_MS + 1);
  assert.equal(expired, null);
  assert.equal(values.has("xhaccp_viva_checkout_draft:ro"), false);
  clearVivaCheckoutDraft("fr");
});
