import assert from "node:assert/strict";
import express from "express";
import type { Request, RequestHandler } from "express";
import test from "node:test";
import type {
  AIRecommendationCampaignRouteDependencies,
  MarketingEmailTestDependencies,
} from "./marketing-admin-routes";

// The production routes module starts refresh intervals during import. Keep
// those intervals from holding this isolated HTTP test process open.
const originalSetInterval = globalThis.setInterval;
globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
  const timer = originalSetInterval(...args);
  timer.unref();
  return timer;
}) as typeof globalThis.setInterval;
const { registerMarketingAdminRoutes } = await import("./marketing-admin-routes");
globalThis.setInterval = originalSetInterval;

const campaignUrl = "/admin/api/ai-recommendation-campaigns";
const sharedDates = {
  startsAt: "2031-04-01T00:00:00.000Z",
  endsAt: "2031-04-10T00:00:00.000Z",
};

type FixtureCampaign = {
  id: number;
  market: "ro" | "fr" | "com";
  productIds: number[];
  startsAt: Date;
  endsAt: Date;
  createdBy?: number;
};

function createHarness(
  initialCampaigns: FixtureCampaign[] = [],
  emailTestDependencies?: MarketingEmailTestDependencies,
) {
  const campaigns = initialCampaigns.map((campaign) => ({ ...campaign }));
  let nextId = Math.max(0, ...campaigns.map((campaign) => campaign.id)) + 1;
  const calls = {
    listedMarkets: [] as string[],
    overlaps: [] as Array<{ market: string; exceptId?: number }>,
    created: 0,
    updated: 0,
    deleted: 0,
  };
  const marketLockQueues = new Map<string, Promise<void>>();
  const withMarketLock = async <T>(market: string, save: () => Promise<T>): Promise<T> => {
    const previous = marketLockQueues.get(market) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    marketLockQueues.set(market, current);
    await previous;
    try {
      return await save();
    } finally {
      release();
      if (marketLockQueues.get(market) === current) marketLockQueues.delete(market);
    }
  };
  const hasOverlap = async (
    market: "ro" | "fr" | "com",
    startsAt: Date,
    endsAt: Date,
    exceptId?: number,
  ) => {
    calls.overlaps.push({ market, exceptId });
    return campaigns.some((campaign) =>
      campaign.market === market
      && campaign.id !== exceptId
      && campaign.startsAt < endsAt
      && campaign.endsAt > startsAt,
    );
  };
  const catalogByMarket = {
    ro: [{ id: 11, name: "Romania product", slug: "ro-product" }, { id: 12, name: "Romania product 2", slug: "ro-product-2" }],
    fr: [{ id: 21, name: "France product", slug: "fr-product" }, { id: 22, name: "France product 2", slug: "fr-product-2" }],
    com: [{ id: 31, name: "Global product", slug: "com-product" }, { id: 32, name: "Global product 2", slug: "com-product-2" }],
  };

  const authenticateAdmin: RequestHandler = (req, _res, next) => {
    const markets = req.get("x-test-markets") || "";
    Object.assign(req, {
      adminId: 7,
      adminMarkets: markets.split(",").filter(Boolean),
    });
    next();
  };
  const dependencies: AIRecommendationCampaignRouteDependencies = {
    authenticateAdmin,
    canAccessMarket: (req: Request, market) => {
      const allowedMarkets = (req as Request & { adminMarkets?: string[] }).adminMarkets || [];
      return allowedMarkets.length === 0 || allowedMarkets.includes(market);
    },
    getCatalogForMarket: (market) => catalogByMarket[market as keyof typeof catalogByMarket],
    listCampaigns: async (market) => {
      calls.listedMarkets.push(market);
      return campaigns.filter((campaign) => campaign.market === market);
    },
    findCampaign: async (id) => campaigns.find((campaign) => campaign.id === id),
    createCampaignIfNoOverlap: async (input) => withMarketLock(input.market, async () => {
      if (await hasOverlap(input.market, input.startsAt, input.endsAt)) {
        return { conflict: true };
      }
      calls.created++;
      const campaign: FixtureCampaign = { id: nextId++, ...input };
      campaigns.push(campaign);
      return { conflict: false, campaign };
    }),
    updateCampaignIfNoOverlap: async (id, market, input) => withMarketLock(market, async () => {
      if (await hasOverlap(market, input.startsAt, input.endsAt, id)) {
        return { conflict: true };
      }
      calls.updated++;
      const campaign = campaigns.find((item) => item.id === id);
      if (!campaign) throw new Error("Campaign fixture not found");
      Object.assign(campaign, input);
      return { conflict: false, campaign };
    }),
    deleteCampaign: async (id) => {
      calls.deleted++;
      const index = campaigns.findIndex((campaign) => campaign.id === id);
      if (index !== -1) campaigns.splice(index, 1);
    },
  };

  const app = express();
  app.use(express.json());
  registerMarketingAdminRoutes(app, dependencies, emailTestDependencies);
  const server = app.listen(0);

  const ready = new Promise<string>((resolve, reject) => {
    server.once("listening", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not bind to a TCP port"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
    server.once("error", reject);
  });

  return {
    campaigns,
    calls,
    ready,
    close: () => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    }),
    request: async (
      method: string,
      path: string,
      markets: string,
      body?: unknown,
    ) => {
      const baseUrl = await ready;
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          "x-test-markets": markets,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return {
        status: response.status,
        body: await response.json() as Record<string, any>,
      };
    },
  };
}

