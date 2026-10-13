import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { saveVivaCheckoutDraft } from "@/lib/viva-checkout-draft";

interface CartItem {
  productId: number;
  quantity: number;
  price: string;
  compositeConfiguration?: unknown;
}

interface StripePaymentProps {
  amount: number;
  currency: string;
  publishableKey: string;
  market: string;
  onSuccess: (paymentId: string, orderId: number) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  cartItems: CartItem[];
  voucherCode?: string | null;
  orderData: Record<string, any>;
  checkoutDraft: () => {
    step: number;
    formValues: Record<string, unknown>;
    voucherInput: string;
    appliedVoucherCode: string | null;
  };
}

function makeCheckoutAttemptId(fingerprint: string, market: string) {
  const key = `xhaccp-stripe-attempt-${market}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) {
      const parsed = JSON.parse(existing) as { id?: string; fingerprint?: string };
      if (parsed.fingerprint === fingerprint && parsed.id) return parsed.id;
    }
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, JSON.stringify({ id, fingerprint }));
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function clearCheckoutAttempt(market: string, attemptId: string) {
  const key = `xhaccp-stripe-attempt-${market}`;
  try {
    const existing = JSON.parse(sessionStorage.getItem(key) || "{}");
    if (existing.id === attemptId) sessionStorage.removeItem(key);
  } catch {
    sessionStorage.removeItem(key);
  }
}

function StripeCardForm(props: StripePaymentProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!stripe || !elements || isLoading || props.disabled) return;
    setIsLoading(true);
    const requestBody = {
      market: props.market,
      currency: props.currency,
      cartItems: props.cartItems,
      voucherCode: props.voucherCode || null,
      orderData: props.orderData,
    };
    const fingerprint = JSON.stringify(requestBody);
    const attemptId = makeCheckoutAttemptId(fingerprint, props.market);
    try {
      saveVivaCheckoutDraft(getMarketFromHostname(), props.checkoutDraft());
      const response = await apiRequest("POST", "/api/payments/stripe/create-payment-intent", {
        ...requestBody,
        attemptId,
      });
      const setup = await response.json();

      if (setup.alreadyPaid && setup.orderId && setup.paymentIntentId) {
        clearCheckoutAttempt(props.market, attemptId);
        props.onSuccess(setup.paymentIntentId, Number(setup.orderId));
        return;
      }
      if (!setup.clientSecret || !setup.paymentIntentId || !setup.orderId) {
        throw new Error("Stripe did not return a usable payment session");
      }

      const card = elements.getElement(CardElement);
      if (!card) throw new Error("Card details are not available");
      const shipping = props.orderData.shippingAddress || {};
      const result = await stripe.confirmCardPayment(setup.clientSecret, {
        payment_method: {
          card,
          billing_details: {
            name: `${shipping.firstName || ""} ${shipping.lastName || ""}`.trim() || undefined,
            email: shipping.email || props.orderData.billingAddress?.email || undefined,
            phone: shipping.phone || undefined,
            address: {
              line1: shipping.address || undefined,
              city: shipping.city || undefined,
              postal_code: shipping.zipCode || undefined,
              country: shipping.countryCode || undefined,
            },
          },
        },
      });
      if (result.error) throw new Error(result.error.message || "Card payment failed");
      if (!result.paymentIntent || result.paymentIntent.status !== "succeeded") {
        throw new Error("Stripe has not confirmed the payment yet");
      }

      const confirmation = await apiRequest("POST", "/api/payments/stripe/confirm", {
        paymentIntentId: result.paymentIntent.id,
      });
      const confirmed = await confirmation.json();
      if (confirmed.status !== "paid" || Number(confirmed.orderId) !== Number(setup.orderId)) {
        throw new Error("The payment is still being verified. Please do not submit it again.");
      }
      clearCheckoutAttempt(props.market, attemptId);
      toast({
        title: "Payment successful",
        description: "Your card payment has been confirmed.",
      });
      props.onSuccess(result.paymentIntent.id, Number(setup.orderId));
    } catch (error: any) {
      const message = error?.message || "Card payment could not be completed";
      toast({
        title: "Payment failed",
        description: message,
        variant: "destructive",
      });
      props.onError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4">
        <CardElement
          options={{
            hidePostalCode: true,
            style: {
              base: {
                fontSize: "16px",
                color: "#243b35",
                "::placeholder": { color: "#87958f" },
              },
              invalid: { color: "#9e2146" },
            },
          }}
        />
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || isLoading || props.disabled}
        className="w-full"
      >
        {isLoading ? "Processing…" : `Pay ${props.amount.toFixed(2)} ${props.currency}`}
      </Button>
    </div>
  );
}

export default function StripePayment(props: StripePaymentProps) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#635bff] text-sm font-bold text-white">S</span>
          Stripe · credit or debit card
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {props.orderData.recurringConsent
            ? "Your card will be saved securely for the agreed subscription renewals."
            : "Card details are processed securely by Stripe."}
        </p>
        <Elements stripe={stripePromise}>
          <StripeCardForm {...props} />
        </Elements>
      </CardContent>
    </Card>
  );
}
