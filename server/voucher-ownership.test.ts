import assert from "node:assert/strict";
import test from "node:test";
import { getVoucherOrderUserId, getVoucherOwnershipError } from "./voucher-ownership";

test("personal vouchers require the linked account and its normalized email", () => {
  const voucher = { ownerUserId: 52, ownerEmail: "ana@example.fr" };
  assert.equal(getVoucherOwnershipError(voucher, 52, " ANA@EXAMPLE.FR "), null);
  assert.match(getVoucherOwnershipError(voucher, 13, "ana@example.fr") || "", /account linked/i);
  assert.match(getVoucherOwnershipError(voucher, 52, "other@example.fr") || "", /email address/i);
  assert.equal(getVoucherOwnershipError(voucher, null, " ANA@EXAMPLE.FR "), null);
  assert.match(getVoucherOwnershipError(voucher, null, "other@example.fr") || "", /email address/i);
});

test("guest use still requires the signup email if a legacy owned voucher has no owner email", () => {
  assert.equal(getVoucherOwnershipError({ ownerUserId: 52, ownerEmail: null }, 52, null), null);
  assert.match(getVoucherOwnershipError({ ownerUserId: 52, ownerEmail: null }, null, "ana@example.fr") || "", /sign in/i);
});

test("administrative vouchers without a titular remain usable without account binding", () => {
  assert.equal(
    getVoucherOwnershipError({ ownerUserId: null, ownerEmail: null }, null, "guest@example.fr"),
    null,
  );
});

test("orders using a personal voucher are attached to its titular even for guest checkout", () => {
  assert.equal(getVoucherOrderUserId({ ownerUserId: 52 }, null), 52);
  assert.equal(getVoucherOrderUserId({ ownerUserId: 52 }, 52), 52);
  assert.equal(getVoucherOrderUserId({ ownerUserId: null }, 17), 17);
  assert.equal(getVoucherOrderUserId({ ownerUserId: null }, null), null);
});
