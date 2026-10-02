import { Link, useLocation } from "wouter";
import { Star, ShoppingCart, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useProductTranslation } from "@/hooks/useProductTranslation";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import { formatPrice } from "@/lib/utils";
import { getMarketFromHostname } from "@/lib/queryClient";
import type { ProductWithCategory } from "@shared/schema";
import { memo } from "react";

interface ProductCardProps {
  product: ProductWithCategory;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const ProductCard = memo(function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { name: translatedName, description: translatedDescription, localizedSlug } = useProductTranslation(product.id, product.name, product.description, product.slug);
  const { getCategoryName } = useCategoryTranslations(
    product.category ? [product.category.id] : [],
    product.category ? [product.category as any] : []
  );

  const isService = !!(product as any).isService;
  const isSubscription = (product as any).productType === "subscription";
  const isComposite = !!(product as any).isComposite;
  const productSlug = localizedSlug || product.slug;
  const market = getMarketFromHostname();
  const priceDisplayMode = (product as any).priceDisplayMode === "net" ? "net" : "gross";
  const vatPercentage = Number((product as any).vatPercentage ?? 0);
  const priceBasisLabel = priceDisplayMode === "net"
    ? `${market === "fr" ? "HT + TVA" : market === "ro" ? "Fără TVA + TVA" : "Excl. VAT"}${vatPercentage > 0 ? ` ${vatPercentage}%` : ""}`
    : market === "fr" ? "TTC" : market === "ro" ? "TVA inclusă" : "Incl. VAT";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product.id, 1);
    toast({
      title: t('messages.addedToCart'),
      description: t('messages.addedToCartDesc').replace('{name}', translatedName),
    });
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/products/${productSlug}`);
  };

  const rating = parseFloat(product.rating || "0");

  const specs = Array.isArray((product as any).specs)
    ? ((product as any).specs as { label: string; value: string }[]).filter(s => s.label && s.value)
    : [];
  const visibleSpecs = specs.slice(0, 3);

  const descSnippet = stripHtml(translatedDescription);

  return (
    <Card className="product-card group cursor-pointer hover:shadow-md transition-shadow h-full">
      <Link href={`/products/${productSlug}`}>
        <CardContent className="p-0 h-full flex flex-col">
          {/* Image */}
          <div className="relative">
            <img
              src={product.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=300"}
              alt={translatedName}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
            {product.compareAtPrice && !isService && (
              <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs">
                Sale
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="p-4 flex-1 flex flex-col">
            {/* Info section: name, category, specs, description, stars */}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-base">{translatedName}</h3>

              {product.category && (
                <Badge variant="secondary" className="mb-2 text-xs">
                  {getCategoryName(product.category.id, product.category.name)}
                </Badge>
              )}
              {isSubscription && (
                <Badge className="mb-2 ml-1 text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
                  {t('products.subscription')}
                </Badge>
              )}

              {/* Specs moved here — above description, not between price and button */}
              {visibleSpecs.length > 0 && !isService && (
                <p className="text-xs text-gray-500 leading-relaxed mb-2">
                  {visibleSpecs.map((spec, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1.5 text-gray-300">•</span>}
                      <span className="font-medium text-gray-600">{spec.label}:</span>{" "}
                      <span>{spec.value}</span>
                    </span>
                  ))}
                </p>
              )}

              {descSnippet && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">{descSnippet}</p>
              )}

              <div className="flex items-center mb-2">
                <div className="flex items-center text-yellow-400 mr-2">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="ml-1 text-sm font-medium text-gray-900">{rating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">
                  ({product.reviewCount || 0} reviews)
                </span>
              </div>
            </div>

            {/* Action section: price + discount badge + button — always at bottom */}
            <div className="mt-auto pt-3 flex flex-col space-y-2">
              {/* Price row */}
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-emerald-600">
                  {formatPrice(product.price, product.currency)}
                </span>
                <span className="text-xs text-muted-foreground">{priceBasisLabel}</span>
                {product.compareAtPrice && !isService && (
                  <span className="text-sm text-gray-500 line-through">
                    {formatPrice(product.compareAtPrice, product.currency)}
                  </span>
                )}
              </div>
              {/* Keep the price and discount rows aligned across cards. */}
              <div
                className="flex h-5 items-start"
                aria-hidden={!product.compareAtPrice || isService}
              >
                {product.compareAtPrice && !isService && (
                  <Badge variant="destructive" className="text-xs w-fit whitespace-nowrap">
                    {t('products.save')} {formatPrice((parseFloat(product.compareAtPrice) - parseFloat(product.price)).toString(), product.currency)}
                  </Badge>
                )}
              </div>

              {/* CTA button */}
              {isService || isComposite ? (
                <Button
                  onClick={handleViewDetails}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  {t('products.viewDetails')}
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleAddToCart}
                    disabled={!product.inStock}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {t('products.addToCart')}
                  </Button>
                  {!product.inStock && (
                    <Badge variant="destructive" className="w-full text-center">
                      {t('products.outOfStock')}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
});

export const ProductListItem = memo(function ProductListItem({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const { name: translatedName, description: translatedDescription, localizedSlug } = useProductTranslation(
    product.id,
    product.name,
    product.description,
    product.slug
  );
  const { getCategoryName } = useCategoryTranslations(
    product.category ? [product.category.id] : [],
    product.category ? [product.category as any] : []
  );

  const isService = !!(product as any).isService;
  const isSubscription = (product as any).productType === "subscription";
  const isComposite = !!(product as any).isComposite;
  const productSlug = localizedSlug || product.slug;
  const market = getMarketFromHostname();
  const priceDisplayMode = (product as any).priceDisplayMode === "net" ? "net" : "gross";
  const vatPercentage = Number((product as any).vatPercentage ?? 0);
  const priceBasisLabel = priceDisplayMode === "net"
    ? `${market === "fr" ? "HT + TVA" : market === "ro" ? "Fără TVA + TVA" : "Excl. VAT"}${vatPercentage > 0 ? ` ${vatPercentage}%` : ""}`
    : market === "fr" ? "TTC" : market === "ro" ? "TVA inclusă" : "Incl. VAT";

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product.id, 1);
    toast({
      title: t('messages.addedToCart'),
      description: t('messages.addedToCartDesc').replace('{name}', translatedName),
    });
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/products/${productSlug}`);
  };

  const specs = Array.isArray((product as any).specs)
    ? ((product as any).specs as { label: string; value: string }[]).filter(s => s.label && s.value)
    : [];
  const visibleSpecs = specs.slice(0, 3);

  const descriptionText = stripHtml(translatedDescription);
  const snippet = descriptionText.length > 120 ? descriptionText.slice(0, 120).trimEnd() + "…" : descriptionText;

  return (
    <Card className="product-card group cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-0">
        <div className="flex gap-4 p-4">
          {/* Image */}
          <Link href={`/products/${productSlug}`} className="shrink-0">
            <div className="relative w-36 h-32 sm:w-44 sm:h-36 rounded-md overflow-hidden bg-gray-100">
              <img
                src={product.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=300"}
                alt={translatedName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
              {product.compareAtPrice && !isService && (
                <Badge className="absolute top-1.5 left-1.5 bg-red-500 text-white text-xs">
                  Sale
                </Badge>
              )}
            </div>
          </Link>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
            <div>
              <Link href={`/products/${productSlug}`}>
                <h3 className="font-semibold text-gray-900 text-base hover:text-emerald-700 transition-colors line-clamp-2">
                  {translatedName}
                </h3>
              </Link>

              {product.category && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {getCategoryName(product.category.id, product.category.name)}
                </Badge>
              )}
              {isSubscription && (
                <Badge className="mt-1 ml-1 text-xs bg-blue-100 text-blue-800 hover:bg-blue-100">
                  {t('products.subscription')}
                </Badge>
              )}

              {/* Specs */}
              {visibleSpecs.length > 0 && !isService && (
                <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                  {visibleSpecs.map((spec, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1.5 text-gray-300">•</span>}
                      <span className="font-medium text-gray-600">{spec.label}:</span>{" "}
                      <span>{spec.value}</span>
                    </span>
                  ))}
                </p>
              )}

              {/* Description snippet */}
              {snippet && (
                <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">
                  {snippet}{" "}
                  {descriptionText.length > 120 && (
                    <Link
                      href={`/products/${productSlug}#description`}
                      className="text-emerald-600 hover:underline font-medium whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {t('products.readMore') || 'Citește mai mult'}
                    </Link>
                  )}
                </p>
              )}
            </div>

            {/* Price + actions */}
            <div className="flex items-center justify-between flex-wrap gap-2 mt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xl font-bold text-emerald-600">
                  {formatPrice(product.price, product.currency)}
                </span>
                <span className="text-xs text-muted-foreground">{priceBasisLabel}</span>
                {product.compareAtPrice && !isService && (
                  <span className="text-sm text-gray-500 line-through">
                    {formatPrice(product.compareAtPrice, product.currency)}
                  </span>
                )}
                {product.compareAtPrice && !isService && (
                  <Badge variant="destructive" className="text-xs">
                    {t('products.save')} {formatPrice((parseFloat(product.compareAtPrice) - parseFloat(product.price)).toString(), product.currency)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isService || isComposite ? (
                  <Button
                    onClick={handleViewDetails}
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors duration-200 shadow-sm hover:shadow-md"
                  >
                    <ArrowRight className="h-4 w-4 mr-1.5" />
                    {t('products.viewDetails')}
                  </Button>
                ) : (
                  <>
                    {!product.inStock && (
                      <Badge variant="destructive" className="text-xs">
                        {t('products.outOfStock')}
                      </Badge>
                    )}
                    <Button
                      onClick={handleAddToCart}
                      disabled={!product.inStock}
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-colors duration-200 shadow-sm hover:shadow-md"
                    >
                      <ShoppingCart className="h-4 w-4 mr-1.5" />
                      {t('products.addToCart')}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ProductCard;
