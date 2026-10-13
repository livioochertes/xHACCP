import type { RequestHandler, Response } from "express";
import { getMarketFromRequest } from "./market-routing";
import type { PaymentObservation } from "./payment-health-policy";
import { observePayment } from "./payment-health";

export function classifyPaymentResponse(input: {
  path: string; method: string; market: string; httpStatus: number;
  location?: string; code?: string; callbackException?: boolean;
  webhookAccepted?: boolean;
  callbackPending?: boolean;
  providerHttpStatus?: number; responseType?: string; reference?: string;
}): PaymentObservation | undefined {
  const match = input.path.match(/^\/api\/payments\/(viva|paypal)\/(create-order|callback|webhook)$/);
  if (!match) return;
  const provider = match[1] as "viva" | "paypal";
  const market = provider === "paypal" ? "fr" : input.market;
  if (!["ro", "fr", "com"].includes(market)) return;
  const stage: PaymentObservation["stage"] = match[2] === "create-order" ? "checkout" : match[2] as "callback" | "webhook";
  const base = { provider, market: market as PaymentObservation["market"], stage };
  if (input.httpStatus >= 500 || input.callbackException) {
    return {
      ...base,
      status: "error",
      httpStatus: input.providerHttpStatus ?? input.httpStatus,
      ...(input.responseType === undefined ? {} : { responseType: input.responseType }),
      ...(input.reference === undefined ? {} : { reference: input.reference }),
      code: input.code || `PAYMENT_${stage.toUpperCase()}_FAILED`,
    };
  }
  // Missing inputs, rejected vouchers/signatures, cancellations and card declines
  // are not evidence of a provider outage and must not clear an existing incident.
  if (input.httpStatus >= 400) return;
  if (stage === "webhook" && (input.method !== "POST" || (provider === "viva" && !input.webhookAccepted))) return;
  if (stage === "callback") {
    if (input.callbackPending) return;
    if (input.httpStatus < 300 || input.httpStatus >= 400 ||
        !input.location || /[?&](?:payment=(?:failed|error)|cancel=1)/.test(input.location)) return;
  } else if (input.httpStatus < 200 || input.httpStatus >= 300) return;
  return { ...base, status: "ok", httpStatus: input.httpStatus };
}

export function createPaymentHealthMiddleware(
  record: (observation: PaymentObservation) => Promise<void> = observePayment,
): RequestHandler {
  return (req, res, next) => {
    if (!/^\/api\/payments\/(?:viva|paypal)\/(?:create-order|callback|webhook)$/.test(req.path)) return next();
    let code: string | undefined;
    const json = res.json;
    res.json = function (body) {
      if (typeof body?.code === "string" && /^[A-Z0-9_]{1,80}$/.test(body.code)) code = body.code;
      return json.call(this, body);
    };
    const end = res.end;
    let ending = false;
    // Persist before completing the response so an autoscale instance cannot go
    // idle before recording an incident. Monitoring must never hold checkout indefinitely.
    res.end = function (this: Response, ...args: any[]) {
      if (ending) return this;
      ending = true;
      const observation = classifyPaymentResponse({
        path: req.path, method: req.method, market: res.locals.paymentHealthMarket || getMarketFromRequest(req),
        httpStatus: res.statusCode, location: String(res.getHeader("location") || ""),
        code, callbackException: res.locals.paymentHealthCallbackException === true,
        webhookAccepted: res.locals.paymentHealthWebhookAccepted === true,
        callbackPending: res.locals.paymentHealthCallbackPending === true,
        providerHttpStatus: res.locals.paymentHealthProviderHttpStatus,
        responseType: res.locals.paymentHealthResponseType,
        reference: res.locals.paymentHealthReference,
      });
      if (!observation) return (end as any).apply(this, args);
      let timer: ReturnType<typeof setTimeout>;
      const timeout = new Promise<void>(resolve => { timer = setTimeout(resolve, 2_000); timer.unref(); });
      void Promise.race([record(observation).catch(() => {
        console.error("[Payment Health] Response observation failed");
      }), timeout]).finally(() => {
        clearTimeout(timer!);
        (end as any).apply(res, args);
      });
      return this;
    } as typeof res.end;
    next();
  };
}
