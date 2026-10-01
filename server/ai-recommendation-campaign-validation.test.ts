import assert from "node:assert/strict";
import test from "node:test";
import { parseAIRecommendationCampaignInput } from "./ai-recommendation-campaign-validation";

const now = new Date("2026-01-01T00:00:00.000Z");
const validDates = {
  startsAt: "2026-01-02T00:00:00.000Z",
  endsAt: "2026-01-03T00:00:00.000Z",
};

test("accepts campaigns with two or three distinct products and a future end date", () => {
  for (const productIds of [[11, 12], [11, 12, 13]]) {
    const result = parseAIRecommendationCampaignInput({ productIds, ...validDates }, now);
    assert.deepEqual("error" in result ? result : result.productIds, productIds);
  }
});

test("rejects campaigns with fewer than two or more than three products", () => {
  for (const productIds of [[11], [11, 12, 13, 14], []]) {
    const result = parseAIRecommendationCampaignInput({ productIds, ...validDates }, now);
    assert.deepEqual(result, { error: "Choose two or three products" });
  }
});

test("rejects duplicate or invalid product IDs", () => {
  for (const productIds of [[11, 11], [11, 0], [11, ""]]) {
    const result = parseAIRecommendationCampaignInput({ productIds, ...validDates }, now);
    assert.equal("error" in result, true);
  }
});

test("rejects invalid, reversed, or already-ended schedules", () => {
  assert.equal(
    "error" in parseAIRecommendationCampaignInput({
      productIds: [11, 12],
      startsAt: "not-a-date",
      endsAt: validDates.endsAt,
    }, now),
    true,
  );
  assert.equal(
    "error" in parseAIRecommendationCampaignInput({
      productIds: [11, 12],
      startsAt: validDates.endsAt,
      endsAt: validDates.startsAt,
    }, now),
    true,
  );
  assert.equal(
    "error" in parseAIRecommendationCampaignInput({
      productIds: [11, 12],
      startsAt: "2025-12-01T00:00:00.000Z",
      endsAt: "2025-12-02T00:00:00.000Z",
    }, now),
    true,
  );
});