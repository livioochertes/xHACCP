import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { Loader2 } from "lucide-react";
import { SiPaypal } from "react-icons/si";

export default function PayPalPayment({ amount, cartItems, voucherCode, orderData, disabled }: {
  amount: number; cartItems: any[]; voucherCode?: string | null; orderData: any; disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();
  const pay = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try {
      const response = await apiRequest("POST", "/api/payments/paypal/create-order", {
        cartItems, voucherCode: voucherCode || null, orderData,
      });
      const data = await response.json();
      if (!data.approvalUrl) throw new Error(t("checkout.paypalStartFailed"));
      trackEvent("payment_started", { value: amount, currency: "EUR", payment_method: "paypal", market: getMarketFromHostname() });
      try {
        const summary = localStorage.getItem("xhaccp_pending_order_summary");
        if (summary) localStorage.setItem("xhaccp_pending_order_summary", JSON.stringify({ ...JSON.parse(summary), orderId: data.dbOrderId }));
      } catch {}
      window.location.href = data.approvalUrl;
    } catch (error: any) {
      toast({ title: t("checkout.paymentFailed"), description: error.message || t("checkout.paypalStartFailed"), variant: "destructive" });
      setLoading(false);
    }
  };
  return <Card className="w-full border-[#d7e0eb]">
    <CardHeader><CardTitle className="flex items-center gap-2"><SiPaypal className="h-5 w-5 text-[#003087]" />PayPal</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("checkout.paypalDirectNotice")}</p>
      <Button type="button" onClick={pay} disabled={loading || disabled} className="w-full bg-[#ffc439] text-[#111] hover:bg-[#f2b900]">
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("checkout.redirectingToPayment")}</> : <><SiPaypal className="mr-2 h-4 w-4" />{t("checkout.payWithPaypal")} {amount.toFixed(2)} EUR</>}
      </Button>
    </CardContent>
  </Card>;
}