import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Star, ShoppingCart, Truck, Shield, ArrowLeft } from "lucide-react";
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

export default function ProductDetails() {
  const [, params] = useRoute("/products/:slug");
  const { addToCart } = useCart();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const { data: product, isLoading } = useQuery<ProductWithCategory & { _redirected?: boolean }>({
    queryKey: [`/api/products/slug/${params?.slug}`],
    enabled: !!params?.slug,
  });

  const { data: shippingSettings } = useQuery<ShippingSettings>({
    queryKey: ["/api/shipping-settings"],
  });

  const freeShippingText = shippingSettings
    ? `${parseFloat(shippingSettings.freeShippingThreshold).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} lei`
    : '1000 lei';

  // Auto-redirect when fuzzy match found (old URL → correct product URL)
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
    if (product.imageUrl) {
      images.push(product.imageUrl);
    }
    if (product.images && Array.isArray(product.images)) {
      product.images.forEach((img: any) => {
        const url = typeof img === 'string' ? img : img?.url;
        if (url && url !== product.imageUrl) {
          images.push(url);
        }
      });
    }
    return images.length > 0 ? images : ["https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=800"];
  }, [product]);

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedImageIndex(0);
  }, [product?.id]);

  const handleAddToCart = () => {
    if (!product) return;
    
    addToCart(product.id, 1);
    toast({
      title: t('messages.addedToCart'),
      description: t('messages.addedToCartDesc').replace('{name}', translatedName),
    });
  };

  const renderStars = (rating: string | number) => {
    const numRating = typeof rating === 'string' ? parseFloat(rating) : rating;
    return (
      <div className="flex items-center">
        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
        <span className="ml-1 text-sm font-medium">{numRating.toFixed(1)}</span>
      </div>
    );
  };

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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-8">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link href="/products" className="hover:text-primary">Products</Link>
          {product.category && (
            <>
              <span>/</span>
              <Link href={`/products?category=${product.category.slug}`} className="hover:text-primary">
                {getCategoryName(product.category.id, product.category.name)}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="text-primary">{translatedName}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image Gallery */}
          <div className="space-y-4">
            {/* Main Image - white background to match product images */}
            <div className="aspect-square rounded-lg overflow-hidden border bg-white">
              <img
                src={allImages[selectedImageIndex] || allImages[0]}
                alt={translatedName}
                className="w-full h-full object-contain"
                data-testid="product-main-image"
              />
            </div>
            
            {/* Thumbnail Images */}
            {allImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-2" data-testid="product-thumbnails">
                {allImages.map((imageUrl, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    data-testid={`thumbnail-${index}`}
                  >
                    <img
                      src={imageUrl}
                      alt={`${translatedName} - Image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="space-y-6">
            <div>
              {product.category && (
                <Badge variant="secondary" className="mb-2">
                  {getCategoryName(product.category.id, product.category.name)}
                </Badge>
              )}
              <h1 className="text-3xl font-bold text-primary mb-4">{translatedName}</h1>
              
              {/* Rating */}
              <div className="flex items-center space-x-2 mb-4">
                <div className="flex">
                  {renderStars(parseFloat(product.rating || "0"))}
                </div>
                <span className="text-sm text-muted-foreground">
                  ({product.reviewCount || 0} reviews)
                </span>
              </div>

              {/* Price */}
              <div className="flex items-center space-x-4 mb-6">
                <span className="text-3xl font-bold text-primary">
                  {formatPrice(product.price, product.currency)}
                </span>
                {product.compareAtPrice && (
                  <span className="text-xl text-muted-foreground line-through">
                    {formatPrice(product.compareAtPrice, product.currency)}
                  </span>
                )}
                {product.compareAtPrice && (
                  <Badge variant="destructive">
                    Save {formatPrice((parseFloat(product.compareAtPrice) - parseFloat(product.price)).toString(), product.currency)}
                  </Badge>
                )}
              </div>

              {/* Stock Status */}
              <div className="mb-6">
                {product.inStock ? (
                  <div className="flex items-center text-green-600">
                    <div className="w-2 h-2 bg-green-600 rounded-full mr-2"></div>
                    <span>{t('products.inStock')} ({t('products.available').replace('{count}', String(product.stockQuantity || 0))})</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <div className="w-2 h-2 bg-red-600 rounded-full mr-2"></div>
                    <span>{t('products.outOfStock')}</span>
                  </div>
                )}
              </div>

              {/* Add to Cart */}
              <Button
                size="lg"
                className="w-full kitchen-pro-secondary mb-6"
                onClick={handleAddToCart}
                disabled={!product.inStock}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                {t('products.addToCart')}
              </Button>

              {/* Trust Badges */}
              <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                <div className="flex items-center">
                  <Truck className="h-4 w-4 mr-1" />
                  <span>{t('products.freeShippingOver').replace('{amount}', freeShippingText)}</span>
                </div>
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  <span>{t('products.fdaCompliant')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Details Tabs */}
        <div className="mt-16">
          <Tabs defaultValue="description" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="description">{t('products.description')}</TabsTrigger>
              <TabsTrigger value="specifications">{t('products.specifications')}</TabsTrigger>
              <TabsTrigger value="reviews">{t('products.reviews')} ({reviews.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="description" className="mt-8">
              <Card>
                <CardContent className="p-8">
                  <div className="prose max-w-none">
                    <p className="text-muted-foreground leading-relaxed">
                      {translatedDescription || t('products.noDescription')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="specifications" className="mt-8">
              <Card>
                <CardContent className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-2">{t('products.details')}</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t('products.sku')}:</dt>
                          <dd className="font-medium">KP-{product.id}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t('products.category')}:</dt>
                          <dd className="font-medium">{product.category?.name || "N/A"}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t('products.stock')}:</dt>
                          <dd className="font-medium">{product.stockQuantity || 0} {t('products.units')}</dd>
                        </div>
                      </dl>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2">{t('products.compliance')}</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t('products.fdaApproved')}:</dt>
                          <dd className="font-medium text-green-600">{t('products.yes')}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t('products.haccpCompatible')}:</dt>
                          <dd className="font-medium text-green-600">{t('products.yes')}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">{t('products.foodSafe')}:</dt>
                          <dd className="font-medium text-green-600">{t('products.yes')}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-8">
              <Card>
                <CardContent className="p-8">
                  {reviews.length > 0 ? (
                    <div className="space-y-6">
                      {reviews.map((review) => (
                        <div key={review.id} className="space-y-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex">
                              {renderStars(review.rating)}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {new Date(review.createdAt || "").toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-muted-foreground">{review.comment}</p>
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
