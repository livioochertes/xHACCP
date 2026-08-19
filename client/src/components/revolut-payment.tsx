import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import RevolutCheckout from "@revolut/checkout";

interface RevolutPaymentProps {
  amount: number;
  currency: string;
  onSuccess: (paymentId: string) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

export default function RevolutPayment({
  amount,
  currency,
  onSuccess,
  onError,
  disabled = false,
}: RevolutPaymentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [paymentRequestInstance, setPaymentRequestInstance] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const paymentContainerRef = useRef<HTMLDivElement>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const initializeRealPayment = async () => {
      if (isInitialized) return; // Prevent multiple initializations
      
      try {
        const publicKey = import.meta.env.VITE_REVOLUT_PUBLIC_KEY;
        console.log("Initializing with public key:", publicKey?.substring(0, 10) + "...");
        
        if (!publicKey) {
          throw new Error("Revolut public key not found in environment variables");
        }
        
        // Initialize Revolut Checkout with real API
        const { paymentRequest } = await RevolutCheckout.payments({
          locale: "en",
          publicToken: publicKey,
        });

        // Create payment request instance for Apple Pay/Google Pay
        const instance = paymentRequest(paymentContainerRef.current!, {
          currency: currency.toUpperCase(),
          amount: Math.round(amount * 100), // Convert to cents
          createOrder: async () => {
            try {
              console.log("Creating Revolut order...");
              const response = await apiRequest("POST", "/api/payments/revolut/create-order", {
                amount: Math.round(amount * 100),
                currency: currency.toUpperCase(),
              });
              const order = await response.json();
              console.log("Order created:", order);
              return { publicId: order.token || order.public_id || order.id };
            } catch (error) {
              console.error("Failed to create order:", error);
              throw error;
            }
          },
          onSuccess: () => {
            console.log("Real payment successful!");
            toast({
              title: "Payment Successful",
              description: "Your payment has been processed successfully.",
            });
            onSuccess("revolut_payment_" + Date.now());
          },
          onError: (error: any) => {
            console.error("Payment error:", error);
            toast({
              title: "Payment Failed",
              description: error.message || "There was an error processing your payment.",
              variant: "destructive",
            });
            onError(error.message || "Payment failed");
          },
          onCancel: () => {
            toast({
              title: "Payment Cancelled",
              description: "Payment was cancelled by user.",
            });
          }
        });

        // Check if Apple Pay/Google Pay is available
        const method = await instance.canMakePayment();
        if (method) {
          console.log("Payment method available:", method);
          instance.render();
          setPaymentRequestInstance({ available: true, method, instance });
        } else {
          console.log("Apple Pay/Google Pay not available");
          instance.destroy();
          setPaymentRequestInstance({ available: false });
        }
        
        setIsInitialized(true);
      } catch (error) {
        const err = error as Error;
        console.error("Failed to initialize real payment:", err);
        console.error("Error details:", err.message, err.stack);
        setPaymentRequestInstance({ available: false, error: err.message });
        setIsInitialized(true);
      }
    };

    if (paymentContainerRef.current && amount > 0 && !isInitialized) {
      initializeRealPayment();
    }
  }, [amount, currency, onSuccess, onError, toast, isInitialized]);

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      if (paymentRequestInstance?.instance) {
        paymentRequestInstance.instance.destroy();
      }
    };
  }, [paymentRequestInstance]);

  const handleRegularPayment = async () => {
    if (isLoading) return; // Prevent multiple clicks
    
    console.log("Regular payment button clicked, amount:", amount, "currency:", currency);
    setIsLoading(true);
    
    try {
      const publicKey = import.meta.env.VITE_REVOLUT_PUBLIC_KEY;
      
      if (!publicKey) {
        throw new Error("Revolut public key not found");
      }

      // Create order first
      console.log("Creating Revolut card order...");
      const response = await apiRequest("POST", "/api/payments/revolut/create-order", {
        amount: Math.round(amount * 100),
        currency: currency.toUpperCase(),
      });
      const order = await response.json();
      console.log("Card order created:", order);

      // Clear any existing card payment form and show card container
      if (cardContainerRef.current) {
        cardContainerRef.current.innerHTML = '';
        cardContainerRef.current.style.display = 'block';
      }
      
      // Hide payment request buttons when showing card form
      if (paymentContainerRef.current) {
        paymentContainerRef.current.style.display = 'none';
      }

      // Create a real Revolut card payment
      const paymentsInstance = await RevolutCheckout.payments({
        locale: "en",
        publicToken: publicKey,
      });
      const card = (paymentsInstance as any).card as (target: HTMLElement | null, options: any) => any;

      const cardInstance = card(cardContainerRef.current, {
        publicId: order.token || order.public_id || order.id,
        onSuccess: () => {
          console.log("Real card payment successful!");
          toast({
            title: "Payment Successful",
            description: "Your card payment has been processed successfully.",
          });
          onSuccess("card_payment_" + Date.now());
          setIsLoading(false);
        },
        onError: (error: any) => {
          console.error("Card payment error:", error);
          toast({
            title: "Payment Failed",
            description: error.message || "There was an error processing your payment.",
            variant: "destructive",
          });
          onError(error.message || "Payment failed");
          // Reset display state on error
          if (cardContainerRef.current) {
            cardContainerRef.current.style.display = 'none';
          }
          if (paymentContainerRef.current) {
            paymentContainerRef.current.style.display = 'block';
          }
          setIsLoading(false);
        },
        onCancel: () => {
          toast({
            title: "Payment Cancelled",
            description: "Payment was cancelled by user.",
          });
          // Reset display state
          if (cardContainerRef.current) {
            cardContainerRef.current.style.display = 'none';
          }
          if (paymentContainerRef.current) {
            paymentContainerRef.current.style.display = 'block';
          }
          setIsLoading(false);
        }
      });

      cardInstance.render();
    } catch (error) {
      const err = error as Error;
      console.error("Failed to initialize card payment:", err);
      console.error("Card payment error details:", err.message, err.stack);
      toast({
        title: "Payment Error",
        description: err.message || "Failed to initialize payment system.",
        variant: "destructive",
      });
      // Reset display state on error
      if (cardContainerRef.current) {
        cardContainerRef.current.style.display = 'none';
      }
      if (paymentContainerRef.current) {
        paymentContainerRef.current.style.display = 'block';
      }
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          Revolut Pay
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-gray-600">
          Fast, secure payments with Revolut. Pay with Apple Pay, Google Pay, or any card.
        </div>
        
        {/* Real Payment Request Button Container (Apple Pay / Google Pay) */}
        <div ref={paymentContainerRef} className="min-h-[60px] border-2 border-dashed border-gray-200 rounded-lg p-4">
          {paymentRequestInstance?.available ? (
            <div className="text-center text-sm text-gray-500">
              Apple Pay / Google Pay buttons will appear here
            </div>
          ) : paymentRequestInstance?.available === false ? (
            <div className="text-center text-sm text-gray-500">
              Apple Pay / Google Pay not available on this device
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500">
              Loading payment options...
            </div>
          )}
        </div>
        
        {/* Card Payment Container */}
        <div ref={cardContainerRef} className="min-h-[200px] border-2 border-dashed border-gray-200 rounded-lg p-4" style={{ display: 'none' }}>
          <div className="text-center text-sm text-gray-500">
            Card payment form will appear here
          </div>
        </div>
        
        {/* Temporarily disabled card payment due to API issues */}
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-2">Card payment temporarily unavailable</div>
          <Button
            disabled={true}
            className="w-full bg-gray-400 cursor-not-allowed"
          >
            Card Payment (Coming Soon)
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            Please use Apple Pay/Google Pay above or select "Credit/Debit Card" for Stripe payment
          </p>
        </div>
        
        <div className="text-xs text-gray-500 text-center">
          Powered by Revolut - Real payment processing
          {paymentRequestInstance?.error && (
            <div className="text-red-500 text-xs mt-1">
              Error: {paymentRequestInstance.error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}