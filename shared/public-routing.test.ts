import assert from "node:assert/strict";
import test from "node:test";
import {
  isAssetPath,
  isPrivateSpaPath,
  isPublicSpaPath,
  isViteInternalPath,
} from "./public-routing";

test("public SPA routing only permits exact public paths and one-segment detail routes", () => {
  for (const path of ["/", "/products", "/blog", "/about", "/terms", "/privacy", "/returns", "/mentions-legales", "/chef-event", "/newsletter/subscribe"]) {
    assert.equal(isPublicSpaPath(path), true, `${path} should be a public SPA route`);
  }
  for (const path of ["/products/one", "/blog/one"]) {
    assert.equal(isPublicSpaPath(path), true, `${path} should be a detail route`);
  }
  for (const path of [
    "/about-extra",
    "/b2b/extra",
    "/products/",
    "/products/one/",
    "/products/one/two",
    "/blog/one/two",
    "/products/%2Ftwo",
    "/blog/%5Ctwo",
  ]) {
    assert.equal(isPublicSpaPath(path), false, `${path} must not fall through to the SPA`);
  }
});

test("private and Vite internal routes remain explicitly supported", () => {
  for (const path of ["/admin", "/admin/orders", "/invoice/123", "/pay/session", "/auth/callback"]) {
    assert.equal(isPrivateSpaPath(path), true);
  }
  assert.equal(isPrivateSpaPath("/admin-extra"), false);
  assert.equal(isViteInternalPath("/@vite/client"), true);
  assert.equal(isViteInternalPath("/@id/react"), true);
  assert.equal(isViteInternalPath("/__vite_ping"), true);
  assert.equal(isViteInternalPath("/@something-else"), false);
});

test("paths that look like assets can be kept out of SPA HTML fallbacks", () => {
  assert.equal(isAssetPath("/assets/app.js"), true);
  assert.equal(isAssetPath("/products/label.png"), true);
  assert.equal(isAssetPath("/products/one"), false);
});