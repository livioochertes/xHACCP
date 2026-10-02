import { ArrowRight, ShoppingCart, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PreviewProduct = {
  name: string;
  category: string;
  imageUrl: string;
  price: number;
  compareAtPrice?: number;
  description?: string;
  specs?: string;
  isSubscription?: boolean;
};

const products: PreviewProduct[] = [
  {
    name: "Boîte de 8 rouleaux de 300 étiquettes",
    category: "Étiquettes HACCP Alimentaires",
    imageUrl: "/__mockup/images/products/fr-label-rolls.jpeg",
    price: 59,
    specs: "Taille: 38 x 58 mm • Quantité par rouleau: 300 étiquettes • Quantité totale: 2.400 étiquettes",
    description: "Lot de 8 rouleaux d'étiquettes KitOff — impression automatique avec l'application KitOff.",
  },
  {
    name: "Boîte de 8 rouleaux 670 d'étiquettes",
    category: "Étiquettes HACCP Alimentaires",
    imageUrl: "/__mockup/images/products/fr-economic-rolls.jpeg",
    price: 79.9,
    compareAtPrice: 94.4,
    specs: "Format: 38 x 58 mm • Quantité par rouleau: 670 étiquettes • Quantité totale: 5.360 étiquettes",
    description: "Lot de 8 rouleaux d'étiquettes KitOff — pack économique pour l'impression automatique.",
  },
  {
    name: "Imprimante d'étiquette KitOff",
    category: "Équipement & Logiciel",
    imageUrl: "/__mockup/images/products/fr-label-printer.jpeg",
    price: 14.9,
    description: "Louez notre imprimante d'étiquettes. Thermique directe, sans encre ni toner.",
    isSubscription: true,
  },
];

const price = (value: number) =>
  `€${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PreviewCard({
  product,
  reserveDiscountRow,
}: {
  product: PreviewProduct;
  reserveDiscountRow: boolean;
}) {
  const hasDiscount = product.compareAtPrice !== undefined;

  return (
    <Card className="product-card group h-full cursor-pointer transition-shadow hover:shadow-md">
      <a href="#" onClick={(event) => event.preventDefault()}>
        <CardContent className="flex h-full flex-col p-0">
          <div className="relative">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="h-48 w-full object-cover"
              loading="lazy"
            />
            {hasDiscount && (
              <Badge className="absolute left-2 top-2 bg-red-500 text-xs text-white">Sale</Badge>
            )}
          </div>

          <div className="flex flex-1 flex-col p-4">
            <div className="flex-1">
              <h3 className="mb-2 line-clamp-2 text-base font-semibold text-gray-900">
                {product.name}
              </h3>
              <Badge variant="secondary" className="mb-2 text-xs">
                {product.category}
              </Badge>
              {product.isSubscription && (
                <Badge className="mb-2 ml-1 bg-blue-100 text-xs text-blue-800 hover:bg-blue-100">
                  Abonnement mensuel
                </Badge>
              )}
              {product.specs && (
                <p className="mb-2 text-xs leading-relaxed text-gray-500">{product.specs}</p>
              )}
              {product.description && (
                <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-gray-500">
                  {product.description}
                </p>
              )}
              <div className="mb-2 flex items-center">
                <div className="mr-2 flex items-center text-yellow-400">
                  <Star className="h-4 w-4 fill-current" />
                  <span className="ml-1 text-sm font-medium text-gray-900">0.0</span>
                </div>
                <span className="text-sm text-gray-500">(0 reviews)</span>
              </div>
            </div>

            <div className="mt-auto flex flex-col space-y-2 pt-3">
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold text-emerald-600">{price(product.price)}</span>
                <span className="text-xs text-muted-foreground">HT + TVA 20%</span>
                {hasDiscount && (
                  <span className="text-sm text-gray-500 line-through">
                    {price(product.compareAtPrice!)}
                  </span>
                )}
              </div>

              {reserveDiscountRow ? (
                <div className="flex h-5 items-start">
                  {hasDiscount && (
                    <Badge variant="destructive" className="w-fit whitespace-nowrap text-xs">
                      Économiser {price(product.compareAtPrice! - product.price)}
                    </Badge>
                  )}
                </div>
              ) : (
                hasDiscount && (
                  <Badge variant="destructive" className="w-fit text-xs">
                    Économiser {price(product.compareAtPrice! - product.price)}
                  </Badge>
                )
              )}

              <Button
                onClick={(event) => event.preventDefault()}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white shadow-md transition-colors duration-200 hover:bg-emerald-700 hover:shadow-lg"
              >
                <ShoppingCart className="mr-2 h-4 w-4" />
                Ajouter au Panier
              </Button>
            </div>
          </div>
        </CardContent>
      </a>
    </Card>
  );
}

export function ProductCardPreview({ reserveDiscountRow }: { reserveDiscountRow: boolean }) {
  return (
    <main className="fr-product-card-preview">
      <div className="fr-product-card-grid">
        {products.map((product) => (
          <PreviewCard
            key={product.name}
            product={product}
            reserveDiscountRow={reserveDiscountRow}
          />
        ))}
      </div>
    </main>
  );
}