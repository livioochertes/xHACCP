import type { Voucher } from "@shared/schema";
import { EVENT_VOUCHER_ACTIVATION_DAYS } from "./event-voucher";

export { EVENT_VOUCHER_ACTIVATION_DAYS };

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(
    result.getUTCFullYear(),
    result.getUTCMonth() + 1,
    0,
  )).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function getVoucherReservationCapacity(
  voucher: Pick<Voucher, "ownerUserId" | "activationDeadline" | "activatedAt" | "maxUses" | "usedCount">,
): number | null {
  if (voucher.ownerUserId == null || !voucher.activationDeadline || voucher.activatedAt) {
    return null;
  }

  // An unactivated personal event voucher can only have one first payment.
  // A successful payment inside the activation window removes this limit by
  // setting activatedAt and maxUses to null.
  return Math.max((voucher.maxUses ?? 1) - (voucher.usedCount ?? 0), 0);
}

export function getVoucherSuccessfulPaymentUpdate(
  voucher: Pick<Voucher, "usedCount" | "maxUses" | "activationDeadline" | "activatedAt" | "activationMonths" | "validUntil" | "ownerUserId">,
  now = new Date(),
): Pick<Voucher, "usedCount" | "maxUses" | "activatedAt" | "validUntil"> {
  const usedCount = (voucher.usedCount || 0) + 1;
  if (voucher.ownerUserId !== null && voucher.activationDeadline && !voucher.activatedAt) {
    if (new Date(voucher.activationDeadline) >= now) {
      return {
        usedCount,
        maxUses: null,
        activatedAt: now,
        validUntil: addMonths(now, voucher.activationMonths || 12),
      };
    }
    if (voucher.maxUses !== null && (voucher.usedCount || 0) >= voucher.maxUses) {
      return {
        usedCount: voucher.usedCount || 0,
        maxUses: voucher.maxUses,
        activatedAt: null,
        validUntil: voucher.validUntil,
      };
    }
    return {
      usedCount,
      maxUses: voucher.maxUses ?? 1,
      activatedAt: null,
      validUntil: voucher.validUntil,
    };
  }

  return {
    usedCount,
    maxUses: voucher.maxUses,
    activatedAt: voucher.activatedAt || (
      !voucher.activationDeadline || new Date(voucher.activationDeadline) >= now ? now : null
    ),
    validUntil: voucher.validUntil,
  };
}

export function getVoucherValidityError(
  voucher: Pick<Voucher, "isActive" | "validFrom" | "validUntil" | "activationDeadline" | "activatedAt" | "ownerUserId">,
  now = new Date(),
): string | null {
  if (!voucher.isActive) return "This voucher is no longer active";

  if (
    voucher.ownerUserId == null
    && voucher.activationDeadline
    && !voucher.activatedAt
    && new Date(voucher.activationDeadline) < now
  ) {
    return "This voucher had to be activated within 30 days of registration";
  }

  if (voucher.validFrom && new Date(voucher.validFrom) > now) {
    return "This voucher is not yet valid";
  }

  if (voucher.validUntil && new Date(voucher.validUntil) < now) {
    return "This voucher has expired";
  }

  return null;
}