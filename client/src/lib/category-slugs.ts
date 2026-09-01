import { getMarketFromHostname } from "@/lib/queryClient";

const FRENCH_PUBLIC_CATEGORY_SLUGS: Record<string, string> = {
  "food-labels": "etiquettes-alimentaires",
};

export function getPublicCategorySlug(slug: string, market = getMarketFromHostname()): string {
  if (market !== "fr") return slug;
  return FRENCH_PUBLIC_CATEGORY_SLUGS[slug] || slug;
}

export function getCanonicalCategorySlug(slug: string, market = getMarketFromHostname()): string {
  if (market !== "fr") return slug;
  const match = Object.entries(FRENCH_PUBLIC_CATEGORY_SLUGS)
    .find(([, publicSlug]) => publicSlug === slug);
  return match?.[0] || slug;
}