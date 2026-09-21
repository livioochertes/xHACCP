import express from "express";
import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicTrackingUrl,
  escapeHtml,
  registerPublicTrackingRoute,
} from "./public-tracking";

test("public tracking URL uses the configured public application origin", () => {
  const previousUrl = process.env.PUBLIC_APP_URL;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.PUBLIC_APP_URL = "https://shop.example.test/";
  process.env.NODE_ENV = "production";

  try {
    assert.equal(
      buildPublicTrackingUrl("ord_abc/123"),
      "https://shop.example.test/tracking/ord_abc%2F123",
    );
  } finally {
    if (previousUrl === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = previousUrl;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
});

test("tracking URL is unavailable when the order has no public reference", () => {
  assert.equal(buildPublicTrackingUrl(undefined), null);
  assert.equal(buildPublicTrackingUrl(null), null);
});

test("tracking page values are HTML escaped", () => {
  assert.equal(
    escapeHtml(`<script>alert("x")</script>`),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
  );
});

interface TrackingResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

async function requestTrackingPage(
  app: express.Express,
  publicOrderRef: string,
): Promise<TrackingResponse> {
  const server = await new Promise<http.Server>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    return await new Promise<TrackingResponse>((resolve, reject) => {
      const request = http.get(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path: `/tracking/${encodeURIComponent(publicOrderRef)}`,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (chunk: Buffer) => chunks.push(chunk));
          response.on("end", () => resolve({
            statusCode: response.statusCode || 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          }));
        },
      );
      request.on("error", reject);
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

test("French public tracking route renders status, courier, and AWB without authentication", async () => {
  const app = express();
  let requestedReference = "";
  let requestedAwb = "";
  registerPublicTrackingRoute(app, {
    getOrderByPublicOrderRef: async (publicOrderRef) => {
      requestedReference = publicOrderRef;
      if (publicOrderRef !== "ord_fr_customer") return undefined;
      return {
        market: "fr",
        awbNumber: "MFB-FR-12345",
        awbCourier: "MyFlyingBox",
      };
    },
    createTrackingClient: () => ({
      getTracking: async (awbNumber) => {
        requestedAwb = awbNumber;
        return {
          status: "delivered",
          courier: "MyFlyingBox",
          tracking_number: awbNumber,
          events: [{ label: "Livré", occurred_at: "2026-09-20T10:30:00Z" }],
        };
      },
    }),
  });

  const response = await requestTrackingPage(app, "ord_fr_customer");

  assert.equal(response.statusCode, 200);
  assert.equal(requestedReference, "ord_fr_customer");
  assert.equal(requestedAwb, "MFB-FR-12345");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.match(response.headers["content-type"] || "", /text\/html/);
  assert.match(response.body, /lang="fr"/);
  assert.match(response.body, /&quot;status&quot;: &quot;delivered&quot;/);
  assert.match(response.body, /Transporteur :<\/strong> MyFlyingBox/);
  assert.match(response.body, /N° de suivi :<\/strong> MFB-FR-12345/);
  assert.match(response.body, /&quot;tracking_number&quot;: &quot;MFB-FR-12345&quot;/);
  assert.doesNotMatch(response.body, /other-customer@example\.test|MFB-OTHER-999/);
});

test("public tracking rejects missing and non-French references without calling the carrier", async () => {
  const app = express();
  const orders = new Map([
    ["ord_fr_missing_awb", { market: "fr", awbNumber: null, awbCourier: "MyFlyingBox" }],
    ["ord_ro_other_market", { market: "ro", awbNumber: "MFB-RO-999", awbCourier: "MyFlyingBox" }],
  ]);
  let carrierCalls = 0;
  registerPublicTrackingRoute(app, {
    getOrderByPublicOrderRef: async (publicOrderRef) => orders.get(publicOrderRef),
    createTrackingClient: () => ({
      getTracking: async () => {
        carrierCalls += 1;
        return { status: "delivered" };
      },
    }),
  });

  const missingResponse = await requestTrackingPage(app, "ord_unknown");
  const nonFrenchResponse = await requestTrackingPage(app, "ord_ro_other_market");
  const noAwbResponse = await requestTrackingPage(app, "ord_fr_missing_awb");

  for (const response of [missingResponse, nonFrenchResponse, noAwbResponse]) {
    assert.equal(response.statusCode, 404);
    assert.equal(response.body, "Suivi indisponible");
  }
  assert.equal(carrierCalls, 0);
});