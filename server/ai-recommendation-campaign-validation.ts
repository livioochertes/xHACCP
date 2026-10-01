export interface ParsedAIRecommendationCampaignInput {
  productIds: number[];
  startsAt: Date;
  endsAt: Date;
}

export function parseAIRecommendationCampaignInput(
  body: unknown,
  now = new Date(),
): ParsedAIRecommendationCampaignInput | { error: string } {
  const values = typeof body === "object" && body !== null
    ? body as Record<string, unknown>
    : {};
  const rawProductIds = values.productIds;
  if (!Array.isArray(rawProductIds) || rawProductIds.length < 2 || rawProductIds.length > 3) {
    return { error: "Choose two or three products" };
  }

  const productIds = rawProductIds.map((id) =>
    typeof id === "string" && id.trim() === "" ? Number.NaN : Number(id),
  );
  if (productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return { error: "Product IDs must be positive integers" };
  }
  if (new Set(productIds).size !== productIds.length) {
    return { error: "A product can only be selected once" };
  }

  const toDate = (value: unknown): Date =>
    typeof value === "string" || typeof value === "number"
      ? new Date(value)
      : new Date(Number.NaN);
  const startsAt = toDate(values.startsAt);
  const endsAt = toDate(values.endsAt);
  if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(endsAt.getTime())) {
    return { error: "Valid start and end dates are required" };
  }
  if (endsAt <= startsAt) {
    return { error: "The end date must be after the start date" };
  }
  if (endsAt <= now) {
    return { error: "The end date must be in the future" };
  }

  return { productIds, startsAt, endsAt };
}