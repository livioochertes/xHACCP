import { Link } from "wouter";
import { Star, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useCart } from "@/hooks/use-cart";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useProductTranslation } from "@/hooks/useProductTranslation";
import { useCategoryTranslations } from "@/hooks/useCategoryTranslation";
import { formatPrice } from "@/lib/utils";
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
  const { name: translatedName } = useProductTranslation(product.id, product.name, product.description);
  const { getCategoryName } = useCategoryTranslations(
    product.category ? [product.category.id] : [],
    product.category ? [product.category as any] : []
  );

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart(product.id, 1);
    toast({
      title: t('messages.addedToCart'),
      description: t('messages.addedToCartDesc').replace('{name}', translatedName),
    });
  };

  const rating = parseFloat(product.rating || "0");

  const specs = Array.isArray((product as any).specs)
    ? ((product as any).specs as { label: string; value: string }[]).filter(s => s.label && s.value)
    : [];
  const visibleSpecs = specs.slice(0, 3);

  return (
    <Card className="product-card group cursor-pointer hover:shadow-md transition-shadow h-full">
      <Link href={`/products/${product.slug}`}>
        <CardContent className="p-0 h-full flex flex-col">
          <div className="relative">
            <img
              src={product.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=300"}
              alt={translatedName}
              className="w-full h-48 object-cover"
              loading="lazy"
            />
            {product.compareAtPrice && (
              <Badge className="absolute top-2 left-2 bg-red-500 text-white text-xs">
                Sale
              </Badge>
            )}
          </div>
          
          <div className="p-4 flex-1 flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 text-base">{translatedName}</h3>
              
              {product.category && (
                <Badge variant="secondary" className="mb-3 text-xs">
                  {getCategoryName(product.category.id, product.category.name)}
                </Badge>
              )}
              
              <div className="flex items-center mb-4">
                <div className="flex items-center text-yellow-400 mr-2">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="ml-1 text-sm font-medium text-gray-900">{rating.toFixed(1)}</span>
                </div>
                <span className="text-sm text-gray-500">
                  ({product.reviewCount || 0} reviews)
                </span>
              </div>
            </div>
            
            <div className="flex flex-col space-y-3">
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-2xl font-bold text-emerald-600">
                    {formatPrice(product.price, product.currency)}
                  </span>
                  {product.compareAtPrice && (
                    <span className="text-sm text-gray-500 line-through">
                      {formatPrice(product.compareAtPrice, product.currency)}
                    </span>
                  )}
                </div>
                {product.compareAtPrice && (
                  <Badge variant="destructive" className="text-xs w-fit">
                    {t('products.save')} {formatPrice((parseFloat(product.compareAtPrice) - parseFloat(product.price)).toString(), product.currency)}
                  </Badge>
                )}
              </div>

              {/* Specs shown below price — only when product has specs */}
              {visibleSpecs.length > 0 && (
                <p className="text-xs text-gray-500 leading-relaxed">
                  {visibleSpecs.map((spec, i) => (
                    <span key={i}>
                      {i > 0 && <span className="mx-1.5 text-gray-300">•</span>}
                      <span className="font-medium text-gray-600">{spec.label}:</span>{" "}
                      <span>{spec.value}</span>
                    </span>
                  ))}
                </p>
              )}
              
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
  const { name: translatedName, description: translatedDescription } = useProductTranslation(
    product.id,
    product.name,
    product.description
  );
  const { getCategoryName } = useCategoryTranslations(
    product.category ? [product.category.id] : [],
    product.category ? [product.category as any] : []
  );

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product.id, 1);
    toast({
      title: t('messages.addedToCart'),
      description: t('messages.addedToCartDesc').replace('{name}', translatedName),
    });
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
          <Link href={`/products/${product.slug}`} className="shrink-0">
            <div className="relative w-36 h-32 sm:w-44 sm:h-36 rounded-md overflow-hidden bg-gray-100">
              <img
                src={product.imageUrl || "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=400&h=300"}
                alt={translatedName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                loading="lazy"
              />
              {product.compareAtPrice && (
                <Badge className="absolute top-1.5 left-1.5 bg-red-500 text-white text-xs">
                  Sale
                </Badge>
              )}
            </div>
          </Link>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
            <div>
              <Link href={`/products/${product.slug}`}>
                <h3 className="font-semibold text-gray-900 text-base hover:text-emerald-700 transition-colors line-clamp-2">
                  {translatedName}
                </h3>
              </Link>

              {product.category && (
                <Badge variant="secondary" className="mt-1 text-xs">
                  {getCategoryName(product.category.id, product.category.name)}
                </Badge>
              )}

              {/* Specs */}
              {visibleSpecs.length > 0 && (
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
                      href={`/products/${product.slug}#description`}
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
                {product.compareAtPrice && (
                  <span className="text-sm text-gray-500 line-through">
                    {formatPrice(product.compareAtPrice, product.currency)}
                  </span>
                )}
                {product.compareAtPrice && (
                  <Badge variant="destructive" className="text-xs">
                    {t('products.save')} {formatPrice((parseFloat(product.compareAtPrice) - parseFloat(product.price)).toString(), product.currency)}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
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
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export default ProductCard;
