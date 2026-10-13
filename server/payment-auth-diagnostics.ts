const OAUTH_ERRORS = new Set([
  "invalid_client", "invalid_request", "invalid_grant", "unauthorized_client",
  "unsupported_grant_type", "invalid_scope", "server_error", "temporarily_unavailable",
]);

/** Only return fixed diagnostic fields; never expose the raw provider body. */
export function summarizePaymentProviderFailure(status: number, contentType: string, body: string) {
  const sample = body.slice(0, 8192);
  const isHtml = /text\/html/i.test(contentType) || /^\s*(?:<!doctype html|<html)/i.test(sample);
  let oauthError: string | undefined;
  try {
    const parsed = JSON.parse(sample);
    if (typeof parsed?.error === "string" && OAUTH_ERRORS.has(parsed.error)) {
      oauthError = parsed.error;
    }
  } catch {
    // HTML gateway refusals and malformed responses are classified separately.
  }
  const edgeAccessDenied = status === 403 && isHtml && /access denied/i.test(sample);
  const decoded = sample.replace(/&#(\d+);/g, (_, value) =>
    String.fromCharCode(Number(value)),
  );
  const edgeReference = edgeAccessDenied
    ? decoded.match(/Reference\s*#([\w.-]{1,120})(?=\s|<|$)/i)?.[1]
    : undefined;
  return {
    httpStatus: status,
    responseType: isHtml ? "html" : /application\/json/i.test(contentType) ? "json" : "other",
    kind: edgeAccessDenied ? "edge_access_denied" : oauthError ? "oauth_rejected" : "unclassified",
    oauthError,
    edgeReference,
  };
}
