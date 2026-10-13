import { getVivaCredentials, type VivaMarket } from "./viva-config";
import { withVivaUserAgent } from "./viva-http";
import { summarizePaymentProviderFailure } from "./payment-auth-diagnostics";
import { observePayment } from "./payment-health";

export async function getVivaAccessToken(market: VivaMarket, requestId?: string): Promise<string> {
  try {
    const credentials = getVivaCredentials(market);
    const clientId = credentials.clientId?.trim();
    const clientSecret = credentials.clientSecret?.trim();
    if (!clientId || !clientSecret) {
      await observePayment({ provider: "viva", market, stage: "auth", status: "error", code: "VIVA_AUTH_CONFIGURATION" });
      throw new Error(`Viva ${market} OAuth credentials not configured`);
    }
    const response = await fetch("https://accounts.vivapayments.com/connect/token", {
      method: "POST",
      headers: withVivaUserAgent({
        Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      }),
      body: "grant_type=client_credentials",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const diagnostic = summarizePaymentProviderFailure(response.status, response.headers.get("content-type") || "", await response.text());
      console.error(`[Viva ${requestId || "unknown"}] OAuth error:`, JSON.stringify(diagnostic));
      await observePayment({
        provider: "viva", market, stage: "auth", status: "error",
        code: diagnostic.kind === "edge_access_denied" ? "VIVA_AUTH_EDGE_ACCESS_DENIED" :
          `VIVA_AUTH_${(diagnostic.oauthError || "REJECTED").toUpperCase()}`,
        httpStatus: response.status, responseType: diagnostic.responseType, reference: diagnostic.edgeReference,
      });
      throw Object.assign(new Error(diagnostic.kind === "edge_access_denied"
        ? "Viva Production endpoint blocked the request: 403" : `Viva authentication failed: ${response.status}`),
      { paymentHealthObserved: true });
    }
    const body = await response.json() as { access_token?: string };
    if (typeof body.access_token !== "string" || !body.access_token) throw new Error("Viva returned no access token");
    await observePayment({ provider: "viva", market, stage: "auth", status: "ok", httpStatus: response.status });
    return body.access_token;
  } catch (error) {
    if (!(error as any)?.paymentHealthObserved && !(error instanceof Error && error.message.includes("not configured"))) {
      await observePayment({ provider: "viva", market, stage: "auth", status: "error", code: "VIVA_AUTH_REQUEST_FAILED" });
    }
    throw error;
  }
}
