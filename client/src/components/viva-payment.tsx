import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { apiRequest } from '@/lib/queryClient';
import { CreditCard, Loader2, ExternalLink } from 'lucide-react';
import { SiPaypal } from 'react-icons/si';

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
}

export default function VivaPayment({ amount, currency, onError, disabled, cartItems, voucherCode, orderData, isFrenchMarket = false }: VivaPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

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
      });

      const data = await response.json();

      if (data.checkoutUrl) {
        if (data.dbOrderId) {
          try {
            const stored = localStorage.getItem('xhaccp_pending_order_summary');
            if (stored) {
              const summary = JSON.parse(stored);
              summary.orderId = data.dbOrderId;
              localStorage.setItem('xhaccp_pending_order_summary', JSON.stringify(summary));
            }
          } catch (_) {}
        }
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      toast({
        title: "Payment Error",
        description: error.message || "Failed to initiate payment",
        variant: "destructive",
      });
      onError(error.message || "Failed to initiate payment");
      setIsLoading(false);
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
            {isFrenchMarket && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-[#d7e0eb] bg-white px-2.5 py-1.5 text-[#003087]">
                <SiPaypal className="h-6 w-6" aria-hidden="true" />
                <span className="text-sm font-semibold">PayPal</span>
              </div>
            )}
          </div>
          {isFrenchMarket && (
            <div className="rounded-lg border border-[#d7e0eb] bg-[#f5f8fc] p-4 text-sm text-slate-700">
              <p className="font-medium">{t('checkout.paypalAvailable')}</p>
              <p className="mt-1 text-slate-600">{t('checkout.paypalAvailableDesc')}</p>
            </div>
          )}
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
