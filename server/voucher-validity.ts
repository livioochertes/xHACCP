import type { Voucher } from "@shared/schema";
import { EVENT_VOUCHER_ACTIVATION_DAYS } from "./event-voucher";

export { EVENT_VOUCHER_ACTIVATION_DAYS };

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getVoucherValidityError(
  voucher: Pick<Voucher, "isActive" | "validFrom" | "validUntil" | "activationDeadline" | "activatedAt">,
  now = new Date(),
): string | null {
  if (!voucher.isActive) return "This voucher is no longer active";

  if (voucher.validFrom && new Date(voucher.validFrom) > now) {
    return "This voucher is not yet valid";
  }

  if (voucher.activationDeadline && !voucher.activatedAt && new Date(voucher.activationDeadline) < now) {
    return "This voucher had to be activated within 30 days of registration";
  }

  if (voucher.validUntil && new Date(voucher.validUntil) < now) {
    return "This voucher has expired";
  }

  return null;
}