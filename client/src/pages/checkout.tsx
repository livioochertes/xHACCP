import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CreditCard, Truck, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import Header from "@/components/header";
import RevolutPayment from "@/components/revolut-payment";
import StripePayment from "@/components/stripe-payment";
import { getCountyOptions, getCitiesForCounty, getCountryOptions, romanianCounties } from "@/utils/location-data";

const shippingAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  company: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  county: z.string().min(1, "County (Județ) is required"), // Always mandatory for shipping
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().min(1, "Phone number is required"),
});

const billingAddressSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  company: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  county: z.string().optional(), // Optional for billing - will be copied from shipping when same
  zipCode: z.string().min(1, "ZIP code is required"),
  country: z.string().min(1, "Country is required"),
  phone: z.string().min(1, "Phone number is required"),
});

const checkoutSchema = z.object({
  email: z.string().email("Invalid email address"),
  phone: z.string().min(1, "Phone number is required"),
  shippingAddress: shippingAddressSchema,
  billingAddress: billingAddressSchema,
  paymentMethod: z.enum(["revolut", "stripe", "paypal", "cash"]),
  sameAsBilling: z.boolean().default(false),
  notes: z.string().optional(),
}).refine((data) => {
  // When billing address is different from shipping, county becomes required
  if (!data.sameAsBilling && !data.billingAddress.county) {
    return false;
  }
  return true;
}, {
  message: "County (Județ) is required for Romanian invoices when using different billing address",
  path: ["billingAddress", "county"]
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

export default function Checkout() {
  const { user, isAuthenticated } = useAuth();
  const [step, setStep] = useState(isAuthenticated ? 2 : 1); // Skip contact info for logged-in users
  const [, navigate] = useLocation();
  const { cart, clearCart } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Voucher state
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<{
    id: number;
    code: string;
    name: string;
    discountType: string;
    discountValue: string;
    discountAmount: string;
  } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState("");

  // Fetch shipping settings (includes VAT percentage)
  const { data: shippingSettings } = useQuery({
    queryKey: ['/api/shipping-settings'],
    queryFn: async () => {
      const response = await fetch('/api/shipping-settings');
      if (!response.ok) throw new Error('Failed to fetch shipping settings');
      return response.json();
    },
  });
  
  // Get VAT percentage from shipping settings (stored as "21.00" format, convert to decimal like 0.21)
  const vatPercentage = shippingSettings?.vatPercentage 
    ? parseFloat(shippingSettings.vatPercentage) / 100 
    : 0.19;

  // Helper function to get default form values
  const getDefaultFormValues = (): CheckoutFormData => {
    if (isAuthenticated && user) {
      // Pre-populate with user data for authenticated users
      return {
        email: user.email || "",
        phone: user.billingPhone || user.phone || "",
        shippingAddress: {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          company: user.companyName || "",
          address: user.deliveryAddress || user.companyAddress || "",
          city: user.deliveryCity || user.companyCity || "",
          state: user.deliveryState || user.companyState || "",
          county: user.deliveryCounty || user.companyCounty || "",
          zipCode: user.deliveryZip || user.companyZip || "",
          country: user.deliveryCountry || user.companyCountry || "Romania",
          phone: user.billingPhone || "",
        },
        billingAddress: {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          company: user.companyName || "",
          address: user.companyAddress || "",
          city: user.companyCity || "",
          state: user.companyState || "",
          county: user.companyCounty || "",
          zipCode: user.companyZip || "",
          country: user.companyCountry || "Romania",
          phone: user.billingPhone || "",
        },
        paymentMethod: "cash",
        sameAsBilling: !user.deliveryAddress, // Default to same if no separate delivery address
        notes: "",
      };
    }
    
    // Default empty values for guest users
    return {
      email: "",
      phone: "",
      shippingAddress: {
        firstName: "",
        lastName: "",
        company: "",
        address: "",
        city: "",
        state: "",
        county: "",
        zipCode: "",
        country: "Romania",
        phone: "",
      },
      billingAddress: {
        firstName: "",
        lastName: "",
        company: "",
        address: "",
        city: "",
        state: "",
        county: "",
        zipCode: "",
        country: "Romania",
        phone: "",
      },
      paymentMethod: "cash",
      sameAsBilling: false,
      notes: "",
    };
  };

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: getDefaultFormValues(),
  });

  // Update form values when user data becomes available
  useEffect(() => {
    if (isAuthenticated && user) {
      const defaultValues = getDefaultFormValues();
      form.reset(defaultValues);
      // Skip to address step for authenticated users
      if (step === 1) {
        setStep(2);
      }
    }
  }, [isAuthenticated, user, form]);

  const sameAsBilling = form.watch("sameAsBilling");

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutFormData) => {
      const token = localStorage.getItem("token");
      const orderItems = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.product.price,
        totalPrice: (parseFloat(item.product.price) * item.quantity).toString(),
      }));

      const shippingAddr = { ...data.shippingAddress };
      if (!shippingAddr.phone && data.phone) {
        shippingAddr.phone = data.phone;
      }
      const billingAddr = sameAsBilling ? shippingAddr : { ...data.billingAddress };
      if (!billingAddr.phone && data.phone) {
        billingAddr.phone = data.phone;
      }

      return await apiRequest("POST", "/api/orders", {
        shippingAddress: shippingAddr,
        billingAddress: billingAddr,
        paymentMethod: data.paymentMethod,
        items: orderItems,
        notes: data.notes,
        voucherCode: appliedVoucher?.code || null,
        contactPhone: data.phone,
      });
    },
    onSuccess: (data) => {
      clearCart();
      toast({
        title: "Order placed successfully!",
        description: "Thank you for your order. You will receive a confirmation email shortly.",
      });
      navigate("/");
    },
    onError: (error) => {
      toast({
        title: "Order failed",
        description: "There was an error placing your order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const subtotal = cart.reduce((sum, item) => {
    if (!item.product || !item.product.price) return sum;
    return sum + (parseFloat(item.product.price) * item.quantity);
  }, 0);

  const freeShippingThreshold = shippingSettings ? parseFloat(shippingSettings.freeShippingThreshold) : 500;
  const standardShippingCost = shippingSettings ? parseFloat(shippingSettings.standardShippingCost) : 25;
  const currency = shippingSettings?.currency || 'EUR';
  
  const shipping = subtotal > freeShippingThreshold ? 0 : standardShippingCost;
  const total = subtotal + shipping;

  // Currency symbol helper
  const getCurrencySymbol = (curr: string) => {
    const symbols: { [key: string]: string } = { 'EUR': '€', 'RON': 'lei', 'USD': '$', 'GBP': '£' };
    return symbols[curr] || curr;
  };
  
  // Determine currency from cart items (use first product's currency or fallback to company default)
  const cartCurrency = cart.length > 0 && cart[0].product?.currency ? cart[0].product.currency : currency;
  const currencySymbol = cartCurrency === 'RON' ? 'lei' : getCurrencySymbol(cartCurrency);
  
  // Calculate voucher discount (applies only to product subtotal, not shipping)
  const voucherDiscount = appliedVoucher ? parseFloat(appliedVoucher.discountAmount) : 0;
  
  // Apply discount to subtotal only (voucher applies to products, not shipping)
  const discountedSubtotal = Math.max(0, subtotal - voucherDiscount);
  
  // Final total = discounted subtotal + shipping (NO VAT added - prices already include VAT)
  const finalTotal = discountedSubtotal + shipping;
  
  // VAT display percentage (for UI display)
  const vatDisplayPercentage = Math.round(vatPercentage * 100);
  
  // VAT is INCLUDED in prices - calculate for display only (reverse VAT calculation)
  // Formula: VAT = Total * (vatRate / (1 + vatRate))
  const vatIncludedInFinal = finalTotal * (vatPercentage / (1 + vatPercentage));
  
  // Apply voucher function
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherError("Please enter a voucher code");
      return;
    }
    
    setVoucherLoading(true);
    setVoucherError("");
    
    try {
      const response = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code: voucherCode.trim(), 
          orderTotal: subtotal.toString() 
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.valid) {
        setAppliedVoucher(data.voucher);
        setVoucherCode("");
        toast({
          title: "Voucher Applied!",
          description: `Discount of ${data.voucher.discountAmount} ${currencySymbol} applied.`,
        });
      } else {
        setVoucherError(data.message || "Invalid voucher code");
      }
    } catch (err) {
      console.error("Error validating voucher:", err);
      setVoucherError("Failed to validate voucher. Please try again.");
    } finally {
      setVoucherLoading(false);
    }
  };
  
  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError("");
  };

  const handleNext = async (e?: React.MouseEvent) => {
    e?.preventDefault(); // Prevent any default form behavior
    console.log("handleNext called, current step:", step);
    
    let fieldsToValidate: any[] = [];
    
    if (step === 1 && !isAuthenticated) {
      // Guest users need to validate email and phone on step 1
      fieldsToValidate = ["email", "phone"];
    } else if ((step === 1 && isAuthenticated) || (step === 2)) {
      // Address validation for authenticated users on step 1 or guest users on step 2
      fieldsToValidate = [
        "shippingAddress.firstName",
        "shippingAddress.lastName", 
        "shippingAddress.address",
        "shippingAddress.city",
        "shippingAddress.state",
        "shippingAddress.county", // Always required for shipping
        "shippingAddress.zipCode",
        "shippingAddress.country",
        "shippingAddress.phone"
      ];
      
      // Only validate billing address if it's different from shipping
      if (!sameAsBilling) {
        fieldsToValidate.push(
          "billingAddress.firstName",
          "billingAddress.lastName",
          "billingAddress.address", 
          "billingAddress.city",
          "billingAddress.state",
          "billingAddress.county", // Required when billing is different
          "billingAddress.zipCode",
          "billingAddress.country",
          "billingAddress.phone"
        );
      }
    }
    
    const isValid = await form.trigger(fieldsToValidate);
    console.log("Validation result:", isValid, "will go to step:", step + 1);
    
    if (isValid) {
      if (step === 1 && !isAuthenticated) {
        const contactPhone = form.getValues("phone");
        if (contactPhone && !form.getValues("shippingAddress.phone")) {
          form.setValue("shippingAddress.phone", contactPhone);
        }
        if (contactPhone && !form.getValues("billingAddress.phone")) {
          form.setValue("billingAddress.phone", contactPhone);
        }
      }
      setStep(step + 1);
    }
  };

  const handleSubmit = (data: CheckoutFormData) => {
    // Only submit if we're on the final payment step
    if (step !== 3) {
      console.log("Form submitted but not on payment step, ignoring");
      return;
    }
    console.log("Submitting order from payment step");
    createOrderMutation.mutate(data);
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="text-center py-16">
            <CardContent>
              <h2 className="text-2xl font-semibold mb-2">Your cart is empty</h2>
              <p className="text-muted-foreground mb-6">
                Add some products to your cart before checkout
              </p>
              <Link href="/products">
                <Button size="lg" className="kitchen-pro-secondary">
                  Continue Shopping
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center space-x-2 mb-8">
          <Link href="/cart">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cart
            </Button>
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            {isAuthenticated ? (
              // For authenticated users: only Address and Payment steps
              <>
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= 2
                        ? "kitchen-pro-secondary text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    1
                  </div>
                  <div className="ml-2 text-sm">Address</div>
                </div>
                <div
                  className={`w-16 h-0.5 ${
                    step >= 3 ? "bg-blue-500" : "bg-slate-200"
                  }`}
                />
                <div className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step >= 3
                        ? "kitchen-pro-secondary text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    2
                  </div>
                  <div className="ml-2 text-sm">Payment</div>
                </div>
              </>
            ) : (
              // For guest users: Contact, Address, and Payment steps
              <>
                {[
                  { num: 1, label: "Contact" },
                  { num: 2, label: "Address" },
                  { num: 3, label: "Payment" }
                ].map((stepInfo, index) => (
                  <div key={stepInfo.num} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        stepInfo.num <= step
                          ? "kitchen-pro-secondary text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {stepInfo.num}
                    </div>
                    <div className="ml-2 text-sm">{stepInfo.label}</div>
                    {index < 2 && (
                      <div
                        className={`w-16 h-0.5 mx-2 ${
                          stepInfo.num < step ? "bg-blue-500" : "bg-slate-200"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Form {...form}>
              <form 
                onSubmit={(e) => {
                  console.log("Form submit event triggered, current step:", step);
                  if (step !== 3) {
                    console.log("Preventing form submission - not on payment step");
                    e.preventDefault();
                    return false;
                  }
                  form.handleSubmit(handleSubmit)(e);
                }} 
                className="space-y-6"
              >
                {/* Contact Information Step - Only for guest users */}
                {step === 1 && !isAuthenticated && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address</FormLabel>
                            <FormControl>
                              <Input placeholder="your@email.com" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input placeholder="+40 7XX XXX XXX" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* For authenticated users, show user info summary */}
                {isAuthenticated && user && step === 2 && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        Account Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <p><strong>Email:</strong> {user.email}</p>
                        {user.companyName && <p><strong>Company:</strong> {user.companyName}</p>}
                        <p className="mt-2 text-xs">Your saved address information will be pre-filled below. You can modify it if needed.</p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Truck className="h-5 w-5 mr-2" />
                          Shipping Address
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="shippingAddress.firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="shippingAddress.lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="shippingAddress.company"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Company (Optional)</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="shippingAddress.address"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Address</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="shippingAddress.city"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>City</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="shippingAddress.state"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>State</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="shippingAddress.county"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>County (Județ) *</FormLabel>
                                <FormControl>
                                  <Input placeholder="e.g. Bucharest, Cluj, Ilfov" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="shippingAddress.zipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>ZIP Code</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <FormField
                          control={form.control}
                          name="shippingAddress.country"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Country *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select country" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {getCountryOptions().map((country) => (
                                    <SelectItem key={country.code} value={country.value}>
                                      {country.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="shippingAddress.phone"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Phone Number</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <MapPin className="h-5 w-5 mr-2" />
                          Billing Address
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="sameAsBilling"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Same as shipping address</FormLabel>
                              </div>
                            </FormItem>
                          )}
                        />
                        {!sameAsBilling && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="billingAddress.firstName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>First Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="billingAddress.lastName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Last Name</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={form.control}
                              name="billingAddress.address"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Address</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="billingAddress.city"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>City</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="billingAddress.state"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>State</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <FormField
                                control={form.control}
                                name="billingAddress.county"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>County (Județ) *</FormLabel>
                                    <FormControl>
                                      <Input placeholder="e.g. Bucharest, Cluj, Ilfov" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <FormField
                                control={form.control}
                                name="billingAddress.zipCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>ZIP Code</FormLabel>
                                    <FormControl>
                                      <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <FormField
                              control={form.control}
                              name="billingAddress.country"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Country *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select country" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {getCountryOptions().map((country) => (
                                        <SelectItem key={country.code} value={country.value}>
                                          {country.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <CreditCard className="h-5 w-5 mr-2" />
                          Payment Method
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <FormField
                          control={form.control}
                          name="paymentMethod"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <RadioGroup
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  className="space-y-3"
                                >
                                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                                    <RadioGroupItem value="stripe" id="stripe" />
                                    <Label htmlFor="stripe" className="flex items-center space-x-2 cursor-pointer">
                                      <span>Credit/Debit Card</span>
                                      <Badge variant="secondary">Recommended</Badge>
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                                    <RadioGroupItem value="revolut" id="revolut" />
                                    <Label htmlFor="revolut" className="cursor-pointer">
                                      Revolut Pay (Apple Pay/Google Pay)
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                                    <RadioGroupItem value="paypal" id="paypal" />
                                    <Label htmlFor="paypal" className="cursor-pointer">
                                      PayPal
                                    </Label>
                                  </div>
                                  <div className="flex items-center space-x-2 p-3 border rounded-lg">
                                    <RadioGroupItem value="cash" id="cash" />
                                    <Label htmlFor="cash" className="flex items-center space-x-2 cursor-pointer">
                                      <span>Cash on Delivery</span>
                                      <Badge variant="outline">Pay when delivered</Badge>
                                    </Label>
                                  </div>
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    {/* Revolut Payment Component */}
                    {form.watch("paymentMethod") === "revolut" && (
                      <RevolutPayment
                        amount={finalTotal}
                        currency="USD"
                        onSuccess={(paymentId) => {
                          console.log("Payment successful in checkout:", paymentId);
                          toast({
                            title: "Payment successful!",
                            description: "Your order has been placed successfully.",
                          });
                          clearCart();
                          navigate("/");
                        }}
                        onError={(error) => {
                          console.error("Payment failed in checkout:", error);
                          toast({
                            title: "Payment failed",
                            description: error,
                            variant: "destructive",
                          });
                        }}
                      />
                    )}

                    {/* Stripe Payment Component */}
                    {form.watch("paymentMethod") === "stripe" && (
                      <StripePayment
                        amount={finalTotal}
                        currency={cartCurrency}
                        cartItems={cart.map(item => ({
                          productId: item.product.id,
                          quantity: item.quantity,
                          price: item.product.price,
                        }))}
                        voucherCode={appliedVoucher?.code}
                        onSuccess={(paymentId) => {
                          console.log("Stripe payment successful in checkout:", paymentId);
                          // Create order after successful payment
                          createOrderMutation.mutate(form.getValues());
                        }}
                        onError={(error) => {
                          console.error("Stripe payment failed in checkout:", error);
                          toast({
                            title: "Payment failed",
                            description: error,
                            variant: "destructive",
                          });
                        }}
                      />
                    )}

                    {/* Cash on Delivery Information */}
                    {form.watch("paymentMethod") === "cash" && (
                      <Card className="border-green-200 bg-green-50">
                        <CardHeader>
                          <CardTitle className="flex items-center text-green-800">
                            <div className="h-5 w-5 mr-2">💰</div>
                            Cash on Delivery
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-green-700">
                          <div className="space-y-2">
                            <p className="text-sm">
                              • You will pay in cash when your order is delivered to your address
                            </p>
                            <p className="text-sm">
                              • Please have the exact amount ready: <strong>{getCurrencySymbol(currency)} {finalTotal.toFixed(2)}</strong>
                            </p>
                            <p className="text-sm">
                              • Our delivery agent will provide a receipt upon payment
                            </p>
                            <p className="text-sm">
                              • Delivery time: 1-3 business days in Bucharest, 2-5 days nationwide
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle>Order Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  placeholder="Special instructions for your order..."
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="flex justify-between">
                  {/* Previous button - only show if not on first step for guest users, or not on step 2 for authenticated users */}
                  {((step > 1 && !isAuthenticated) || (step > 2 && isAuthenticated)) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setStep(step - 1)}
                    >
                      Previous
                    </Button>
                  )}
                  <div className="ml-auto">
                    {/* Show Next button until payment step - authenticated users: 2->3, guests: 1->2->3 */}
                    {(isAuthenticated && step < 3) || (!isAuthenticated && step < 3) ? (
                      <Button 
                        type="button" 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNext(e);
                        }} 
                        className="kitchen-pro-secondary"
                      >
                        Next
                      </Button>
                    ) : (
                      /* Payment step - show different UI based on payment method */
                      form.watch("paymentMethod") === "stripe" ? (
                        <div className="text-sm text-gray-600">
                          Use the payment form above to complete your order
                        </div>
                      ) : form.watch("paymentMethod") === "cash" ? (
                        <Button
                          type="submit"
                          disabled={createOrderMutation.isPending}
                          className="kitchen-pro-secondary"
                        >
                          {createOrderMutation.isPending ? "Processing..." : "Confirm Cash on Delivery Order"}
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          disabled={createOrderMutation.isPending}
                          className="kitchen-pro-secondary"
                        >
                          {createOrderMutation.isPending ? "Processing..." : "Place Order"}
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center space-x-3">
                      <img
                        src={item.product.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60"}
                        alt={item.product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-medium">
                        {(parseFloat(item.product.price) * item.quantity).toFixed(2)} {currencySymbol}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{subtotal.toFixed(2)} {currencySymbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Shipping:</span>
                    <span>
                      {shipping === 0 ? (
                        <Badge variant="secondary">Free</Badge>
                      ) : (
                        `${shipping.toFixed(2)} ${currencySymbol}`
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>VAT ({vatDisplayPercentage}% included):</span>
                    <span>{vatIncludedInFinal.toFixed(2)} {currencySymbol}</span>
                  </div>
                  {appliedVoucher && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        Voucher ({appliedVoucher.code}):
                        <button 
                          onClick={handleRemoveVoucher}
                          className="text-red-500 hover:text-red-700 text-xs ml-1"
                          title="Remove voucher"
                        >
                          ✕
                        </button>
                      </span>
                      <span>-{appliedVoucher.discountAmount} {currencySymbol}</span>
                    </div>
                  )}
                </div>
                
                {/* Voucher Code Input */}
                {!appliedVoucher && (
                  <div className="space-y-2">
                    <Label htmlFor="voucher-code" className="text-sm">Voucher Code</Label>
                    <div className="flex gap-2">
                      <Input
                        id="voucher-code"
                        placeholder="Enter code"
                        value={voucherCode}
                        onChange={(e) => {
                          setVoucherCode(e.target.value.toUpperCase());
                          setVoucherError("");
                        }}
                        className="flex-1"
                      />
                      <Button 
                        type="button"
                        onClick={handleApplyVoucher}
                        disabled={voucherLoading || !voucherCode.trim()}
                        variant="outline"
                        size="sm"
                      >
                        {voucherLoading ? "..." : "Apply"}
                      </Button>
                    </div>
                    {voucherError && (
                      <p className="text-xs text-red-500">{voucherError}</p>
                    )}
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>Total:</span>
                  <span>{finalTotal.toFixed(2)} {currencySymbol}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
