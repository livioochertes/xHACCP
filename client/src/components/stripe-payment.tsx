import { useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { SiStripe } from "react-icons/si";
import {
  CardCvcElement,
  CardExpiryElement,
  CardNumberElement,
  ExpressCheckoutElement,
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

interface StripePaymentFormProps extends StripePaymentProps {
  isProcessing: boolean;
  setIsProcessing: (isProcessing: boolean) => void;
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

function buildStripeRequestBody(props: StripePaymentProps) {
  return {
    market: props.market,
    currency: props.currency,
    cartItems: props.cartItems,
    voucherCode: props.voucherCode || null,
    orderData: props.orderData,
  };
}

async function createStripePaymentSession(props: StripePaymentProps) {
  const requestBody = buildStripeRequestBody(props);
  const fingerprint = JSON.stringify(requestBody);
  const attemptId = makeCheckoutAttemptId(fingerprint, props.market);
  saveVivaCheckoutDraft(getMarketFromHostname(), props.checkoutDraft());
  const response = await apiRequest("POST", "/api/payments/stripe/create-payment-intent", {
    ...requestBody,
    attemptId,
  });
  const setup = await response.json();
  if (!response.ok) {
    throw new Error(setup?.message || "Stripe could not prepare the payment");
  }
  return { setup, attemptId };
}

async function confirmStripeOrder(
  props: StripePaymentProps,
  setup: any,
  attemptId: string,
  paymentIntentId: string,
  toast: ReturnType<typeof useToast>["toast"],
) {
  const confirmation = await apiRequest("POST", "/api/payments/stripe/confirm", {
    paymentIntentId,
  });
  const confirmed = await confirmation.json();
  if (confirmed.status !== "paid" || Number(confirmed.orderId) !== Number(setup.orderId)) {
    throw new Error("The payment is still being verified. Please do not submit it again.");
  }
  clearCheckoutAttempt(props.market, attemptId);
  toast({
    title: "Payment successful",
    description: "Your payment has been confirmed.",
  });
  props.onSuccess(paymentIntentId, Number(setup.orderId));
}

function StripeCardForm(props: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!stripe || !elements || props.isProcessing || props.disabled) return;
    props.setIsProcessing(true);
    try {
      const { setup, attemptId } = await createStripePaymentSession(props);

      if (setup.alreadyPaid && setup.orderId && setup.paymentIntentId) {
        clearCheckoutAttempt(props.market, attemptId);
        props.onSuccess(setup.paymentIntentId, Number(setup.orderId));
        return;
      }
      if (!setup.clientSecret || !setup.paymentIntentId || !setup.orderId) {
        throw new Error("Stripe did not return a usable payment session");
      }

      const cardNumber = elements.getElement(CardNumberElement);
      if (!cardNumber) throw new Error("Card details are not available");
      const shipping = props.orderData.shippingAddress || {};
      const result = await stripe.confirmCardPayment(setup.clientSecret, {
        payment_method: {
          card: cardNumber,
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

      await confirmStripeOrder(props, setup, attemptId, result.paymentIntent.id, toast);
    } catch (error: any) {
      const message = error?.message || "Card payment could not be completed";
      toast({
        title: "Payment failed",
        description: message,
        variant: "destructive",
      });
      props.onError(message);
    } finally {
      props.setIsProcessing(false);
    }
  };

  const cardFieldOptions = {
    style: {
      base: {
        fontSize: "16px",
        lineHeight: "24px",
        color: "#243b35",
        "::placeholder": { color: "#87958f" },
      },
      invalid: { color: "#9e2146" },
    },
  };
  const cardFieldLabels = props.market === "fr"
    ? {
        number: "Numéro de carte",
        expiration: "Date d’expiration",
        securityCode: "Cryptogramme (CVC)",
        expirationPlaceholder: "MM / AA",
      }
    : props.market === "ro"
      ? {
          number: "Numărul cardului",
          expiration: "Data expirării",
          securityCode: "Cod de securitate (CVC)",
          expirationPlaceholder: "LL / AA",
        }
      : {
          number: "Card number",
          expiration: "Expiration date",
          securityCode: "Security code (CVC)",
          expirationPlaceholder: "MM / YY",
        };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-foreground">{cardFieldLabels.number}</span>
          <span className="flex min-h-12 items-center rounded-md border bg-background px-3 py-3">
            <CardNumberElement
              className="w-full"
              options={{ ...cardFieldOptions, showIcon: true, placeholder: "1234 1234 1234 1234" }}
            />
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">{cardFieldLabels.expiration}</span>
            <span className="flex min-h-12 items-center rounded-md border bg-background px-3 py-3">
              <CardExpiryElement
                className="w-full"
                options={{ ...cardFieldOptions, placeholder: cardFieldLabels.expirationPlaceholder }}
              />
            </span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-foreground">{cardFieldLabels.securityCode}</span>
            <span className="flex min-h-12 items-center rounded-md border bg-background px-3 py-3">
              <CardCvcElement
                className="w-full"
                options={{ ...cardFieldOptions, placeholder: "CVC" }}
              />
            </span>
          </label>
        </div>
      </div>
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!stripe || props.isProcessing || props.disabled}
        className="w-full"
      >
        {props.isProcessing ? "Processing…" : `Pay ${props.amount.toFixed(2)} ${props.currency}`}
      </Button>
    </div>
  );
}

function StripeWalletCheckout(props: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);

  const handleConfirm = async (event: Parameters<
    NonNullable<React.ComponentProps<typeof ExpressCheckoutElement>["onConfirm"]>
  >[0]) => {
    if (!stripe || !elements || props.isProcessing || props.disabled) {
      event.paymentFailed({ reason: "fail", message: "Checkout is temporarily unavailable." });
      return;
    }

    props.setIsProcessing(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message || "Check your payment details and try again.");
      }

      const { setup, attemptId } = await createStripePaymentSession(props);
      if (setup.alreadyPaid && setup.orderId && setup.paymentIntentId) {
        clearCheckoutAttempt(props.market, attemptId);
        props.onSuccess(setup.paymentIntentId, Number(setup.orderId));
        return;
      }
      if (!setup.clientSecret || !setup.paymentIntentId || !setup.orderId) {
        throw new Error("Stripe did not return a usable payment session");
      }

      const result = await stripe.confirmPayment({
        elements,
        clientSecret: setup.clientSecret,
        redirect: "if_required",
      });
      if (result.error) {
        throw new Error(result.error.message || "Wallet payment failed");
      }
      if (!result.paymentIntent || result.paymentIntent.status !== "succeeded") {
        throw new Error("Stripe has not confirmed the payment yet");
      }

      await confirmStripeOrder(props, setup, attemptId, result.paymentIntent.id, toast);
    } catch (error: any) {
      const message = error?.message || "Wallet payment could not be completed";
      event.paymentFailed({ reason: "fail", message });
      toast({
        title: "Payment failed",
        description: message,
        variant: "destructive",
      });
      props.onError(message);
    } finally {
      props.setIsProcessing(false);
    }
  };

  return (
    <div className={walletAvailable === false ? "hidden" : "space-y-3"}>
      <ExpressCheckoutElement
        onReady={({ availablePaymentMethods }) => {
          setWalletAvailable(Boolean(
            availablePaymentMethods?.applePay || availablePaymentMethods?.googlePay,
          ));
        }}
        onConfirm={handleConfirm}
        options={{
          buttonHeight: 48,
          buttonType: { applePay: "buy", googlePay: "buy" },
          buttonTheme: { applePay: "black", googlePay: "black" },
          layout: { maxColumns: 2, maxRows: 1, overflow: "never" },
          paymentMethods: {
            applePay: "always",
            googlePay: "always",
            amazonPay: "never",
            klarna: "never",
            link: "never",
            paypal: "never",
          },
        }}
      />
      {walletAvailable && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span>{props.market === "fr" ? "ou payer par carte" : props.market === "ro" ? "sau plătește cu cardul" : "or pay by card"}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
    </div>
  );
}

