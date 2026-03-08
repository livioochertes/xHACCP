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
import type { ProductWithCategory } from "@shared/schema";
import { memo } from "react";

interface ProductCardProps {
  product: ProductWithCategory;
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
  const discount = product.compareAtPrice 
    ? (parseFloat(product.compareAtPrice) - parseFloat(product.price)).toFixed(2)
    : null;

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
                    {parseFloat(product.price).toFixed(2)} {product.currency === 'RON' ? 'lei' : product.currency}
                  </span>
                  {product.compareAtPrice && (
                    <span className="text-sm text-gray-500 line-through">
                      {parseFloat(product.compareAtPrice).toFixed(2)} {product.currency === 'RON' ? 'lei' : product.currency}
                    </span>
                  )}
                </div>
                {product.compareAtPrice && (
                  <Badge variant="destructive" className="text-xs w-fit">
{t('products.save')} {(parseFloat(product.compareAtPrice) - parseFloat(product.price)).toFixed(2)} {product.currency === 'RON' ? 'lei' : product.currency}
                  </Badge>
                )}
              </div>
              
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

export default ProductCard;
