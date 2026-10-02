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
import OrderContactDetails from "@/components/order-contact-details";

interface OrderSummary {
  orderId: number | null;
  buyerName?: string;
  email?: string;
  phone?: string;
  items?: OrderSummaryItem[];
  subtotal: number;
  subtotalNet?: number;
  discountAmount: number;
  discountNetAmount?: number;
  voucherCode: string | null;
  shipping: number;
  shippingNetAmount?: number;
  shippingDisplayAmount?: number;
  hasShippableItems?: boolean;
  vatAmount?: number;
  total: number;
  currencySymbol: string;
}

interface OrderSummaryItem {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  priceDisplayMode?: "net" | "gross";
}

function getItemPriceBasisLabel(item: OrderSummaryItem, market: string): string {
  const mode = item.priceDisplayMode ?? (market === "fr" ? "net" : "gross");
  if (mode === "net") {
    return market === "fr" ? "HT + TVA" : market === "ro" ? "Fără TVA + TVA" : "Excl. VAT + VAT";
  }
  return market === "fr" ? "TTC" : market === "ro" ? "TVA inclusă" : "Incl. VAT";
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
  const market = getMarketFromHostname();
  const { clearCart, isSessionExpired } = useCart();
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
  const recoveryRequired = !paymentSuccessful && isSessionExpired;

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
    if (!paymentSuccessful) return;
    clearCart();
    window.scrollTo({ top: 0, behavior: "instant" });
    // This is intentionally mount-only: CartProvider recreates clearCart after
    // updates, so depending on its function identity would repeatedly clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentSuccessful]);

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
      payment_method: paymentResult === "cash" ? "cash" : paymentResult === "paypal" ? "paypal" : "viva",
      market,
    };
    if (summary) {
      eventData.value = Number(summary.total.toFixed(2));
      eventData.currency = summary.currencySymbol;
    }

    trackEvent(eventName, eventData);
  }, [paymentResult, paymentSuccessful, orderId, summary, market]);

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
              <OrderContactDetails email={summary.email} phone={summary.phone} />
              {summary.items && summary.items.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <h3 className="font-semibold text-sm mb-3">{t("checkout.purchasedProducts")}</h3>
                  <div className="space-y-3">
                    {summary.items.map((item, index) => (
                      <div
                        key={`${item.productId}-${index}`}
                        className="flex items-start justify-between gap-4 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-muted-foreground text-xs">
                            {item.quantity} × {Number(item.unitPrice).toFixed(2)} {summary.currencySymbol}
                            <span className="ml-1">{getItemPriceBasisLabel(item, market)}</span>
                          </p>
                        </div>
                        <span className="font-medium whitespace-nowrap">
                          {Number(item.totalPrice).toFixed(2)} {summary.currencySymbol}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {getMarketFromHostname() === "fr" ? "Produits HT" : getMarketFromHostname() === "ro" ? "Produse fără TVA" : "Products excl. VAT"}:
                </span>
                <span>{(summary.subtotalNet ?? summary.subtotal).toFixed(2)} {summary.currencySymbol}</span>
              </div>
              {(summary.discountNetAmount ?? summary.discountAmount) > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>
                    {getMarketFromHostname() === "fr" ? "Remise HT" : getMarketFromHostname() === "ro" ? "Reducere fără TVA" : "Discount excl. VAT"} {summary.voucherCode ? `(${summary.voucherCode})` : ""}:
                  </span>
                  <span>-{(summary.discountNetAmount ?? summary.discountAmount).toFixed(2)} {summary.currencySymbol}</span>
                </div>
              )}
              {summary.hasShippableItems !== false && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {market === "fr" ? "Livraison HT" : market === "ro" ? "Livrare cu TVA" : "Shipping incl. VAT"}:
                  </span>
                  <span>
                    {summary.shipping === 0
                      ? <Badge variant="secondary">{t("checkout.freeShipping")}</Badge>
                      : `${(summary.shippingDisplayAmount ?? (market === "fr" ? summary.shippingNetAmount ?? summary.shipping : summary.shipping)).toFixed(2)} ${summary.currencySymbol}`}
                  </span>
                </div>
              )}
              {summary.vatAmount != null && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{getMarketFromHostname() === "fr" ? "TVA" : getMarketFromHostname() === "ro" ? "TVA" : "VAT"}:</span>
                  <span>{summary.vatAmount.toFixed(2)} {summary.currencySymbol}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>{getMarketFromHostname() === "fr" ? "Total TTC" : getMarketFromHostname() === "ro" ? "Total cu TVA" : "Total incl. VAT"}:</span>
                <span>{summary.total.toFixed(2)} {summary.currencySymbol}</span>
              </div>
            </div>
          )}

          {recoveryRequired && (
            <div
              role="alert"
              className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-left"
            >
              <p className="text-sm text-amber-900">{t("messages.sessionExpired")}</p>
              <Link href="/login?returnTo=/checkout">
                <Button className="mt-3 w-full" variant="outline">
                  {t("auth.signIn")}
                </Button>
              </Link>
            </div>
          )}

          <Link href={paymentSuccessful ? "/products" : recoveryRequired ? "/login?returnTo=/checkout" : "/checkout"}>
            <Button className="kitchen-pro-secondary w-full">
              {paymentSuccessful
                ? t("checkout.backToShop")
                : recoveryRequired
                  ? t("auth.signIn")
                  : t("checkout.returnToCheckout")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}