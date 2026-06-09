import { useState, useMemo, useEffect } from "react";
import { useJsonLd } from "@/lib/use-json-ld";
import { usePageSeo } from "@/lib/use-page-seo";
import { toSeoText, truncateDesc } from "@/lib/seo-utils";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Star, ShoppingCart, Truck, Shield, ArrowLeft, Plus, Minus, Package, Phone, FileText, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useProductTranslation } from "@/hooks/useProductTranslation";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import { formatPrice } from "@/lib/utils";
import { Link } from "wouter";
import type { ProductWithCategory, Review } from "@shared/schema";

interface ShippingSettings {
  freeShippingThreshold: string;
  currency: string;
}

const SHORT_DESC_LIMIT = 220;

export default function ProductDetails() {
  const [, params] = useRoute("/products/:slug");
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [descExpanded, setDescExpanded] = useState(false);

  const { data: product, isLoading } = useQuery<ProductWithCategory & { _redirected?: boolean }>({
    queryKey: [`/api/products/slug/${params?.slug}`],
    enabled: !!params?.slug,
  });

  const { data: shippingSettings } = useQuery<ShippingSettings>({
    queryKey: ["/api/shipping-settings"],
  });

  const freeShippingText = shippingSettings
    ? formatPrice(shippingSettings.freeShippingThreshold, shippingSettings.currency)
    : formatPrice('1000', 'RON');

  useEffect(() => {
    if (product && (product as any)._redirected && product.slug) {
      window.history.replaceState(null, '', `/products/${product.slug}`);
    }
  }, [product]);

  const { data: reviews = [] } = useQuery<Review[]>({
    queryKey: ["/api/products", product?.id, "reviews"],
    enabled: !!product?.id,
  });

  const { name: translatedName, description: translatedDescription } = useProductTranslation(
    product?.id,
    product?.name || '',
    product?.description || null
  );

  const { getCategoryName } = useCategoryTranslations(
    product?.category ? [product.category.id] : [],
    product?.category ? [product.category as any] : []
  );

  const allImages = useMemo(() => {
    if (!product) return [];
    const images: string[] = [];
    if (product.imageUrl) images.push(product.imageUrl);
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img: any) => {
        const url = typeof img === 'string' ? img : img?.url;
        if (url && url !== product.imageUrl) images.push(url);
      });
    }
    return images.length > 0
      ? images
      : ["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800"];
  }, [product]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedImageIndex(0);
    setQuantity(1);
    setDescExpanded(false);
  }, [product?.id]);

  const productSchema = useMemo(() => {
    if (!product) return null;
    const origin = window.location.origin;
    const productUrl = `${origin}/products/${product.slug}`;
    const breadcrumbItems: Record<string, unknown>[] = [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": `${origin}/` },
      { "@type": "ListItem", "position": 2, "name": "Products", "item": `${origin}/products` },
    ];
    if (product.category) {
      breadcrumbItems.push({
        "@type": "ListItem",
        "position": 3,
        "name": product.category.name,
        "item": `${origin}/products?category=${product.category.slug}`,
      });
      breadcrumbItems.push({ "@type": "ListItem", "position": 4, "name": product.name, "item": productUrl });
    } else {
      breadcrumbItems.push({ "@type": "ListItem", "position": 3, "name": product.name, "item": productUrl });
    }

    const offer: Record<string, unknown> = {
      "@type": "Offer",
      "price": product.price,
      "priceCurrency": product.currency || "RON",
      "availability": product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      "url": productUrl,
    };

    const productObj: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": product.name,
      "sku": `KP-${product.id}`,
      "url": productUrl,
      "brand": { "@type": "Brand", "name": "xHACCP" },
      "offers": offer,
    };
    if (product.description) productObj["description"] = product.description;
    if (allImages.length > 0) productObj["image"] = allImages;
    const reviewCount = product.reviewCount || 0;
    if (reviewCount > 0 && product.rating) {
      productObj["aggregateRating"] = {
        "@type": "AggregateRating",
        "ratingValue": product.rating,
        "reviewCount": reviewCount,
      };
    }

    return [
      productObj,
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": breadcrumbItems,
      },
    ] as Record<string, unknown>[];
  }, [product, allImages]);

  useJsonLd("product-detail", productSchema);

  const seoTitle = useMemo(() => {
    if (!product) return undefined;
    const name = toSeoText(translatedName);
    const cat = product.category
      ? toSeoText(getCategoryName(product.category.id, product.category.name))
      : "";
    return cat ? `${cat} - ${name} | xHACCP` : `${name} | xHACCP`;
  }, [product, translatedName, getCategoryName]);

  const seoDescription = useMemo(() => {
    if (!product) return undefined;
    const name = toSeoText(translatedName);
    if (translatedDescription) return truncateDesc(toSeoText(translatedDescription));
    return `Cumpără ${name} de pe xHACCP. Echipamente și consumabile HACCP profesionale pentru bucătării comerciale și restaurante.`;
  }, [product, translatedName, translatedDescription]);

  usePageSeo({
    title: seoTitle,
    description: seoDescription,
    image: allImages[0],
    url: product ? `${window.location.origin}/products/${product.slug}` : undefined,
    type: "product",
  });

  const handleAddToCart = () => {
    if (!product) return;
    addToCart(product.id, quantity);
    toast({
      title: t('messages.addedToCart'),
      description: t('messages.addedToCartDesc').replace('{name}', translatedName),
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${i < Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200 fill-gray-200'}`}
      />
    ));
  };

  const shortDesc = useMemo(() => {
    const desc = translatedDescription || '';
    if (!desc) return '';
    if (desc.length <= SHORT_DESC_LIMIT) return desc;
    return desc.slice(0, SHORT_DESC_LIMIT).trimEnd() + '…';
  }, [translatedDescription]);

  const hasLongDesc = (translatedDescription || '').length > SHORT_DESC_LIMIT;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <div className="loading-spinner mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading product details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">Product not found</p>
            <Link href="/products">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Products
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const numRating = parseFloat(product.rating || "0");

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center flex-wrap gap-1 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-primary">{t('nav.home') || 'Home'}</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-primary">{t('nav.products') || 'Products'}</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link href={`/products?category=${product.category.slug}`} className="hover:text-primary">
                {getCategoryName(product.category.id, product.category.name)}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-foreground font-medium truncate max-w-[200px]">{translatedName}</span>
        </div>

        {/* ── Main 2-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">

          {/* LEFT — Image gallery */}
          <div className="space-y-3 lg:sticky lg:top-24">
            <div className="aspect-square rounded-2xl overflow-hidden border bg-white shadow-sm">
              <img
                src={allImages[selectedImageIndex] || allImages[0]}
                alt={translatedName}
                className="w-full h-full object-contain p-4"
                data-testid="product-main-image"
              />
            </div>
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" data-testid="product-thumbnails">
                {allImages.map((imageUrl, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    data-testid={`thumbnail-${index}`}
                  >
                    <img
                      src={imageUrl}
                      alt={`${translatedName} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Product info */}
          <div className="space-y-5">

            {/* Category + Title */}
            <div>
              {product.category && (
                <Link href={`/products?category=${product.category.slug}`}>
                  <Badge variant="secondary" className="mb-3 cursor-pointer hover:bg-secondary/80">
                    {getCategoryName(product.category.id, product.category.name)}
                  </Badge>
                </Link>
              )}
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 leading-snug">
                {translatedName}
              </h1>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">
                {formatPrice(product.price, product.currency)}
              </span>
              {product.compareAtPrice && (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.compareAtPrice, product.currency)}
                  </span>
                  <Badge variant="destructive" className="text-xs">
                    -{Math.round((1 - parseFloat(product.price) / parseFloat(product.compareAtPrice)) * 100)}%
                  </Badge>
                </>
              )}
            </div>

            {/* Stars + review count */}
            {product.reviewCount ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                  {renderStars(numRating)}
                </div>
                <span className="text-sm text-muted-foreground">
                  {product.reviewCount} {t('products.reviews') || 'avis'}
                </span>
              </div>
            ) : null}

            {/* Short description */}
            {shortDesc && (
              <div className="text-sm text-gray-600 leading-relaxed">
                <p>{descExpanded ? translatedDescription : shortDesc}</p>
                {hasLongDesc && (
                  <button
                    onClick={() => setDescExpanded(v => !v)}
                    className="text-primary text-sm font-medium mt-1 hover:underline"
                  >
                    {descExpanded ? t('products.readLess') || 'Voir moins' : t('products.readMore') || 'Lire la suite'}
                  </button>
                )}
              </div>
            )}

            <Separator />

            {/* Reference + Stock */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium text-gray-700">{t('products.reference') || 'Référence'}:</span>
                <span className="font-mono text-gray-500">KP-{product.id}</span>
              </div>

              {product.inStock ? (
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle className="h-4 w-4 flex-shrink-0" />
                  <span className="font-medium">{t('products.inStock') || 'En stock'}</span>
                  {product.stockQuantity ? (
                    <span className="text-green-600 text-xs">
                      ({product.stockQuantity} {t('products.units') || 'unités'})
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <div className="w-4 h-4 flex-shrink-0 rounded-full border-2 border-red-400" />
                  <span className="font-medium">{t('products.outOfStock') || 'Rupture de stock'}</span>
                </div>
              )}

              {/* Estimated delivery */}
              {product.inStock && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Truck className="h-4 w-4 flex-shrink-0" />
                  <span>{t('products.estimatedDelivery') || `${t('products.freeShippingOver') || 'Livrare gratuită peste'} ${freeShippingText}`}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Quantity selector + Add to cart */}
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {/* Qty */}
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    className="px-3 py-2 hover:bg-gray-100 transition-colors text-gray-600"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="px-4 py-2 font-semibold text-center min-w-[3rem] border-x text-gray-900">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(q => q + 1)}
                    className="px-3 py-2 hover:bg-gray-100 transition-colors text-gray-600"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <Button
                  size="lg"
                  className="flex-1 kitchen-pro-secondary"
                  onClick={handleAddToCart}
                  disabled={!product.inStock}
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  {t('products.addToCart')}
                </Button>
              </div>
            </div>

            {/* Trust badges */}
            <div className="rounded-xl border bg-white p-4 space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-700">
                <Shield className="h-5 w-5 text-green-600 flex-shrink-0" />
                <span>{t('products.securePayment') || 'Paiement 100% sécurisé'}</span>
              </div>
              <Separator className="my-0" />
              <div className="flex items-center gap-3 text-gray-700">
                <Truck className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <span>{t('products.freeShippingOver').replace('{amount}', freeShippingText)}</span>
              </div>
              <Separator className="my-0" />
              <div className="flex items-center gap-3 text-gray-700">
                <FileText className="h-5 w-5 text-orange-500 flex-shrink-0" />
                <span>{t('products.haccpCompatible') || 'HACCP compatible'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* ── Full-width tabs below ── */}
        <div className="mt-16">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="description">{t('products.description')}</TabsTrigger>
              <TabsTrigger value="specifications">{t('products.specifications')}</TabsTrigger>
              <TabsTrigger value="reviews">{t('products.reviews')} ({reviews.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-6">
              <Card>
                <CardContent className="p-8">
                  <div className="prose max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                    {translatedDescription || t('products.noDescription')}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specifications" className="mt-6">
              <Card>
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900">{t('products.details')}</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <dt className="text-muted-foreground">{t('products.sku')}:</dt>
                          <dd className="font-medium font-mono">KP-{product.id}</dd>
                        </div>
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <dt className="text-muted-foreground">{t('products.category')}:</dt>
                          <dd className="font-medium">{product.category ? getCategoryName(product.category.id, product.category.name) : "N/A"}</dd>
                        </div>
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <dt className="text-muted-foreground">{t('products.stock')}:</dt>
                          <dd className="font-medium">{product.stockQuantity || 0} {t('products.units')}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3 text-gray-900">{t('products.compliance')}</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <dt className="text-muted-foreground">{t('products.fdaApproved')}:</dt>
                          <dd className="font-medium text-green-600">{t('products.yes')}</dd>
                        </div>
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <dt className="text-muted-foreground">{t('products.haccpCompatible')}:</dt>
                          <dd className="font-medium text-green-600">{t('products.yes')}</dd>
                        </div>
                        <div className="flex justify-between py-1.5 border-b text-sm">
                          <dt className="text-muted-foreground">{t('products.foodSafe')}:</dt>
                          <dd className="font-medium text-green-600">{t('products.yes')}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardContent className="p-8">
                  {reviews.length > 0 ? (
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-0.5">
                              {renderStars(review.rating as unknown as number)}
                            </div>
                            <span className="text-sm font-medium text-gray-700">
                              {(review as any).authorName || 'Client'}
                            </span>
                            <span className="text-sm text-muted-foreground ml-auto">
                              {new Date(review.createdAt || "").toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm leading-relaxed">{review.comment}</p>
                          <Separator />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">{t('products.noReviews')}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      </div>
    </div>
  );
}
