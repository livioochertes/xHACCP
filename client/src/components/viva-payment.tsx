import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest } from '@/lib/queryClient';
import { getMarketFromHostname } from '@/lib/queryClient';
import { trackEvent } from '@/lib/analytics';
import { clearVivaCheckoutDraft, saveVivaCheckoutDraft, type VivaCheckoutDraftInput } from '@/lib/viva-checkout-draft';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';

interface CartItem {
  productId: number;
  quantity: number;
  price: string;
}

interface VivaPaymentProps {
  amount: number;
  currency: string;
  onError: (error: string) => void;
  disabled?: boolean;
  cartItems?: CartItem[];
  voucherCode?: string | null;
  orderData?: any;
  isFrenchMarket?: boolean;
  isRecurring?: boolean;
  checkoutDraft?: () => VivaCheckoutDraftInput;
}

export default function VivaPayment({ amount, currency, onError, disabled, cartItems, voucherCode, orderData, isFrenchMarket = false, isRecurring = false, checkoutDraft }: VivaPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    // Returning from Viva can restore this page from the browser's back-forward
    // cache, including the stale loading state from before the redirect.
    const handlePageShow = (event: PageTransitionEvent) => {
      setIsLoading(false);
      if (event.persisted) clearVivaCheckoutDraft(getMarketFromHostname());
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  const handlePayment = async () => {
    if (isLoading || disabled) return;
    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/payments/viva/create-order", {
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        cartItems: cartItems || [],
        voucherCode: voucherCode || null,
        orderData: orderData || null,
        allowRecurring: isRecurring,
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        try {
          if (checkoutDraft) saveVivaCheckoutDraft(getMarketFromHostname(), checkoutDraft());
        } catch {
          // A draft-storage issue must not prevent redirecting to the provider.
        }
        trackEvent("payment_started", {
          value: Number(amount.toFixed(2)),
          currency,
          payment_method: "viva",
          market: getMarketFromHostname(),
        });
        if (data.dbOrderId) {
          try {
            const stored = localStorage.getItem('xhaccp_pending_order_summary');
            if (stored) {
              const summary = JSON.parse(stored);
              summary.orderId = data.dbOrderId;
              if (!summary.buyerName && orderData?.buyerName) {
                summary.buyerName = orderData.buyerName;
              }
              localStorage.setItem('xhaccp_pending_order_summary', JSON.stringify(summary));
            }
          } catch (_) {}
        }
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      setIsLoading(false);
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
      onError(error.message || "Failed to initiate payment");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Secure Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <img src="https://developer.viva.com/images/new-payment-methods-logos/card,applepay,googlepay.svg" alt="Card, Apple Pay, Google Pay" className="h-9" />
          </div>
          <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 flex-shrink-0" />
              {t('checkout.vivaRedirectNotice')}
            </p>
          </div>
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <span>Secured by</span>
            <img src="https://developer.viva.com/images/new-payment-methods-logos/vivawallet.svg" alt="Viva Wallet" className="h-4" />
          </div>
          <Button
            type="button"
            onClick={handlePayment}
            disabled={isLoading || disabled}
            className="w-full"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('checkout.redirectingToPayment')}
              </span>
            ) : (
              `${t('checkout.pay')} ${amount.toFixed(2)} ${currency}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
