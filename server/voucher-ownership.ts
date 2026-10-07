import type { Voucher } from "@shared/schema";

export function getVoucherOwnershipError(
  voucher: Pick<Voucher, "ownerUserId" | "ownerEmail">,
  userId: number | null | undefined,
  email: string | null | undefined,
): string | null {
  if (voucher.ownerUserId == null) return null;
  if (userId != null && userId !== voucher.ownerUserId) {
    return "Sign in to the customer account linked to this voucher.";
  }
  const normalize = (value: string | null | undefined) => value?.trim().toLowerCase() || "";
  if (voucher.ownerEmail) {
    if (normalize(email) !== normalize(voucher.ownerEmail)) {
      return "This voucher can only be used with the email address linked to its account.";
    }
    return null;
  }
  return userId === voucher.ownerUserId
    ? null
    : "Sign in to the customer account linked to this voucher.";
}

export function getVoucherOrderUserId(
  voucher: Pick<Voucher, "ownerUserId"> | null | undefined,
  authenticatedUserId: number | null | undefined,
): number | null {
  return voucher?.ownerUserId ?? authenticatedUserId ?? null;
}

