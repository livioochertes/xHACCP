import { Link } from "wouter";
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { formatPrice } from "@/lib/utils";
import { getMarketFromHostname } from "@/lib/queryClient";
import { getCartLinePrice, getCartTaxSnapshot } from "@/lib/market-pricing";

import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { trackEvent } from "@/lib/analytics";

export default function Cart() {
  const { cart, updateQuantity, removeFromCart, clearCart, isLoading } = useCart();
  const { toast } = useToast();
  const { t } = useTranslation();
  const market = getMarketFromHostname();
  const taxLabels = market === "fr"
    ? { subtotal: "Produits HT", shipping: "Livraison HT", vat: "TVA", total: "Total TTC" }
    : market === "ro"
      ? { subtotal: "Produse fără TVA", shipping: "Livrare cu TVA", vat: "TVA", total: "Total cu TVA" }
      : { subtotal: "Products excl. VAT", shipping: "Shipping incl. VAT", vat: "VAT", total: "Total incl. VAT" };

  const { data: shippingSettings } = useQuery({
    queryKey: ['/api/shipping-settings'],
    queryFn: async () => {
      const response = await fetch('/api/shipping-settings', {
        headers: { 'X-Market': getMarketFromHostname() }
      });
      if (!response.ok) throw new Error('Failed to fetch shipping settings');
      return response.json();
    },
  });

  const validCart = cart.filter(item => item.product && item.product.price);
  const defaultVatPercentage = Number(shippingSettings?.vatPercentage ?? 0);
  const getLinePrice = (item: typeof validCart[number]) =>
    getCartLinePrice(item, market, defaultVatPercentage);
  const getUnitPrice = (item: typeof validCart[number]) => getLinePrice(item).displayPrice;

  const subtotal = validCart.reduce((sum, item) => {
    const unitPrice = getUnitPrice(item);
    return sum + (unitPrice * item.quantity);
  }, 0);
  
  const freeShippingThreshold = shippingSettings ? parseFloat(shippingSettings.freeShippingThreshold) : 500;
  const standardShippingCost = shippingSettings ? parseFloat(shippingSettings.standardShippingCost) : 25;
  const currency = shippingSettings?.currency || 'EUR';
  
  const shipping = subtotal > freeShippingThreshold ? 0 : standardShippingCost;
  const taxSnapshot = getCartTaxSnapshot(validCart, market, defaultVatPercentage, 0, shipping);
  const total = Number(taxSnapshot.totalAmount);

  const getCurrencySymbol = (curr: string) => {
    const symbols: { [key: string]: string } = { 'EUR': '€', 'RON': 'lei', 'USD': '$', 'GBP': '£' };
    return symbols[curr] || curr;
  };
  
  const cartCurrency = validCart.length > 0 && validCart[0].product?.currency ? validCart[0].product.currency : currency;
  const currencySymbol = cartCurrency === 'RON' ? 'lei' : getCurrencySymbol(cartCurrency);

  const handleUpdateQuantity = (itemId: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }
    updateQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = (itemId: number, productName: string) => {
    const item = validCart.find(cartItem => cartItem.id === itemId);
    trackEvent("cart_item_removed", {
      product_id: item?.productId || 0,
      quantity: item?.quantity || 0,
      market: getMarketFromHostname(),
    });
    removeFromCart(itemId);
    toast({
      title: t('cart.removedFromCart'),
      description: t('cart.removedDesc').replace('{name}', productName),
    });
  };

  const handleClearCart = () => {
    trackEvent("cart_cleared", {
      item_count: validCart.reduce((count, item) => count + item.quantity, 0),
      value: Number(total.toFixed(2)),
      currency: cartCurrency,
      market: getMarketFromHostname(),
    });
    clearCart();
    toast({
      title: t('cart.cartCleared'),
      description: t('cart.cartClearedDesc'),
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-muted-foreground">{t('cart.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-primary">{t('cart.title')}</h1>
          {validCart.length > 0 && (
            <Button variant="outline" onClick={handleClearCart}>
              {t('cart.clear')}
            </Button>
          )}
        </div>

        {validCart.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-2xl font-semibold mb-2">{t('cart.empty')}</h2>
              <p className="text-muted-foreground mb-6">
                {t('cart.emptyDesc')}
              </p>
              <Link href="/products">
                <Button size="lg" className="kitchen-pro-secondary">
                  {t('cart.continueShopping')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {validCart.map((item) => (
                <Card key={item.id}>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <img
                        src={item.product?.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=150&h=150"}
                        alt={item.product?.name || "Product"}
                        className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-primary mb-1 text-sm sm:text-base truncate">
                            {item.product?.name || "Unknown Product"}
                          </h3>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id, item.product?.name || "Unknown Product")}
                            className="text-red-600 hover:text-red-700 flex-shrink-0 h-7 w-7 p-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.product?.price ? formatPrice(getUnitPrice(item).toFixed(2), item.product.currency) : "0.00"} {t('cart.each')}
                          <span className="ml-1 text-xs">
                            {getLinePrice(item).priceDisplayMode === "net"
                              ? `(${market === "fr" ? "HT + TVA" : "Excl. VAT"}${getLinePrice(item).vatPercentage > 0 ? ` ${getLinePrice(item).vatPercentage}%` : ""})`
                              : `(${market === "fr" ? "TTC" : "Incl. VAT"})`}
                          </span>
                          {getLinePrice(item).priceDisplayMode === "net" && (
                            <span className="ml-1 text-xs">
                              · TTC / each {formatPrice(getLinePrice(item).priceGross.toFixed(2), item.product.currency)}
                            </span>
                          )}
                          {!item.compositeConfiguration && (() => {
                            const vd = (item.product as any).volumeDiscounts;
                            if (!Array.isArray(vd) || vd.length === 0) return null;
                            const active = vd.filter((t: any) => t.minQty > 0 && t.discountPercent > 0).sort((a: any, b: any) => b.minQty - a.minQty).find((t: any) => item.quantity >= t.minQty);
                            if (!active) return null;
                            return <span className="ml-1 text-xs text-emerald-600 font-medium">(-{active.discountPercent}%)</span>;
                          })()}
                        </p>
                        {item.compositeConfiguration?.components?.length ? (
                          <div className="mb-2 text-xs text-muted-foreground space-y-1">
                            {item.compositeConfiguration.components.map(component => (
                              <div key={component.componentProductId}>• {component.name || component.productCode || `#${component.componentProductId}`} × {component.quantity}</div>
                            ))}
                          </div>
                        ) : null}
                        
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="h-8 w-8 p-0"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center text-sm">{item.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              disabled={item.quantity >= (item.product?.stockQuantity || 0)}
                              className="h-8 w-8 p-0"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          
                          <span className="font-semibold text-sm sm:text-base">
                            {item.product?.price ? formatPrice((getUnitPrice(item) * item.quantity).toFixed(2), item.product.currency) : "0.00"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {item.product?.description && (
                      <div className="hidden md:block mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {item.product.description}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>{t('cart.orderSummary')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span>{taxLabels.subtotal}:</span>
                    <span>{taxSnapshot.subtotalNet} {currencySymbol}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span>{taxLabels.shipping}:</span>
                    <span>
                      {shipping === 0 ? (
                        <Badge variant="secondary">{t('cart.free')}</Badge>
                      ) : (
                        `${taxSnapshot.shippingDisplayAmount} ${currencySymbol}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>{taxLabels.vat} ({defaultVatPercentage}%):</span>
                    <span>{taxSnapshot.vatAmount} {currencySymbol}</span>
                  </div>
                  
                  {subtotal < freeShippingThreshold && (
                    <div className="text-sm text-muted-foreground">
                      {t('cart.addMoreForFree').replace('{amount}', `${(freeShippingThreshold - subtotal).toFixed(2)} ${currencySymbol}`)}
                    </div>
                  )}
                  
                  <Separator />
                  
                  <div className="flex justify-between font-semibold text-lg">
                    <span>{taxLabels.total}:</span>
                    <span>{total.toFixed(2)} {currencySymbol}</span>
                  </div>
                  
                  <Link href="/checkout">
                    <Button size="lg" className="w-full kitchen-pro-secondary">
                      {t('cart.checkout')}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  
                  <Link href="/products">
                    <Button variant="outline" className="w-full">
                      {t('cart.continueShopping')}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