function fixtureCampaign(
  id: number,
  market: "ro" | "fr" | "com",
  startsAt = sharedDates.startsAt,
  endsAt = sharedDates.endsAt,
): FixtureCampaign {
  return {
    id,
    market,
    productIds: market === "fr" ? [21, 22] : [11, 12],
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
  };
}

test("blocks another-market admins from listing, creating, editing, or deleting AI campaigns", async (t) => {
  const harness = createHarness([fixtureCampaign(1, "fr")]);
  t.after(() => harness.close());
  const createBody = { market: "fr", productIds: [21, 22], ...sharedDates };
  const editBody = { productIds: [21, 22], ...sharedDates };

  const listed = await harness.request("GET", `${campaignUrl}?market=fr`, "ro");
  const created = await harness.request("POST", campaignUrl, "ro", createBody);
  const edited = await harness.request("PUT", `${campaignUrl}/1`, "ro", editBody);
  const deleted = await harness.request("DELETE", `${campaignUrl}/1`, "ro");

  assert.deepEqual([listed.status, created.status, edited.status, deleted.status], [403, 403, 403, 403]);
  assert.deepEqual(harness.calls.listedMarkets, []);
  assert.equal(harness.calls.created, 0);
  assert.equal(harness.calls.updated, 0);
  assert.equal(harness.calls.deleted, 0);
  assert.equal(harness.campaigns.length, 1);
});

test("allows identical dates in different markets and rejects an overlap in the same market", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const roCampaign = await harness.request("POST", campaignUrl, "ro", {
    market: "ro",
    productIds: [11, 12],
    ...sharedDates,
  });
  const frCampaign = await harness.request("POST", campaignUrl, "fr", {
    market: "fr",
    productIds: [21, 22],
    ...sharedDates,
  });
  const overlappingFranceCampaign = await harness.request("POST", campaignUrl, "fr", {
    market: "fr",
    productIds: [21, 22],
    startsAt: "2031-04-05T00:00:00.000Z",
    endsAt: "2031-04-12T00:00:00.000Z",
  });

  assert.equal(roCampaign.status, 201);
  assert.equal(frCampaign.status, 201);
  assert.equal(overlappingFranceCampaign.status, 409);
  assert.deepEqual(harness.campaigns.map((campaign) => campaign.market), ["ro", "fr"]);
  assert.deepEqual(harness.calls.overlaps.map(({ market }) => market), ["ro", "fr", "fr"]);
});

test("allows only one of two concurrent overlapping campaign creates", async (t) => {
  const harness = createHarness();
  t.after(() => harness.close());
  const body = { market: "fr", productIds: [21, 22], ...sharedDates };

  const responses = await Promise.all([
    harness.request("POST", campaignUrl, "fr", body),
    harness.request("POST", campaignUrl, "fr", body),
  ]);

  assert.deepEqual(responses.map(({ status }) => status).sort(), [201, 409]);
  assert.equal(harness.campaigns.length, 1);
  assert.equal(harness.calls.created, 1);
});

