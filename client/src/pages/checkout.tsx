import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, CreditCard, Truck, MapPin, User, FileText, Building2, UserCircle, ChevronDown, ChevronUp, ShoppingBag, Eye, EyeOff, CheckCircle, Copy } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest, getMarketFromHostname } from "@/lib/queryClient";
import { trackEvent } from "@/lib/analytics";
import { getCartLinePrice, getCartTaxSnapshot } from "@/lib/market-pricing";
import { clearVivaCheckoutDraft, consumeVivaCheckoutDraft } from "@/lib/viva-checkout-draft";
import { calculateShippingQuote } from "@shared/shipping-pricing";
import { defaultPriceDisplayMode } from "@shared/market-pricing";
import paypalOfficialLogo from "@/assets/paypal-official-logo.png";

import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/hooks/useTranslation";
import type { TranslationKeys } from "@/translations";
import Header from "@/components/header";
import OrderContactDetails from "@/components/order-contact-details";
import FrenchDepartmentSelect from "@/components/french-department-select";

import VivaPayment from "@/components/viva-payment";
import PayPalPayment from "@/components/paypal-payment";
import {
  getCountyOptions,
  getCitiesForCounty,
  getCountryCode,
  getCountryOptions,
  romanianCounties,
} from "@/utils/location-data";

function createShippingAddressSchema(t: (key: string) => string, isFrenchMarket: boolean) {
  return z.object({
    firstName: z.string().min(1, t('checkout.firstNameRequired')),
    lastName: z.string().min(1, t('checkout.lastNameRequired')),
    company: z.string().optional(),
    address: z.string().min(1, t('checkout.addressRequired')),
    city: z.string().min(1, t('checkout.cityRequired')),
    state: z.string().min(1, t('checkout.stateRequired')),
    county: isFrenchMarket
      ? z.string().default("")
      : z.string().min(1, t('checkout.countyRequired')),
    zipCode: z.string().min(1, t('checkout.zipRequired')),
    country: z.string().min(1, t('checkout.countryRequired')),
    phone: z.string().min(1, t('checkout.phoneRequired')),
  });
}

function createBillingAddressSchemaFull(t: (key: string) => string, isFrenchMarket: boolean) {
  return z.object({
    firstName: z.string().min(1, t('checkout.firstNameRequired')),
    lastName: z.string().min(1, t('checkout.lastNameRequired')),
    company: z.string().optional(),
    address: z.string().min(1, t('checkout.addressRequired')),
    city: z.string().min(1, t('checkout.cityRequired')),
    state: z.string().min(1, t('checkout.stateRequired')),
    county: isFrenchMarket
      ? z.string().default("")
      : z.string().min(1, t('checkout.countyRequired')),
    zipCode: z.string().min(1, t('checkout.zipRequired')),
    country: z.string().min(1, t('checkout.countryRequired')),
    // MyFlyingBox requires the recipient phone, not a duplicate billing phone.
    phone: z.string().default(""),
    clientType: z.enum(["individual", "company"]).default("individual"),
    identityDocument: z.string().default(""),
    companyName: z.string().default(""),
    vatNumber: z.string().default(""),
    registrationNumber: z.string().default(""),
  });
}

const billingAddressSchemaRelaxed = z.object({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  company: z.string().optional(),
  address: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  county: z.string().default(""),
  zipCode: z.string().default(""),
  country: z.string().default("Romania"),
  phone: z.string().default(""),
  clientType: z.enum(["individual", "company"]).default("individual"),
  identityDocument: z.string().default(""),
  companyName: z.string().default(""),
  vatNumber: z.string().default(""),
  registrationNumber: z.string().default(""),
});

function createCheckoutSchema(t: (key: keyof TranslationKeys) => string, isFrenchMarket: boolean) {
  const translate = (key: string) => t(key as keyof TranslationKeys);
  const billingFull = createBillingAddressSchemaFull(translate, isFrenchMarket);
  return z.object({
    email: z.string().email(t('checkout.invalidEmail')),
    phone: z.string().default(""),
    shippingAddress: createShippingAddressSchema(translate, isFrenchMarket),
    billingAddress: billingAddressSchemaRelaxed,
    paymentMethod: z.enum(["viva", "paypal", "cash"]),
    sameAsBilling: z.boolean().default(false),
    notes: z.string().optional(),
    recurringConsent: z.boolean().default(false),
    createAccount: z.boolean().default(false),
    accountPassword: z.string().default(""),
    confirmAccountPassword: z.string().default(""),
    saveDetailsToAccount: z.boolean().default(true),
  }).superRefine((data, ctx) => {
    if (!data.sameAsBilling) {
      const result = billingFull.safeParse(data.billingAddress);
      if (!result.success) {
        result.error.issues.forEach((issue) => {
          ctx.addIssue({
            ...issue,
            path: ["billingAddress", ...issue.path],
          });
        });
      }
    }
    if (data.billingAddress.clientType === "company") {
      if (!data.billingAddress.companyName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('checkout.companyRequired'),
          path: ["billingAddress", "companyName"],
        });
      }
      if (!data.billingAddress.vatNumber.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('checkout.vatRequired'),
          path: ["billingAddress", "vatNumber"],
        });
      }
    }
    if (data.paymentMethod === "paypal" && !isFrenchMarket) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: t("checkout.paypalUnavailable"), path: ["paymentMethod"] });
    }
    if (data.createAccount) {
      if (!data.accountPassword || data.accountPassword.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('checkout.passwordMinLength'),
          path: ["accountPassword"],
        });
      }
      if (data.accountPassword !== data.confirmAccountPassword) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t('checkout.passwordsNoMatch'),
          path: ["confirmAccountPassword"],
        });
      }
    }
  });
}

type CheckoutFormData = z.infer<ReturnType<typeof createCheckoutSchema>>;

type OrderSummaryItem = {
  productId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  priceNet?: number;
  priceGross?: number;
  priceDisplayMode?: "net" | "gross";
};

