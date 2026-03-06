import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  CardElement,
  PaymentRequestButtonElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.error('Missing VITE_STRIPE_PUBLIC_KEY environment variable');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CartItem {
  productId: number;
  quantity: number;
  price: string;
}

interface StripePaymentProps {
  amount: number;
  currency: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  cartItems?: CartItem[];
  voucherCode?: string | null;
}

function CheckoutForm({ amount, currency, onSuccess, onError, disabled, cartItems, voucherCode }: StripePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!stripe || !amount || amount <= 0) return;

    const pr = stripe.paymentRequest({
      country: 'RO',
      currency: currency.toLowerCase(),
      total: {
        label: 'xHACCP Order',
        amount: Math.round(amount * 100),
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setPaymentRequest(pr);
      }
    });

    pr.on('paymentmethod', async (ev) => {
      try {
        const response = await apiRequest("POST", "/api/payments/stripe/create-payment-intent", {
          amount: Math.round(amount * 100),
          currency: currency.toLowerCase(),
          cartItems: cartItems || [],
          voucherCode: voucherCode || null,
        });

        const { clientSecret } = await response.json();

        const { error, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id },
          { handleActions: false }
        );

        if (error) {
          ev.complete('fail');
          onError(error.message || "Payment failed");
        } else if (paymentIntent.status === 'requires_action') {
          ev.complete('success');
          const { error: actionError } = await stripe.confirmCardPayment(clientSecret);
          if (actionError) {
            onError(actionError.message || "Payment failed");
          } else {
            toast({
              title: "Payment Successful",
              description: "Your payment has been processed successfully.",
            });
            onSuccess(paymentIntent.id);
          }
        } else {
          ev.complete('success');
          toast({
            title: "Payment Successful",
            description: "Your payment has been processed successfully.",
          });
          onSuccess(paymentIntent.id);
        }
      } catch (err: any) {
        ev.complete('fail');
        onError(err.message || "Payment failed");
      }
    });
  }, [stripe, amount, currency]);

  const handleSubmit = async () => {
    if (!stripe || !elements || isLoading) return;

    setIsLoading(true);

    try {
      const response = await apiRequest("POST", "/api/payments/stripe/create-payment-intent", {
        amount: Math.round(amount * 100),
        currency: currency.toLowerCase(),
        cartItems: cartItems || [],
        voucherCode: voucherCode || null,
      });

      const { clientSecret } = await response.json();

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardElement,
        }
      });

      if (result.error) {
        toast({
          title: "Payment Failed",
          description: result.error.message,
          variant: "destructive",
        });
        onError(result.error.message || "Payment failed");
      } else {
        toast({
          title: "Payment Successful",
          description: "Your payment has been processed successfully.",
        });
        onSuccess(result.paymentIntent.id);
      }
    } catch (error: any) {
      toast({
        title: "Payment Failed",
        description: error.message || "Payment processing failed",
        variant: "destructive",
      });
      onError(error.message || "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {paymentRequest && (
        <div className="space-y-3">
          <PaymentRequestButtonElement
            options={{ paymentRequest }}
            className="w-full"
          />
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">
                or pay with card
              </span>
            </div>
          </div>
        </div>
      )}
      <div className="p-4 border rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#9e2146',
              },
            },
          }}
        />
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || isLoading || disabled}
        className="w-full"
      >
        {isLoading ? 'Processing...' : `Pay ${amount.toFixed(2)} ${currency}`}
      </Button>
    </div>
  );
}

export default function StripePayment(props: StripePaymentProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">$</span>
          </div>
          Secure Payment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-600 mb-4">
          Pay with card, Apple Pay, or Google Pay
          <div className="text-xs text-green-600 mt-1">
            ✅ Secure payment powered by Stripe
          </div>
        </div>
        <Elements stripe={stripePromise}>
          <CheckoutForm {...props} />
        </Elements>
      </CardContent>
    </Card>
  );
}