test("serializes overlapping create and edit requests in the same market", async (t) => {
  const harness = createHarness([
    fixtureCampaign(1, "fr", "2031-04-20T00:00:00.000Z", "2031-04-30T00:00:00.000Z"),
  ]);
  t.after(() => harness.close());

  const responses = await Promise.all([
    harness.request("POST", campaignUrl, "fr", {
      market: "fr",
      productIds: [21, 22],
      ...sharedDates,
    }),
    harness.request("PUT", `${campaignUrl}/1`, "fr", {
      productIds: [21, 22],
      ...sharedDates,
    }),
  ]);

  assert.equal(responses.filter(({ status }) => status === 409).length, 1);
  assert.equal(responses.filter(({ status }) => status === 200 || status === 201).length, 1);
  assert.equal(harness.calls.created + harness.calls.updated, 1);
});

test("allows only one of two concurrent overlapping campaign edits", async (t) => {
  const harness = createHarness([
    fixtureCampaign(1, "fr"),
    fixtureCampaign(2, "fr", "2031-04-20T00:00:00.000Z", "2031-04-30T00:00:00.000Z"),
  ]);
  t.after(() => harness.close());
  const body = { productIds: [21, 22], ...sharedDates };

  const responses = await Promise.all([
    harness.request("PUT", `${campaignUrl}/1`, "fr", body),
    harness.request("PUT", `${campaignUrl}/2`, "fr", body),
  ]);

  assert.deepEqual(responses.map(({ status }) => status).sort(), [200, 409]);
  assert.equal(harness.calls.updated, 1);
  assert.equal(
    harness.campaigns[0].startsAt < harness.campaigns[1].endsAt
      && harness.campaigns[0].endsAt > harness.campaigns[1].startsAt,
    false,
  );
});

test("checks update overlaps within the campaign market, excludes itself, and rejects foreign-market products", async (t) => {
  const franceCampaign = fixtureCampaign(1, "fr");
  const secondFranceCampaign = fixtureCampaign(
    2,
    "fr",
    "2031-04-11T00:00:00.000Z",
    "2031-04-20T00:00:00.000Z",
  );
  const harness = createHarness([franceCampaign, secondFranceCampaign, fixtureCampaign(3, "ro")]);
  t.after(() => harness.close());

  const selfUpdate = await harness.request("PUT", `${campaignUrl}/1`, "fr", {
    productIds: [21, 22],
    ...sharedDates,
  });
  const overlappingUpdate = await harness.request("PUT", `${campaignUrl}/2`, "fr", {
    productIds: [21, 22],
    startsAt: "2031-04-09T00:00:00.000Z",
    endsAt: "2031-04-15T00:00:00.000Z",
  });
  const foreignProductCreate = await harness.request("POST", campaignUrl, "fr", {
    market: "fr",
    productIds: [11, 12],
    startsAt: "2031-05-01T00:00:00.000Z",
    endsAt: "2031-05-10T00:00:00.000Z",
  });

  assert.equal(selfUpdate.status, 200);
  assert.equal(overlappingUpdate.status, 409);
  assert.deepEqual(harness.calls.overlaps.slice(0, 2), [
    { market: "fr", exceptId: 1 },
    { market: "fr", exceptId: 2 },
  ]);
  assert.equal(foreignProductCreate.status, 400);
  assert.equal(harness.calls.created, 0);
});

test("lists campaigns and products only for the requested market", async (t) => {
  const harness = createHarness([fixtureCampaign(1, "ro"), fixtureCampaign(2, "fr")]);
  t.after(() => harness.close());

  const response = await harness.request("GET", `${campaignUrl}?market=fr`, "fr");

  assert.equal(response.status, 200);
  assert.equal(response.body.market, "fr");
  assert.deepEqual(response.body.campaigns.map((campaign: FixtureCampaign) => campaign.market), ["fr"]);
  assert.deepEqual(response.body.products.map((product: { id: number }) => product.id), [21, 22]);
  assert.deepEqual(harness.calls.listedMarkets, ["fr"]);
});