import type { EventVoucherCampaign } from "@shared/schema";

export const EVENT_VOUCHER_CAMPAIGN_SLUG = "chef-event-fr";
export const EVENT_VOUCHER_ACTIVATION_DAYS = 30;

export const EVENT_VOUCHER_CAMPAIGN_DEFAULTS = {
  slug: EVENT_VOUCHER_CAMPAIGN_SLUG,
  name: "Offre de bienvenue xHACCP France",
  marketCode: "fr",
  discountType: "percentage",
  discountValue: "20.00",
  validMonths: 12,
  isActive: true,
} as const;

export type EventVoucherOffer = Pick<
  EventVoucherCampaign,
  "name" | "discountType" | "discountValue" | "validMonths"
> & {
  activationDays?: number;
};

export function formatEventVoucherDiscount(
  discountType: string,
  discountValue: string | number,
): string {
  const amount = Number(discountValue);
  if (!Number.isFinite(amount)) return String(discountValue);
  if (discountType === "percentage") {
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount)} %`;
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function normalizeEventVoucherCampaignUpdate(
  input: Record<string, unknown>,
  current: EventVoucherCampaign,
): Partial<EventVoucherCampaign> {
  const update: Partial<EventVoucherCampaign> = {};

  if (input.name !== undefined) {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 255) {
      throw new Error("Le nom de l'offre est obligatoire (255 caractères maximum).");
    }
    update.name = input.name.trim();
  }

  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean") throw new Error("Le statut de l'offre est invalide.");
    update.isActive = input.isActive;
  }

  const discountType = input.discountType === undefined ? current.discountType : input.discountType;
  const discountValue = input.discountValue === undefined ? current.discountValue : input.discountValue;
  const validMonths = input.validMonths === undefined ? current.validMonths : input.validMonths;
  const normalizedValidMonths = Number(validMonths);

  if (discountType !== "percentage" && discountType !== "fixed") {
    throw new Error("Le type de réduction doit être un pourcentage ou un montant fixe.");
  }
  const normalizedDiscountValue = Number(discountValue);
  if (!Number.isFinite(normalizedDiscountValue) || normalizedDiscountValue <= 0) {
    throw new Error("La valeur de réduction doit être supérieure à zéro.");
  }
  if (discountType === "percentage" && normalizedDiscountValue > 100) {
    throw new Error("Une réduction en pourcentage ne peut pas dépasser 100 %.");
  }
  if (!Number.isInteger(normalizedValidMonths) || normalizedValidMonths < 1 || normalizedValidMonths > 120) {
    throw new Error("La durée de validité doit être comprise entre 1 et 120 mois.");
  }

  if (input.discountType !== undefined) update.discountType = discountType;
  if (input.discountValue !== undefined) update.discountValue = normalizedDiscountValue.toFixed(2);
  if (input.validMonths !== undefined) update.validMonths = normalizedValidMonths;

  return update;
}