export default function Checkout() {
  const { t } = useTranslation();
  const market = getMarketFromHostname();
  const isFrenchMarket = market === "fr";
  const checkoutSchema = useMemo(() => createCheckoutSchema(t, isFrenchMarket), [t, isFrenchMarket]);
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [step, setStep] = useState(isAuthenticated ? 2 : 1);
  const checkoutFormRef = useRef<HTMLFormElement>(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);
  const [, navigate] = useLocation();
  const { cart, clearCart, isSessionExpired } = useCart();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const getUnitPrice = (item: typeof cart[number]) =>
    getCartLinePrice(item, market, Number(shippingSettings?.vatPercentage ?? 0)).displayPrice;
  const subscriptionItems = cart.filter(item => (item.product as any)?.productType === "subscription");
  const hasSubscription = subscriptionItems.length > 0;
  
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
  const [isRestoringVoucher, setIsRestoringVoucher] = useState(false);
  const pendingVoucherRestoreRef = useRef<string | null>(null);

  // Confirmed order summary shown after COD placement
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderId: number | null;
    buyerName: string;
    email: string;
    phone: string;
    items: OrderSummaryItem[];
    subtotal: number;
    subtotalNet: number;
    discountNetAmount: number;
    vatAmount: number;
    discountAmount: number;
    voucherCode: string | null;
    shipping: number;
    shippingNetAmount: number;
    shippingDisplayAmount: number;
    hasShippableItems: boolean;
    total: number;
    currencySymbol: string;
  } | null>(null);

  // Ref to always hold the latest order summary (used by mutation onSuccess & Viva localStorage)
  const currentOrderSummaryRef = useRef<{
    buyerName: string;
    email: string;
    phone: string;
    items: OrderSummaryItem[];
    subtotal: number;
    subtotalNet: number;
    discountNetAmount: number;
    vatAmount: number;
    discountAmount: number;
    voucherCode: string | null;
    shipping: number;
    shippingNetAmount: number;
    shippingDisplayAmount: number;
    hasShippableItems: boolean;
    total: number;
    currencySymbol: string;
  }>({ buyerName: '', email: '', phone: '', items: [], subtotal: 0, subtotalNet: 0, discountNetAmount: 0, vatAmount: 0, discountAmount: 0, voucherCode: null, shipping: 0, shippingNetAmount: 0, shippingDisplayAmount: 0, hasShippableItems: false, total: 0, currencySymbol: '' });
  const checkoutStartedRef = useRef(false);

  // Fetch shipping settings (includes VAT percentage)
  const { data: shippingSettings, isFetched: shippingSettingsFetched } = useQuery({
    queryKey: ['/api/shipping-settings'],
    queryFn: async () => {
      const response = await fetch('/api/shipping-settings', {
        headers: { 'X-Market': getMarketFromHostname() }
      });
      if (!response.ok) throw new Error('Failed to fetch shipping settings');
      return response.json();
    },
  });
  
  const defaultVatPercentage = Number(shippingSettings?.vatPercentage ?? 0);
  const taxLabels = market === "fr"
    ? { subtotal: "Produits HT", discount: "Remise HT", shipping: "Livraison HT", vat: "TVA", total: "Total TTC" }
    : market === "ro"
      ? { subtotal: "Produse fără TVA", discount: "Reducere fără TVA", shipping: "Livrare fără TVA", vat: "TVA", total: "Total cu TVA" }
      : { subtotal: "Products excl. VAT", discount: "Discount excl. VAT", shipping: "Shipping excl. VAT", vat: "VAT", total: "Total incl. VAT" };

  // Helper function to get default form values
  const getDefaultFormValues = (): CheckoutFormData => {
    if (isAuthenticated && user) {
      // Pre-populate with user data for authenticated users
      return {
        email: user.email || "",
        phone: user.billingPhone || "",
        shippingAddress: {
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          company: user.companyName || "",
          address: user.deliveryAddress || user.companyAddress || "",
          city: user.deliveryCity || user.companyCity || "",
          state: user.deliveryState || user.companyState || "",
          county: user.deliveryCounty || user.companyCounty || "",
          zipCode: user.deliveryZip || user.companyZip || "",
          country: isFrenchMarket
            ? getCountryCode(user.deliveryCountry || user.companyCountry || "FR")
            : user.deliveryCountry || user.companyCountry || "Romania",
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
          country: isFrenchMarket
            ? getCountryCode(user.companyCountry || "FR")
            : user.companyCountry || "Romania",
          phone: user.billingPhone || "",
          clientType: user.companyName ? "company" : "individual",
          identityDocument: "",
          companyName: user.companyName || "",
          vatNumber: user.vatNumber || "",
          registrationNumber: user.registrationNumber || "",
        },
        paymentMethod: "viva",
        sameAsBilling: !user.deliveryAddress,
        notes: "",
        createAccount: false,
        accountPassword: "",
        confirmAccountPassword: "",
        saveDetailsToAccount: true,
         recurringConsent: false,
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
        country: isFrenchMarket ? "FR" : "Romania",
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
        country: isFrenchMarket ? "FR" : "Romania",
        phone: "",
        clientType: "individual",
        identityDocument: "",
        companyName: "",
        vatNumber: "",
        registrationNumber: "",
      },
      paymentMethod: "viva",
      sameAsBilling: false,
      notes: "",
      createAccount: false,
      accountPassword: "",
      confirmAccountPassword: "",
      saveDetailsToAccount: true,
       recurringConsent: false,
    };
  };

  const form = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: getDefaultFormValues(),
  });

  useEffect(() => {
    if (isAuthenticated && user && !justCreatedAccountRef.current) {
      const defaultValues = getDefaultFormValues();
      form.reset(defaultValues);
      if (step === 1) {
        setStep(2);
      }
    }
  }, [isAuthenticated, user, form]);

  useEffect(() => {
    if (authLoading) return;

    const draft = consumeVivaCheckoutDraft(market);
    if (!draft) return;

    const defaults = getDefaultFormValues();
    const restoredValues = draft.formValues as Partial<CheckoutFormData>;
    form.reset({
      ...defaults,
      ...restoredValues,
      shippingAddress: {
        ...defaults.shippingAddress,
        ...(restoredValues.shippingAddress || {}),
      },
      billingAddress: {
        ...defaults.billingAddress,
        ...(restoredValues.billingAddress || {}),
      },
      accountPassword: "",
      confirmAccountPassword: "",
      recurringConsent: false,
    });

    setStep(draft.step >= 1 && draft.step <= 3 ? draft.step : 3);
    setVoucherCode(draft.appliedVoucherCode || draft.voucherInput);
    if (draft.appliedVoucherCode) {
      pendingVoucherRestoreRef.current = draft.appliedVoucherCode;
      setIsRestoringVoucher(true);
    }
  }, [authLoading, isAuthenticated, user, market, form]);

  useEffect(() => {
    const formElement = checkoutFormRef.current;
    if (!formElement) return;

    const stickyHeader = document.querySelector<HTMLElement>("header.sticky");
    const stickyHeaderHeight = stickyHeader?.getBoundingClientRect().height ?? 0;
    const targetTop =
      formElement.getBoundingClientRect().top +
      window.scrollY -
      stickyHeaderHeight -
      12;

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: "smooth",
    });
  }, [step]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentStatus = url.searchParams.get("payment");
    if (
      url.searchParams.get("provider") !== "viva" ||
      !["cancelled", "failed", "error"].includes(paymentStatus || "")
    ) {
      return;
    }

    toast({
      title: t("checkout.paymentFailed"),
      description: t("checkout.paymentFailedDesc"),
      variant: "destructive",
    });
    url.searchParams.delete("payment");
    url.searchParams.delete("provider");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [toast, t]);

  const sameAsBilling = form.watch("sameAsBilling");
  const watchedEmail = form.watch("email");
  const watchedPhone = form.watch("phone");
  const watchedShippingPhone = form.watch("shippingAddress.phone");
  const clientType = form.watch("billingAddress.clientType");
  const createAccount = form.watch("createAccount");
  const saveDetailsToAccount = form.watch("saveDetailsToAccount");
  const recurringConsent = form.watch("recurringConsent");
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [showConfirmAccountPassword, setShowConfirmAccountPassword] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const justCreatedAccountRef = useRef(false);

  const createOrderMutation = useMutation({
    mutationFn: async (data: CheckoutFormData) => {
      const token = localStorage.getItem("token");
      const orderItems = cart.map(item => {
        const unitPrice = getUnitPrice(item);
        return {
          productId: item.product.id,
          quantity: item.quantity,
          price: unitPrice.toFixed(2),
          totalPrice: (unitPrice * item.quantity).toFixed(2),
          compositeConfiguration: item.compositeConfiguration,
        };
      });

      const shippingAddr = { ...data.shippingAddress, email: data.email };
      if (!shippingAddr.phone && data.phone) {
        shippingAddr.phone = data.phone;
      }
      const billingAddr = sameAsBilling 
        ? { ...shippingAddr, clientType: data.billingAddress.clientType, identityDocument: data.billingAddress.identityDocument, companyName: data.billingAddress.companyName, vatNumber: data.billingAddress.vatNumber, registrationNumber: data.billingAddress.registrationNumber }
        : { ...data.billingAddress, email: data.email };
      if (!billingAddr.phone && data.phone) {
        billingAddr.phone = data.phone;
      }

      const res = await apiRequest("POST", "/api/orders", {
        shippingAddress: shippingAddr,
        billingAddress: billingAddr,
        paymentMethod: data.paymentMethod,
        items: orderItems,
        notes: data.notes,
        voucherCode: appliedVoucher?.code || null,
        contactPhone: data.phone,
        email: data.email,
        recurringConsent: data.recurringConsent,
      });
      return res.json();
    },
    onSuccess: async (order: { id?: number; [key: string]: any }, variables: CheckoutFormData) => {
      const orderId = order?.id ?? null;
      const shippingDisplayMode = defaultPriceDisplayMode(market);
      const numberOr = (value: unknown, fallback: number) => {
        const parsed = Number(value);
        return value != null && Number.isFinite(parsed) ? parsed : fallback;
      };
      const summary = {
        ...currentOrderSummaryRef.current,
        orderId,
        email: variables.email?.trim() || currentOrderSummaryRef.current.email,
        phone: variables.phone?.trim() || currentOrderSummaryRef.current.phone,
        subtotalNet: numberOr(order.subtotalNet, currentOrderSummaryRef.current.subtotalNet),
        discountNetAmount: numberOr(order.discountNetAmount, currentOrderSummaryRef.current.discountNetAmount),
        shippingNetAmount: numberOr(order.shippingNetAmount, currentOrderSummaryRef.current.shippingNetAmount),
        shippingDisplayAmount: shippingDisplayMode === "net"
          ? numberOr(order.shippingNetAmount, currentOrderSummaryRef.current.shippingDisplayAmount)
          : numberOr(order.shippingCost, currentOrderSummaryRef.current.shippingDisplayAmount),
        vatAmount: numberOr(order.vatAmount, currentOrderSummaryRef.current.vatAmount),
        shipping: numberOr(order.shippingCost, currentOrderSummaryRef.current.shipping),
        total: numberOr(order.totalAmount, currentOrderSummaryRef.current.total),
      };
      trackEvent("purchase_completed", {
        value: Number(summary.total.toFixed(2)),
        currency: summary.currencySymbol,
        payment_method: variables.paymentMethod,
        market: getMarketFromHostname(),
      });
      clearVivaCheckoutDraft(market);
      clearCart();
      if (getMarketFromHostname() === "fr") {
        localStorage.setItem("xhaccp_pending_order_summary", JSON.stringify(summary));
        const params = new URLSearchParams({ payment: "cash" });
        if (orderId) params.set("orderId", String(orderId));
        window.location.assign(`/merci?${params.toString()}`);
        return;
      }
      setConfirmedOrder(summary);
    },
    onError: (error) => {
      toast({
        title: t('checkout.orderFailed'),
        description: t('checkout.orderFailedDesc'),
        variant: "destructive",
      });
    },
  });

  const subtotal = cart.reduce((sum, item) => {
    if (!item.product || !item.product.price) return sum;
    const unitPrice = getUnitPrice(item);
    return sum + (unitPrice * item.quantity);
  }, 0);

  const freeShippingThreshold = shippingSettings ? parseFloat(shippingSettings.freeShippingThreshold) : 500;
  const standardShippingCost = shippingSettings ? parseFloat(shippingSettings.standardShippingCost) : 25;
  const currency = shippingSettings?.currency || 'EUR';
  
  const shippingQuote = calculateShippingQuote(
    cart
      .filter(item => item.product && item.product.price)
      .map(item => ({
        productType: item.product.productType,
        isService: item.product.isService,
        displayTotalPrice: getUnitPrice(item) * item.quantity,
      })),
    freeShippingThreshold,
    standardShippingCost,
  );
  const shipping = shippingQuote.shippingCost;

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
  
  const taxSnapshot = getCartTaxSnapshot(
    cart,
    market,
    defaultVatPercentage,
    voucherDiscount,
    shipping,
  );
  const finalTotal = Number(taxSnapshot.totalAmount);
  
  // VAT display percentage (for UI display)
  const vatDisplayPercentage = Math.round(defaultVatPercentage);
  const vatIncludedInFinal = Number(taxSnapshot.vatAmount);

  // Keep ref current so onSuccess / Viva-redirect path can read the latest summary
  useEffect(() => {
    const items: OrderSummaryItem[] = cart.map(item => {
      const unitPrice = getUnitPrice(item);
      return {
        productId: item.product.id,
        name: item.product.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
        priceNet: getCartLinePrice(item, market, defaultVatPercentage).priceNet,
        priceGross: getCartLinePrice(item, market, defaultVatPercentage).priceGross,
        priceDisplayMode: getCartLinePrice(item, market, defaultVatPercentage).priceDisplayMode,
      };
    });
    const summary = {
      buyerName: [form.getValues("shippingAddress.firstName"), form.getValues("shippingAddress.lastName")]
        .map(value => value?.trim())
        .filter(Boolean)
        .join(" "),
      email: watchedEmail?.trim() || "",
      phone: watchedPhone?.trim() || watchedShippingPhone?.trim() || "",
      items,
      subtotal,
      subtotalNet: Number(taxSnapshot.subtotalNet),
      discountNetAmount: Number(taxSnapshot.discountNetAmount),
      vatAmount: Number(taxSnapshot.vatAmount),
      discountAmount: voucherDiscount,
      voucherCode: appliedVoucher?.code ?? null,
      shipping,
      shippingNetAmount: Number(taxSnapshot.shippingNetAmount),
      shippingDisplayAmount: Number(taxSnapshot.shippingDisplayAmount),
      hasShippableItems: shippingQuote.hasShippableItems,
      total: finalTotal,
      currencySymbol,
    };
    currentOrderSummaryRef.current = summary;
    // Also persist for the Viva redirect flow (home.tsx reads this after ?payment=success)
    // Note: orderId is not known yet for Viva (set after redirect); home.tsx will read without it
    if (step === 3) {
      localStorage.setItem('xhaccp_pending_order_summary', JSON.stringify(summary));
    }
  }, [cart, market, defaultVatPercentage, subtotal, voucherDiscount, appliedVoucher, shipping, shippingQuote.hasShippableItems, finalTotal, currencySymbol, step, watchedEmail, watchedPhone, watchedShippingPhone, taxSnapshot]);

  useEffect(() => {
    if (step !== 3 || checkoutStartedRef.current) return;
    checkoutStartedRef.current = true;
    trackEvent("checkout_started", {
      item_count: cart.reduce((count, item) => count + item.quantity, 0),
      value: Number(finalTotal.toFixed(2)),
      currency: cartCurrency,
      market: getMarketFromHostname(),
    });
  }, [step, cart, finalTotal, cartCurrency]);

  // Apply voucher function
  const handleApplyVoucher = async (codeOverride?: string, restoring = false) => {
    const code = (codeOverride ?? voucherCode).trim();
    if (!code) {
      setVoucherError(t('checkout.voucherEmpty'));
      if (restoring) setIsRestoringVoucher(false);
      return;
    }
    
    setVoucherLoading(true);
    setVoucherError("");
    
    try {
      const response = await fetch('/api/vouchers/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Market': getMarketFromHostname(),
          ...(localStorage.getItem("token")
            ? { Authorization: `Bearer ${localStorage.getItem("token")}` }
            : {}),
        },
        body: JSON.stringify({ 
          code,
          orderTotal: subtotal.toString(),
          email: form.getValues("email"),
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.valid) {
        setAppliedVoucher(data.voucher);
        setVoucherCode("");
        if (!restoring) {
          trackEvent("voucher_applied", {
            discount_amount: Number(data.voucher.discountAmount) || 0,
            discount_type: data.voucher.discountType || "unknown",
            market: getMarketFromHostname(),
          });
        }
        toast({
          title: t('checkout.voucherApplied'),
          description: `${t('checkout.voucherAppliedDesc')} -${data.voucher.discountAmount} ${currencySymbol}`,
        });
      } else {
        setVoucherError(data.message || t('checkout.voucherInvalid'));
      }
    } catch (err) {
      console.error("Error validating voucher:", err);
      setVoucherError(t('checkout.voucherFailed'));
    } finally {
      setVoucherLoading(false);
      if (restoring) setIsRestoringVoucher(false);
    }
  };

  useEffect(() => {
    const code = pendingVoucherRestoreRef.current;
    if (!code || voucherLoading || !cart.length || !shippingSettingsFetched) return;

    pendingVoucherRestoreRef.current = null;
    if (!shippingSettings) {
      setVoucherError(t('checkout.voucherFailed'));
      setIsRestoringVoucher(false);
      return;
    }

    void handleApplyVoucher(code, true);
  }, [cart.length, shippingSettingsFetched, shippingSettings, voucherLoading, subtotal, voucherCode, watchedEmail, t]);
  
  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherError("");
  };

  const handleNext = async (e?: React.MouseEvent) => {
    e?.preventDefault(); // Prevent any default form behavior
    console.log("handleNext called, current step:", step);
    
    let fieldsToValidate: any[] = [];
    if (step === 2 && hasSubscription) {
      if (!isAuthenticated) {
        toast({ title: t('checkout.subscriptionAccountRequired'), variant: "destructive" });
        return;
      }
      if (!form.getValues("recurringConsent")) {
        form.setError("recurringConsent", { type: "manual", message: t('checkout.recurringConsent') });
        return;
      }
    }
    
    if (step === 1 && !isAuthenticated) {
      fieldsToValidate = ["email"];
      const phoneValue = form.getValues("phone");
      if (!phoneValue || phoneValue.trim() === "") {
        form.setError("phone", { type: "manual", message: t('checkout.phoneRequired') });
        return;
      }
      const wantAccount = form.getValues("createAccount");
      if (wantAccount) {
        const firstName = form.getValues("shippingAddress.firstName");
        const lastName = form.getValues("shippingAddress.lastName");
        if (!firstName || firstName.trim() === "") {
          form.setError("shippingAddress.firstName", { type: "manual", message: t('checkout.firstNameRequired') });
          return;
        }
        if (!lastName || lastName.trim() === "") {
          form.setError("shippingAddress.lastName", { type: "manual", message: t('checkout.lastNameRequired') });
          return;
        }
        const pwd = form.getValues("accountPassword");
        const confirmPwd = form.getValues("confirmAccountPassword");
        if (!pwd || pwd.length < 6) {
          form.setError("accountPassword", { type: "manual", message: t('checkout.passwordMinLength') });
          return;
        }
        if (pwd !== confirmPwd) {
          form.setError("confirmAccountPassword", { type: "manual", message: t('checkout.passwordsNoMatch') });
          return;
        }
      }
    } else if ((step === 1 && isAuthenticated) || (step === 2)) {
      // Address validation for authenticated users on step 1 or guest users on step 2
      fieldsToValidate = [
        "shippingAddress.firstName",
        "shippingAddress.lastName", 
        "shippingAddress.address",
        "shippingAddress.city",
        "shippingAddress.state",
        ...(isFrenchMarket ? [] : ["shippingAddress.county"]),
        "shippingAddress.zipCode",
        "shippingAddress.country",
        "shippingAddress.phone"
      ];
      
      if (!sameAsBilling) {
        fieldsToValidate.push(
          "billingAddress.firstName",
          "billingAddress.lastName",
          "billingAddress.address", 
          "billingAddress.city",
          "billingAddress.state",
          ...(isFrenchMarket ? [] : ["billingAddress.county"]),
          "billingAddress.zipCode",
          "billingAddress.country",
          "billingAddress.phone"
        );
      }

      const currentClientType = form.getValues("billingAddress.clientType");
      if (currentClientType === "company") {
        const companyName = form.getValues("billingAddress.companyName");
        const vatNum = form.getValues("billingAddress.vatNumber");
        if (!companyName || companyName.trim() === "") {
          form.setError("billingAddress.companyName", { type: "manual", message: t('checkout.companyRequired') });
          return;
        }
        if (!vatNum || vatNum.trim() === "") {
          form.setError("billingAddress.vatNumber", { type: "manual", message: t('checkout.vatRequired') });
          return;
        }
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
        const fn = form.getValues("shippingAddress.firstName");
        const ln = form.getValues("shippingAddress.lastName");
        if (fn && !form.getValues("billingAddress.firstName")) {
          form.setValue("billingAddress.firstName", fn);
        }
        if (ln && !form.getValues("billingAddress.lastName")) {
          form.setValue("billingAddress.lastName", ln);
        }

        const wantAccount = form.getValues("createAccount");
        if (wantAccount) {
          const email = form.getValues("email");
          const pwd = form.getValues("accountPassword");
          setIsCreatingAccount(true);
          try {
            const registerResponse = await apiRequest("POST", "/api/auth/register", {
              email,
              password: pwd,
              firstName: form.getValues("shippingAddress.firstName"),
              lastName: form.getValues("shippingAddress.lastName"),
            });
            const registerData = await registerResponse.json();
            if (registerData.token && registerData.user) {
              justCreatedAccountRef.current = true;
              await login(registerData.token, registerData.user);
              toast({
                title: t('checkout.accountCreatedTitle'),
                description: t('checkout.accountCreatedDesc'),
              });
            }
          } catch (err: any) {
            console.error("Account creation failed:", err);
            const errorMsg = err?.message?.includes("400") 
              ? t('checkout.emailAlreadyExists')
              : t('checkout.accountCreationFailed');
            toast({
              title: t('checkout.accountCreationFailedTitle'),
              description: errorMsg,
              variant: "destructive",
            });
            setIsCreatingAccount(false);
            return;
          }
          setIsCreatingAccount(false);
        }
      }

      if (step === 2 && isAuthenticated && form.getValues("saveDetailsToAccount")) {
        try {
          const shipping = form.getValues("shippingAddress");
          const billing = form.getValues("billingAddress");
          const isSameBilling = form.getValues("sameAsBilling");

          await apiRequest("PUT", "/api/auth/profile", {
            firstName: shipping.firstName,
            lastName: shipping.lastName,
          });

          const invoiceData: Record<string, string> = {
            deliveryAddress: shipping.address,
            deliveryCity: shipping.city,
            deliveryState: shipping.state,
            deliveryCounty: shipping.county,
            deliveryZip: shipping.zipCode,
            deliveryCountry: shipping.country,
          };

          if (!isSameBilling) {
            invoiceData.billingPhone = billing.phone || "";
          }

          if (billing.clientType === "company") {
            invoiceData.companyName = billing.companyName || "";
            invoiceData.vatNumber = billing.vatNumber || "";
            invoiceData.registrationNumber = billing.registrationNumber || "";
            invoiceData.companyAddress = billing.address || "";
            invoiceData.companyCity = billing.city || "";
            invoiceData.companyState = billing.state || "";
            invoiceData.companyCounty = billing.county || "";
            invoiceData.companyZip = billing.zipCode || "";
            invoiceData.companyCountry = billing.country || "Romania";
          }

          await apiRequest("PUT", "/api/auth/invoice", invoiceData);
        } catch (err) {
          console.error("Failed to save details to account:", err);
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
    const buyerName = [data.shippingAddress.firstName, data.shippingAddress.lastName]
      .map(value => value?.trim())
      .filter(Boolean)
      .join(" ");
    currentOrderSummaryRef.current = {
      ...currentOrderSummaryRef.current,
      buyerName,
    };
    createOrderMutation.mutate(data);
  };

  if (confirmedOrder) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="max-w-lg mx-auto">
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="flex justify-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold mb-1">{t('checkout.orderSuccess')}</h2>
                <p className="text-muted-foreground text-sm">{t('checkout.orderSuccessDesc')}</p>
                {confirmedOrder.orderId && (
                  <div className="mt-2 inline-flex items-center gap-1.5">
                    <div className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full">
                      <span className="text-green-600">#</span>{confirmedOrder.orderId}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(String(confirmedOrder.orderId));
                        toast({ description: "Copied!" });
                      }}
                      className="p-1 rounded hover:bg-green-100 text-green-700 transition-colors"
                      aria-label="Copy order number"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <div className="border rounded-lg p-4 text-left space-y-2">
                <h3 className="font-semibold text-sm mb-3">{t('checkout.orderSummary')}</h3>
                <OrderContactDetails email={confirmedOrder.email} phone={confirmedOrder.phone} />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{taxLabels.subtotal}:</span>
                  <span>{confirmedOrder.subtotalNet.toFixed(2)} {confirmedOrder.currencySymbol}</span>
                </div>
                {confirmedOrder.discountNetAmount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{taxLabels.discount} {confirmedOrder.voucherCode ? `(${confirmedOrder.voucherCode})` : ''}:</span>
                    <span>-{confirmedOrder.discountNetAmount.toFixed(2)} {confirmedOrder.currencySymbol}</span>
                  </div>
                )}
                {confirmedOrder.hasShippableItems && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{taxLabels.shipping}:</span>
                    <span>
                      {confirmedOrder.shipping === 0
                        ? <Badge variant="secondary">{t('checkout.freeShipping')}</Badge>
                        : `${confirmedOrder.shippingNetAmount.toFixed(2)} ${confirmedOrder.currencySymbol}`}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{taxLabels.vat} ({vatDisplayPercentage}%):</span>
                  <span>{confirmedOrder.vatAmount.toFixed(2)} {confirmedOrder.currencySymbol}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-semibold">
                  <span>{taxLabels.total}:</span>
                  <span>{confirmedOrder.total.toFixed(2)} {confirmedOrder.currencySymbol}</span>
                </div>
              </div>
              <Link href="/">
                <Button className="kitchen-pro-secondary w-full">
                  {t('checkout.backToShop')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isSessionExpired) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <Card className="mx-auto max-w-lg text-center py-16">
            <CardContent>
              <h2 className="text-2xl font-semibold mb-2">{t('messages.sessionExpired')}</h2>
              <Link href="/login?returnTo=/checkout">
                <Button size="lg" className="kitchen-pro-secondary">
                  {t('auth.signIn')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <Card className="text-center py-16">
            <CardContent>
              <h2 className="text-2xl font-semibold mb-2">{t('checkout.emptyCart')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('checkout.emptyCartDesc')}
              </p>
              <Link href="/products">
                <Button size="lg" className="kitchen-pro-secondary">
                  {t('checkout.backToShop')}
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
              {t('checkout.back')}
            </Button>
          </Link>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-6 sm:mb-8">
          <div className="flex items-center space-x-2 sm:space-x-4">
            {isAuthenticated ? (
              <>
                <div className="flex items-center">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                      step >= 2
                        ? "kitchen-pro-secondary text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    1
                  </div>
                  <div className="ml-1.5 sm:ml-2 text-xs sm:text-sm">{t('checkout.stepAddress')}</div>
                </div>
                <div
                  className={`w-8 sm:w-16 h-0.5 ${
                    step >= 3 ? "bg-blue-500" : "bg-slate-200"
                  }`}
                />
                <div className="flex items-center">
                  <div
                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                      step >= 3
                        ? "kitchen-pro-secondary text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    2
                  </div>
                  <div className="ml-1.5 sm:ml-2 text-xs sm:text-sm">{t('checkout.stepPayment')}</div>
                </div>
              </>
            ) : (
              <>
                {[
                  { num: 1, label: t('checkout.stepContact') },
                  { num: 2, label: t('checkout.stepAddress') },
                  { num: 3, label: t('checkout.stepPayment') }
                ].map((stepInfo, index) => (
                  <div key={stepInfo.num} className="flex items-center">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium ${
                        stepInfo.num <= step
                          ? "kitchen-pro-secondary text-white"
                          : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {stepInfo.num}
                    </div>
                    <div className="ml-1.5 sm:ml-2 text-xs sm:text-sm hidden sm:block">{stepInfo.label}</div>
                    {index < 2 && (
                      <div
                        className={`w-6 sm:w-16 h-0.5 mx-1 sm:mx-2 ${
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
                ref={checkoutFormRef}
                onSubmit={(e) => {
                  console.log("Form submit event triggered, current step:", step);
                  console.log("Form errors:", JSON.stringify(form.formState.errors));
                  if (step !== 3) {
                    console.log("Preventing form submission - not on payment step");
                    e.preventDefault();
                    return false;
                  }
                  form.handleSubmit(handleSubmit, (errors) => {
                    console.log("Form validation errors on submit:", JSON.stringify(errors));
                    const firstError = Object.entries(errors).find(([_, v]) => v);
                    if (firstError) {
                      const errorMsg = typeof firstError[1]?.message === 'string' 
                        ? firstError[1].message 
                        : `Validation error in: ${firstError[0]}`;
                      toast({
                        title: t('checkout.orderFailed') || "Error",
                        description: errorMsg,
                        variant: "destructive",
                      });
                    }
                  })(e);
                }} 
                className="space-y-6"
              >
                {/* Contact Information Step - Only for guest users */}
                {step === 1 && !isAuthenticated && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        {t('checkout.contactInfo')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('checkout.emailAddress')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('checkout.emailPlaceholder')} {...field} />
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
                            <FormLabel>{t('checkout.phoneNumber')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('checkout.phonePlaceholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Separator className="my-4" />

                      <FormField
                        control={form.control}
                        name="createAccount"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">{t('checkout.createAccount')}</FormLabel>
                              <p className="text-sm text-muted-foreground">{t('checkout.createAccountDesc')}</p>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {createAccount && (
                        <div className="space-y-4 pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                              control={form.control}
                              name="shippingAddress.firstName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('checkout.firstName')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('checkout.firstName')} {...field} />
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
                                  <FormLabel>{t('checkout.lastName')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('checkout.lastName')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={form.control}
                            name="accountPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('checkout.password')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type={showAccountPassword ? "text" : "password"}
                                      placeholder={t('checkout.passwordPlaceholder')}
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowAccountPassword(!showAccountPassword)}
                                    >
                                      {showAccountPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="confirmAccountPassword"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('checkout.confirmPassword')}</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      type={showConfirmAccountPassword ? "text" : "password"}
                                      placeholder={t('checkout.confirmPasswordPlaceholder')}
                                      {...field}
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                                      onClick={() => setShowConfirmAccountPassword(!showConfirmAccountPassword)}
                                    >
                                      {showConfirmAccountPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* For authenticated users, show user info summary */}
                {isAuthenticated && user && step === 2 && (
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <User className="h-5 w-5 mr-2" />
                        {t('checkout.accountInfo')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm text-muted-foreground">
                        <p><strong>{t('checkout.emailAddress')}:</strong> {user.email}</p>
                        {user.companyName && <p><strong>{t('checkout.company')}:</strong> {user.companyName}</p>}
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
                          {t('checkout.shippingAddress')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="shippingAddress.firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('checkout.firstName')} *</FormLabel>
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
                                <FormLabel>{t('checkout.lastName')} *</FormLabel>
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
                              <FormLabel>{t('checkout.company')}</FormLabel>
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
                              <FormLabel>{t('checkout.address')} *</FormLabel>
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
                                <FormLabel>{t('checkout.city')} *</FormLabel>
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
                                <FormLabel>{t('checkout.state')} *</FormLabel>
                                <FormControl>
                                  {isFrenchMarket ? (
                                    <FrenchDepartmentSelect
                                      value={field.value}
                                      onValueChange={field.onChange}
                                      placeholder={t('checkout.countyPlaceholder')}
                                      searchPlaceholder={t('checkout.departmentSearch')}
                                      noResultsLabel={t('checkout.noDepartmentsFound')}
                                    />
                                  ) : (
                                    <Input {...field} />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {!isFrenchMarket && (
                            <FormField
                              control={form.control}
                              name="shippingAddress.county"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('checkout.county')} *</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('checkout.countyPlaceholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name="shippingAddress.zipCode"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{t('checkout.zipCode')} *</FormLabel>
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
                              <FormLabel>{t('checkout.country')} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder={t('checkout.selectCountry')} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {getCountryOptions(isFrenchMarket).map((country) => (
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
                                <FormLabel>{t('checkout.phoneNumber')} *</FormLabel>
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
                          <FileText className="h-5 w-5 mr-2" />
                          {t('checkout.addressInvoice')}
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
                                <FormLabel>{t('checkout.sameAsShipping')}</FormLabel>
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
                                <FormLabel>{t('checkout.firstName')} *</FormLabel>
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
                                <FormLabel>{t('checkout.lastName')} *</FormLabel>
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
                                  <FormLabel>{t('checkout.address')} *</FormLabel>
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
                                    <FormLabel>{t('checkout.city')} *</FormLabel>
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
                                    <FormLabel>{t('checkout.state')} *</FormLabel>
                                    <FormControl>
                                    {isFrenchMarket ? (
                                      <FrenchDepartmentSelect
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder={t('checkout.countyPlaceholder')}
                                        searchPlaceholder={t('checkout.departmentSearch')}
                                        noResultsLabel={t('checkout.noDepartmentsFound')}
                                      />
                                    ) : (
                                      <Input {...field} />
                                    )}
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {!isFrenchMarket && (
                                <FormField
                                  control={form.control}
                                  name="billingAddress.county"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('checkout.county')} *</FormLabel>
                                      <FormControl>
                                        <Input placeholder={t('checkout.countyPlaceholder')} {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              )}
                              <FormField
                                control={form.control}
                                name="billingAddress.zipCode"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('checkout.zipCode')} *</FormLabel>
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
                                  <FormLabel>{t('checkout.country')} *</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder={t('checkout.selectCountry')} />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {getCountryOptions(isFrenchMarket).map((country) => (
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

                        <Separator className="my-4" />
                        
                        <div className="space-y-4">
                          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('checkout.invoiceDetails')}</Label>
                          <FormField
                            control={form.control}
                            name="billingAddress.clientType"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <RadioGroup
                                    onValueChange={field.onChange}
                                    value={field.value}
                                    className="flex gap-4"
                                  >
                                    <div className="flex items-center space-x-2 border rounded-lg px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors flex-1">
                                      <RadioGroupItem value="individual" id="individual" />
                                      <Label htmlFor="individual" className="cursor-pointer flex items-center gap-2">
                                        <UserCircle className="h-4 w-4" />
                                        {t('checkout.individual')}
                                      </Label>
                                    </div>
                                    <div className="flex items-center space-x-2 border rounded-lg px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors flex-1">
                                      <RadioGroupItem value="company" id="company" />
                                      <Label htmlFor="company" className="cursor-pointer flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        {t('checkout.legalEntity')}
                                      </Label>
                                    </div>
                                  </RadioGroup>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {clientType === "individual" && (
                            <FormField
                              control={form.control}
                              name="billingAddress.identityDocument"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('checkout.identityDoc')}</FormLabel>
                                  <FormControl>
                                    <Input placeholder={t('checkout.idDocPlaceholder')} {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}

                          {clientType === "company" && (
                            <div className="space-y-4">
                              <FormField
                                control={form.control}
                                name="billingAddress.companyName"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('checkout.companyName')} *</FormLabel>
                                    <FormControl>
                                      <Input placeholder={t('checkout.companyPlaceholder')} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField
                                  control={form.control}
                                  name="billingAddress.vatNumber"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('checkout.vatNumber')} *</FormLabel>
                                      <FormControl>
                                        <Input placeholder={t('checkout.vatPlaceholder')} {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                                <FormField
                                  control={form.control}
                                  name="billingAddress.registrationNumber"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel>{t('checkout.regNumber')}</FormLabel>
                                      <FormControl>
                                        <Input placeholder={t('checkout.regComPlaceholder')} {...field} />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {isAuthenticated && (
                      <Card className="border-green-200 bg-green-50/30">
                        <CardContent className="p-4">
                          <FormField
                            control={form.control}
                            name="saveDetailsToAccount"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-base">{t('checkout.saveDetailsToAccount')}</FormLabel>
                                  <p className="text-sm text-muted-foreground">{t('checkout.saveDetailsToAccountDesc')}</p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <div className="lg:hidden">
                      <Card className="border-blue-200 bg-blue-50/30">
                        <CardContent className="p-3">
                          <button
                            type="button"
                            onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
                            className="w-full flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <ShoppingBag className="h-4 w-4 text-blue-600" />
                              <span className="text-sm font-medium">{t('checkout.orderSummary')} ({cart.length})</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{finalTotal.toFixed(2)} {currencySymbol}</span>
                              {mobileSummaryOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </div>
                          </button>
                          {mobileSummaryOpen && (
                            <div className="mt-3 pt-3 border-t space-y-2">
                              {cart.filter(item => item.product?.price).map((item) => (
                                <div key={item.id}>
                                  <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <img
                                      src={item.product?.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=40&h=40"}
                                      alt={item.product?.name || "Product"}
                                      className="w-8 h-8 object-cover rounded flex-shrink-0"
                                    />
                                    <span className="truncate">{item.product?.name || "Product"}</span>
                                    <span className="text-muted-foreground flex-shrink-0">x{item.quantity}</span>
                                    </div>
                                    <span className="font-medium flex-shrink-0 ml-2">
                                      {(getUnitPrice(item) * item.quantity).toFixed(2)} {currencySymbol}
                                      <span className="ml-1 text-xs text-muted-foreground">
                                        {getCartLinePrice(item, market, defaultVatPercentage).priceDisplayMode === "net"
                                          ? `HT + TVA ${defaultVatPercentage}%`
                                          : market === "fr" ? "TTC" : "incl. VAT"}
                                      </span>
                                    </span>
                                  </div>
                                  {item.compositeConfiguration?.components?.length ? (
                                   <div className="ml-10 text-xs text-muted-foreground">
                                     {item.compositeConfiguration.components.map(component => (
                                       <div key={component.componentProductId}>• {component.name || component.productCode || `#${component.componentProductId}`} × {component.quantity}</div>
                                     ))}
                                   </div>
                                  ) : null}
                                </div>
                              ))}
                              <Separator />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{t('checkout.shipping')}:</span>
                                <span>{shipping === 0 ? t('checkout.freeShipping') : `${shipping.toFixed(2)} ${currencySymbol}`}</span>
                              </div>
                              {appliedVoucher && (
                                <div className="flex justify-between text-xs text-green-600">
                                  <span>{t('checkout.voucher')} ({appliedVoucher.code}):</span>
                                  <span>-{appliedVoucher.discountAmount} {currencySymbol}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <CreditCard className="h-5 w-5 mr-2" />
                          {t('checkout.paymentMethod')}
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
                                  disabled={isRestoringVoucher || voucherLoading}
                                  className="space-y-3"
                                >
                                    <div className={`flex items-center space-x-3 p-4 border-2 rounded-lg transition-colors ${field.value === 'viva' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                                    <RadioGroupItem value="viva" id="viva" />
                                    <Label htmlFor="viva" className="flex-1 cursor-pointer">
                                      <div className="flex items-center gap-3">
                                        <img src="https://developer.viva.com/images/new-payment-methods-logos/card,applepay,googlepay.svg" alt="Card, Apple Pay, Google Pay" className="h-9" />
                                          {isFrenchMarket && (
                                            <span className="font-medium">{t('checkout.cardOrPayPal')}</span>
                                          )}
                                        <Badge variant="secondary" className="text-xs">{t('checkout.recommended')}</Badge>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-2">
                                        <span className="text-xs text-muted-foreground">{t('checkout.poweredBy')}</span>
                                        <img src="https://developer.viva.com/images/new-payment-methods-logos/vivawallet.svg" alt="Viva Wallet" className="h-4" />
                                      </div>
                                    </Label>
                                  </div>
                                    {isFrenchMarket && !hasSubscription && (
                                      <div className={`flex items-center space-x-3 p-4 border-2 rounded-lg transition-colors ${field.value === 'paypal' ? 'border-[#0070ba] bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                                        <RadioGroupItem value="paypal" id="paypal" />
                                        <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                                           <div className="flex items-center gap-3">
                                             <img
                                               src={paypalOfficialLogo}
                                               alt="PayPal"
                                               className="h-10 w-auto max-w-[160px] object-contain object-left"
                                             />
                                             <span className="min-w-0">
                                               <span className="flex items-center gap-2">
                                                 <span className="font-semibold text-[#003087]">PayPal</span>
                                                 <Badge variant="outline" className="text-xs">{t('checkout.paypalDirect')}</Badge>
                                               </span>
                                               <span className="block text-xs text-muted-foreground mt-1">{t('checkout.paypalDirectNotice')}</span>
                                             </span>
                                           </div>
                                        </Label>
                                      </div>
                                    )}
                                   {!isFrenchMarket && (
                                     <div className={`flex items-center space-x-3 p-4 border-2 rounded-lg transition-colors ${field.value === 'cash' ? 'border-green-500 bg-green-50/50' : 'border-gray-200 hover:border-gray-300'}`}>
                                       <RadioGroupItem value="cash" id="cash" />
                                       <Label htmlFor="cash" className="flex-1 cursor-pointer">
                                         <div className="flex items-center gap-2">
                                           <span className="font-medium">{t('checkout.cashOnDelivery')}</span>
                                           <Badge variant="outline" className="text-xs">{t('checkout.payWhenDelivered')}</Badge>
                                         </div>
                                       </Label>
                                     </div>
                                   )}
                                </RadioGroup>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </CardContent>
                    </Card>

                    {hasSubscription && (
                      <Card className="border-amber-200 bg-amber-50">
                        <CardContent className="p-4">
                          <label className="flex items-start gap-3 text-sm text-amber-950 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={recurringConsent}
                              onChange={(event) => form.setValue("recurringConsent", event.target.checked, { shouldValidate: true })}
                              className="mt-0.5 h-4 w-4"
                            />
                            <span>{t('checkout.recurringConsent')}</span>
                          </label>
                          <FormMessage>{form.formState.errors.recurringConsent?.message}</FormMessage>
                        </CardContent>
                      </Card>
                    )}

                    {form.watch("paymentMethod") === "viva" && (
                      <VivaPayment
                        amount={finalTotal}
                        currency={cartCurrency}
                        disabled={isRestoringVoucher || voucherLoading}
                        cartItems={cart.map(item => ({
                          productId: item.product.id,
                          quantity: item.quantity,
                          price: getUnitPrice(item).toFixed(2),
                          compositeConfiguration: item.compositeConfiguration,
                        }))}
                        voucherCode={appliedVoucher?.code}
                        isFrenchMarket={isFrenchMarket}
                         isRecurring={hasSubscription}
                        checkoutDraft={() => ({
                          step,
                          formValues: form.getValues() as unknown as Record<string, unknown>,
                          voucherInput: voucherCode,
                          appliedVoucherCode: appliedVoucher?.code ?? null,
                        })}
                        orderData={(() => {
                          const values = form.getValues();
                          const shippingAddr = { ...values.shippingAddress };
                          if (!shippingAddr.phone && values.phone) {
                            shippingAddr.phone = values.phone;
                          }
                          const billingAddr = sameAsBilling
                            ? { ...shippingAddr, clientType: values.billingAddress.clientType, companyName: values.billingAddress.companyName, vatNumber: values.billingAddress.vatNumber, registrationNumber: values.billingAddress.registrationNumber }
                            : { ...values.billingAddress };
                          return {
                            shippingAddress: { ...shippingAddr, email: values.email },
                            buyerName: [shippingAddr.firstName, shippingAddr.lastName]
                              .map(value => value?.trim())
                              .filter(Boolean)
                              .join(" "),
                            billingAddress: billingAddr,
                            items: cart.map(item => {
                              const up = getUnitPrice(item);
                              return {
                                productId: item.product.id,
                                quantity: item.quantity,
                                price: up.toFixed(2),
                                totalPrice: (up * item.quantity).toFixed(2),
                                compositeConfiguration: item.compositeConfiguration,
                              };
                            }),
                            notes: values.notes,
                            contactPhone: values.phone,
                          };
                        })()}
                        onError={(error) => {
                          console.error("Viva payment failed in checkout:", error);
                          toast({
                            title: t('checkout.paymentFailed'),
                            description: error,
                            variant: "destructive",
                          });
                        }}
                      />
                    )}
                    {form.watch("paymentMethod") === "paypal" && isFrenchMarket && !hasSubscription && (
                      <PayPalPayment
                        amount={finalTotal}
                        disabled={isRestoringVoucher || voucherLoading}
                        cartItems={cart.map(item => ({ productId: item.product.id, quantity: item.quantity, price: getUnitPrice(item).toFixed(2), compositeConfiguration: item.compositeConfiguration }))}
                        voucherCode={appliedVoucher?.code}
                        orderData={(() => {
                          const values = form.getValues();
                          const shippingAddr = { ...values.shippingAddress, email: values.email, phone: values.shippingAddress.phone || values.phone };
                          const billingAddr = sameAsBilling
                            ? {
                                ...shippingAddr,
                                clientType: values.billingAddress.clientType,
                                identityDocument: values.billingAddress.identityDocument,
                                companyName: values.billingAddress.companyName,
                                vatNumber: values.billingAddress.vatNumber,
                                registrationNumber: values.billingAddress.registrationNumber,
                              }
                            : { ...values.billingAddress, email: values.email };
                          return { shippingAddress: shippingAddr, billingAddress: billingAddr, notes: values.notes };
                        })()}
                      />
                    )}

                    {/* Cash on Delivery Information */}
                     {!isFrenchMarket && form.watch("paymentMethod") === "cash" && (
                      <Card className="border-green-200 bg-green-50">
                        <CardHeader>
                          <CardTitle className="flex items-center text-green-800">
                            <div className="h-5 w-5 mr-2">💰</div>
                            {t('checkout.cashOnDelivery')}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-green-700">
                          <div className="space-y-2">
                            <p className="text-sm">
                              • {t('checkout.codPayInfo')}
                            </p>
                            <p className="text-sm">
                              • {t('checkout.codAmountReady')}: <strong>{getCurrencySymbol(currency)} {finalTotal.toFixed(2)}</strong>
                            </p>
                            <p className="text-sm">
                              • {t('checkout.codReceipt')}
                            </p>
                            <p className="text-sm">
                              • {t('checkout.codDeliveryTime')}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <Card>
                      <CardHeader>
                        <CardTitle>{t('checkout.orderNotes')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <FormField
                          control={form.control}
                          name="notes"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  placeholder={t('checkout.orderNotesPlaceholder')}
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
                      {t('checkout.back')}
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
                        disabled={isCreatingAccount}
                      >
                        {isCreatingAccount ? t('checkout.processing') : t('checkout.next')}
                      </Button>
                    ) : (
                      /* Payment step - show different UI based on payment method */
                      form.watch("paymentMethod") === "viva" ? (
                        <div className="text-sm text-gray-600">
                          {t('checkout.usePaymentForm')}
                        </div>
                      ) : form.watch("paymentMethod") === "paypal" ? (
                        <div className="text-sm text-gray-600">{t('checkout.usePaymentForm')}</div>
                      ) : !isFrenchMarket && form.watch("paymentMethod") === "cash" ? (
                        <Button
                          type="submit"
                          disabled={createOrderMutation.isPending}
                          className="kitchen-pro-secondary"
                        >
                          {createOrderMutation.isPending ? t('checkout.processing') : t('checkout.confirmCOD')}
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          disabled={createOrderMutation.isPending}
                          className="kitchen-pro-secondary"
                        >
                          {createOrderMutation.isPending ? t('checkout.processing') : t('checkout.placeOrder')}
                        </Button>
                      )
                    )}
                  </div>
                </div>
              </form>
            </Form>
          </div>

          {/* Order Summary - hidden on mobile at payment step since we show compact summary above */}
          <div className={`lg:col-span-1 ${step === 3 ? 'hidden lg:block' : ''}`}>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle>{t('checkout.orderSummary')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <img
                        src={item.product.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60"}
                        alt={item.product.name}
                        className="w-10 h-10 object-cover rounded flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t('checkout.qty')}: {item.quantity}
                        </p>
                         {item.compositeConfiguration?.components?.length ? (
                           <div className="mt-1 text-xs text-muted-foreground">
                             {item.compositeConfiguration.components.map(component => (
                               <div key={component.componentProductId}>• {component.name || component.productCode || `#${component.componentProductId}`} × {component.quantity}</div>
                             ))}
                           </div>
                         ) : null}
                      </div>
                      <p className="text-sm font-medium flex-shrink-0">
                        {(getUnitPrice(item) * item.quantity).toFixed(2)} {currencySymbol}
                        <span className="ml-1 text-xs text-muted-foreground">
                          {getCartLinePrice(item, market, defaultVatPercentage).priceDisplayMode === "net"
                            ? `HT + TVA ${defaultVatPercentage}%`
                            : market === "fr" ? "TTC" : "incl. VAT"}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{taxLabels.subtotal}:</span>
                    <span>{taxSnapshot.subtotalNet} {currencySymbol}</span>
                  </div>
                  {shippingQuote.hasShippableItems && (
                    <div className="flex justify-between text-sm">
                      <span>{taxLabels.shipping}:</span>
                      <span>
                        {shipping === 0 ? (
                          <Badge variant="secondary">{t('checkout.freeShipping')}</Badge>
                        ) : (
                          `${taxSnapshot.shippingNetAmount} ${currencySymbol}`
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{taxLabels.vat} ({vatDisplayPercentage}%):</span>
                    <span>{vatIncludedInFinal.toFixed(2)} {currencySymbol}</span>
                  </div>
                  {appliedVoucher && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span className="flex items-center gap-1">
                        {t('checkout.voucher')} ({appliedVoucher.code}):
                        <button 
                          onClick={handleRemoveVoucher}
                          className="text-red-500 hover:text-red-700 text-xs ml-1"
                          title={t('checkout.voucherRemove')}
                        >
                          ✕
                        </button>
                      </span>
                      <span>-{taxSnapshot.discountNetAmount} {currencySymbol}</span>
                    </div>
                  )}
                </div>
                
                {/* Voucher Code Input */}
                {!appliedVoucher && (
                  <div className="space-y-2">
                    <Label htmlFor="voucher-code" className="text-sm">{t('checkout.voucherCode')}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="voucher-code"
                        placeholder={t('checkout.voucherPlaceholder')}
                        value={voucherCode}
                        onChange={(e) => {
                          setVoucherCode(e.target.value.toUpperCase());
                          setVoucherError("");
                        }}
                        className="flex-1"
                      />
                      <Button 
                        type="button"
                        onClick={() => handleApplyVoucher()}
                        disabled={voucherLoading || !voucherCode.trim()}
                        variant="outline"
                        size="sm"
                      >
                        {voucherLoading ? "..." : t('checkout.voucherApply')}
                      </Button>
                    </div>
                    {voucherError && (
                      <p className="text-xs text-red-500">{voucherError}</p>
                    )}
                  </div>
                )}

                <Separator />

                <div className="flex justify-between font-semibold text-lg">
                  <span>{taxLabels.total}:</span>
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