export default function StripePayment(props: StripePaymentProps) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  const [isProcessing, setIsProcessing] = useState(false);
  const formProps: StripePaymentFormProps = { ...props, isProcessing, setIsProcessing };
  const locale = props.market === "fr" ? "fr" : props.market === "ro" ? "ro" : "en";
  const walletElementsOptions = {
    mode: "payment" as const,
    amount: Math.max(0, Math.round(props.amount * 100)),
    currency: props.currency.toLowerCase(),
    setupFutureUsage: props.orderData.recurringConsent ? "off_session" as const : undefined,
    locale,
  } as const;
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SiStripe aria-hidden="true" className="h-7 w-7 text-[#635bff]" />
          <span><span className="font-semibold text-[#635bff]">Stripe</span> · {props.market === "fr" ? "Carte bancaire" : props.market === "ro" ? "Plată cu cardul" : "Credit or debit card"}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          {props.orderData.recurringConsent
            ? "Your card will be saved securely for the agreed subscription renewals."
            : "Card details are processed securely by Stripe."}
        </p>
        <div className="space-y-4">
          <Elements stripe={stripePromise} options={walletElementsOptions}>
            <StripeWalletCheckout {...formProps} />
          </Elements>
          <Elements stripe={stripePromise}>
            <StripeCardForm {...formProps} />
          </Elements>
        </div>
      </CardContent>
    </Card>
  );
}
