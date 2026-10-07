import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  getVoucherReservationCapacity,
  getVoucherSuccessfulPaymentUpdate,
  getVoucherValidityError,
} from "./voucher-validity";

const registrationDate = new Date("2026-09-10T10:00:00.000Z");
const activationDeadline = addDays(registrationDate, 30);
const validUntil = new Date("2027-09-10T10:00:00.000Z");

function voucher(overrides: Partial<{
  isActive: boolean;
  validFrom: Date;
  validUntil: Date;
  activationDeadline: Date;
  activatedAt: Date | null;
  ownerUserId: number | null;
}> = {}) {
  return {
    isActive: true,
    validFrom: registrationDate,
    validUntil,
    activationDeadline,
    activatedAt: null,
    ownerUserId: null,
    ...overrides,
  };
}

test("event voucher is valid during the 30-day activation window", () => {
  assert.equal(
    getVoucherValidityError(voucher(), new Date("2026-09-25T10:00:00.000Z")),
    null,
  );
});

test("event voucher expires after 30 days if it was never used", () => {
  assert.equal(
    getVoucherValidityError(voucher(), new Date("2026-10-11T10:00:00.000Z")),
    "This voucher had to be activated within 30 days of registration",
  );
});

test("a used event voucher keeps its 12-month validity after activation deadline", () => {
  assert.equal(
    getVoucherValidityError(
      voucher({ activatedAt: new Date("2026-09-20T10:00:00.000Z") }),
      new Date("2027-01-10T10:00:00.000Z"),
    ),
    null,
  );
});

test("an activated event voucher still expires at the original 12-month limit", () => {
  assert.equal(
    getVoucherValidityError(
      voucher({ activatedAt: new Date("2026-09-20T10:00:00.000Z") }),
      new Date("2027-09-11T10:00:00.000Z"),
    ),
    "This voucher has expired",
  );
});

test("an unused personal voucher remains usable after 30 days for one later paid order", () => {
  assert.equal(
    getVoucherValidityError(voucher({ ownerUserId: 42 }), new Date("2026-10-11T10:00:00.000Z")),
    null,
  );
});

test("an unactivated personal voucher reserves only its remaining first-use capacity", () => {
  assert.equal(getVoucherReservationCapacity({
    ownerUserId: 42,
    activationDeadline,
    activatedAt: null,
    maxUses: 1,
    usedCount: 0,
  }), 1);
  assert.equal(getVoucherReservationCapacity({
    ownerUserId: 42,
    activationDeadline,
    activatedAt: null,
    maxUses: 1,
    usedCount: 1,
  }), 0);
});

test("activated and non-personal vouchers do not reserve first-payment capacity", () => {
  assert.equal(getVoucherReservationCapacity({
    ownerUserId: 42,
    activationDeadline,
    activatedAt: new Date("2026-10-10T10:00:00.000Z"),
    maxUses: null,
    usedCount: 1,
  }), null);
  assert.equal(getVoucherReservationCapacity({
    ownerUserId: null,
    activationDeadline,
    activatedAt: null,
    maxUses: 1,
    usedCount: 0,
  }), null);
});

test("the first paid redemption within 30 days starts the configured 12-month period at payment time", () => {
  const paidAt = new Date("2026-10-10T10:00:00.000Z");
  const updated = getVoucherSuccessfulPaymentUpdate({
    usedCount: 0,
    maxUses: 1,
    activationDeadline,
    activatedAt: null,
    activationMonths: 12,
    validUntil,
    ownerUserId: 42,
  }, paidAt);
  assert.equal(updated.usedCount, 1);
  assert.equal(updated.maxUses, null);
  assert.equal(updated.activatedAt, paidAt);
  assert.equal(updated.validUntil?.toISOString(), "2027-10-10T10:00:00.000Z");
});

test("a late first paid redemption remains one-time and does not activate repeat validity", () => {
  const paidAt = new Date("2026-10-11T10:00:00.000Z");
  const updated = getVoucherSuccessfulPaymentUpdate({
    usedCount: 0,
    maxUses: 1,
    activationDeadline,
    activatedAt: null,
    activationMonths: 12,
    validUntil,
    ownerUserId: 42,
  }, paidAt);
  assert.equal(updated.usedCount, 1);
  assert.equal(updated.maxUses, 1);
  assert.equal(updated.activatedAt, null);
  assert.equal(updated.validUntil, validUntil);
});

test("a repeated late payment notification cannot consume a one-use personal voucher again", () => {
  const latePayment = new Date("2026-10-11T10:00:00.000Z");
  const updated = getVoucherSuccessfulPaymentUpdate({
    usedCount: 1,
    maxUses: 1,
    activationDeadline,
    activatedAt: null,
    activationMonths: 12,
    validUntil,
    ownerUserId: 42,
  }, latePayment);
  assert.equal(updated.usedCount, 1);
  assert.equal(updated.maxUses, 1);
  assert.equal(updated.activatedAt, null);
});

test("administrative vouchers keep the previous late-deadline behavior", () => {
  assert.equal(
    getVoucherValidityError(voucher({ ownerUserId: null }), new Date("2026-10-11T10:00:00.000Z")),
    "This voucher had to be activated within 30 days of registration",
  );
});