import { useEffect, useState } from "react";
import { Link } from "wouter";
import { AlertCircle, CheckCircle, Copy, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { usePageSeo } from "@/lib/use-page-seo";
import { getMarketFromHostname } from "@/lib/queryClient";
import { getPaymentEventName, getPaymentStatus, trackEvent } from "@/lib/analytics";

interface OrderSummary {
  orderId: number | null;
  buyerName?: string;
  subtotal: number;
  discountAmount: number;
  voucherCode: string | null;
  shipping: number;
  total: number;
  currencySymbol: string;
}

function readOrderSummary(): OrderSummary | null {
  try {
    const stored = localStorage.getItem("xhaccp_pending_order_summary");
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export default function ThankYou() {
  const { t } = useTranslation();
  const { clearCart } = useCart();
  const { toast } = useToast();
  const params = new URLSearchParams(window.location.search);
  const paymentResult = params.get("payment");
  const paymentStatus = getPaymentStatus(paymentResult);
  const paymentSuccessful = paymentStatus === "success";
  const paymentFailed = paymentStatus === "failed";
  const paymentStatusUnavailable = paymentStatus === "unavailable";
  const orderIdFromUrl = Number(params.get("orderId")) || null;
  const [summary] = useState<OrderSummary | null>(() => {
    if (!paymentSuccessful) return null;
    const stored = readOrderSummary();
    return stored
      ? { ...stored, orderId: orderIdFromUrl || stored.orderId }
      : null;
  });
  const orderId = paymentSuccessful ? orderIdFromUrl || summary?.orderId || null : null;

  usePageSeo({
    title: paymentStatusUnavailable
      ? "Statut du paiement | xHACCP"
      : paymentFailed
        ? "Paiement non abouti | xHACCP"
        : "Merci pour votre commande | xHACCP",
    description: paymentStatusUnavailable
      ? "Le statut de votre paiement n’a pas pu être confirmé."
      : paymentFailed
      ? "Le paiement de votre commande xHACCP n'a pas abouti."
      : "Votre commande xHACCP a été enregistrée avec succès.",
  });

  useEffect(() => {
    if (paymentStatusUnavailable) return;
    clearCart();
    window.scrollTo({ top: 0, behavior: "instant" });
    // This is intentionally mount-only: CartProvider recreates clearCart after
    // updates, so depending on its function identity would repeatedly clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentStatusUnavailable]);

  useEffect(() => {
    const eventName = getPaymentEventName(paymentResult);
    if (!eventName) return;

    const storageKey = `xhaccp_analytics_${paymentSuccessful ? "purchase" : "payment_failure"}_${orderId || "unknown"}`;
    try {
      if (sessionStorage.getItem(storageKey)) return;
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // Tracking can continue if sessionStorage is unavailable.
    }

    const eventData: Record<string, string | number | boolean> = {
      payment_method: paymentResult === "cash" ? "cash" : "viva",
      market: getMarketFromHostname(),
    };
    if (summary) {
      eventData.value = Number(summary.total.toFixed(2));
      eventData.currency = summary.currencySymbol;
    }

    trackEvent(eventName, eventData);
  }, [paymentResult, paymentSuccessful, orderId, summary]);

  return (
    <main className="min-h-[70vh] bg-slate-50 px-4 py-12">
      <Card className="max-w-lg mx-auto">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="flex justify-center">
            {paymentFailed ? (
              <XCircle className="h-16 w-16 text-red-500" />
            ) : paymentStatusUnavailable ? (
              <AlertCircle className="h-16 w-16 text-amber-500" />
            ) : (
              <CheckCircle className="h-16 w-16 text-green-500" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold mb-1">
              {paymentStatusUnavailable
                ? t("checkout.paymentStatusUnavailable")
                : paymentFailed
                  ? t("checkout.paymentFailed")
                  : t("checkout.orderSuccess")}
            </h1>
            <p className="text-muted-foreground text-sm">
              {paymentStatusUnavailable
                ? t("checkout.paymentStatusUnavailableDesc")
                : paymentFailed
                  ? t("checkout.paymentFailedDesc")
                  : t("checkout.orderSuccessDesc")}
            </p>
            {orderId && (
              <div className="mt-3 inline-flex items-center gap-1.5">
                <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                  <span className="text-green-600">#</span>{orderId}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(String(orderId));
                    toast({ description: "Copié !" });
                  }}
                  className="p-1 rounded hover:bg-green-100 text-green-700 transition-colors"
                  aria-label="Copier le numéro de commande"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {summary && (
            <div className="border rounded-lg p-4 text-left space-y-2">
              <h2 className="font-semibold text-sm mb-3">{t("checkout.orderSummary")}</h2>
              {summary.buyerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("checkout.buyerName")}:</span>
                  <span className="font-medium">{summary.buyerName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("checkout.subtotal")}:</span>
                <span>{summary.subtotal.toFixed(2)} {summary.currencySymbol}</span>
              </div>
              {summary.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>
                    {t("checkout.voucher")} {summary.voucherCode ? `(${summary.voucherCode})` : ""}:
                  </span>
                  <span>-{summary.discountAmount.toFixed(2)} {summary.currencySymbol}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("checkout.shipping")}:</span>
                <span>
                  {summary.shipping === 0
                    ? <Badge variant="secondary">{t("checkout.freeShipping")}</Badge>
                    : `${summary.shipping.toFixed(2)} ${summary.currencySymbol}`}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{t("checkout.total")}:</span>
                <span>{summary.total.toFixed(2)} {summary.currencySymbol}</span>
              </div>
            </div>
          )}

          <Link href={paymentStatusUnavailable ? "/checkout" : "/products"}>
            <Button className="kitchen-pro-secondary w-full">
              {paymentStatusUnavailable ? t("checkout.returnToCheckout") : t("checkout.backToShop")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}