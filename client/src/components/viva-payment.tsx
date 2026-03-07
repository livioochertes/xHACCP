import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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
}

export default function VivaPayment({ amount, currency, onError, disabled, cartItems, voucherCode, orderData }: VivaPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <CreditCard className="w-4 h-4 text-white" />
          </div>
          Secure Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-600 mb-4">
          Pay with card, Apple Pay, Google Pay or other methods
          <div className="text-xs text-green-600 mt-1">
            ✅ Secure payment powered by Viva
          </div>
        </div>
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-gray-50 text-sm text-gray-600">
            <p className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              You will be redirected to a secure payment page to complete your payment.
            </p>
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
                Redirecting to payment...
              </span>
            ) : (
              `Pay ${amount.toFixed(2)} ${currency}`
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
