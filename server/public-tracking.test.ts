import test from "node:test";
import assert from "node:assert/strict";
import { buildPublicTrackingUrl, escapeHtml } from "./public-tracking";

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