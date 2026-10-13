import test from "node:test";
import assert from "node:assert/strict";
import { summarizePaymentProviderFailure } from "./payment-auth-diagnostics";

test("distinguishes credential rejection from an HTML edge refusal", () => {
  const invalidClient = summarizePaymentProviderFailure(401, "application/json", JSON.stringify({
    error: "invalid_client", error_description: "private-description", access_token: "private-token",
  }));
  assert.equal(invalidClient.kind, "oauth_rejected");
  assert.equal(invalidClient.oauthError, "invalid_client");
  assert.ok(!JSON.stringify(invalidClient).includes("private"));
  const edge = summarizePaymentProviderFailure(403, "text/html", "<HTML><H1>Access Denied</H1>Reference&#32;&#35;18.abc.123.def <P>private-body</P></HTML>");
  assert.equal(edge.kind, "edge_access_denied");
  assert.equal(edge.edgeReference, "18.abc.123.def");
  assert.ok(!JSON.stringify(edge).includes("private"));
});

test("never includes unexpected JSON fields or error contents", () => {
  const result = summarizePaymentProviderFailure(500, "application/json", JSON.stringify({
    error: "private-token", customer: "private-customer",
  }));
  assert.equal(result.kind, "unclassified");
  assert.equal(result.oauthError, undefined);
  assert.ok(!JSON.stringify(result).includes("private"));
});

test("malformed bodies and non-403 HTML are not attributed to an edge block", () => {
  assert.equal(summarizePaymentProviderFailure(500, "application/json", "{broken").kind, "unclassified");
  assert.equal(summarizePaymentProviderFailure(502, "text/html", "<html>Access Denied</html>").kind, "unclassified");
});
