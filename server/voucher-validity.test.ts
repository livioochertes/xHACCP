import assert from "node:assert/strict";
import test from "node:test";
import { addDays, getVoucherValidityError } from "./voucher-validity";

const registrationDate = new Date("2026-09-10T10:00:00.000Z");
const activationDeadline = addDays(registrationDate, 30);
const validUntil = new Date("2027-09-10T10:00:00.000Z");

function voucher(overrides: Partial<{
  isActive: boolean;
  validFrom: Date;
  validUntil: Date;
  activationDeadline: Date;
  activatedAt: Date | null;
}> = {}) {
  return {
    isActive: true,
    validFrom: registrationDate,
    validUntil,
    activationDeadline,
    activatedAt: null,
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