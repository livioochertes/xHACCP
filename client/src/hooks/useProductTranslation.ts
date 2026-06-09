import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "../contexts/language-context";
import { getMarketFromHostname } from "../lib/queryClient";
import { toSlug } from "../lib/slug-utils";
import type { ProductTranslation } from "@shared/schema";

interface TranslatedProduct {
  name: string;
  description: string | null;
}

export function useProductTranslation(productId: number | undefined, originalName: string, originalDescription: string | null, originalSlug?: string) {
  const { language } = useLanguage();
  
  const { data: translation } = useQuery<ProductTranslation>({
    queryKey: [`/api/products/${productId}/translation/${language}`],
    enabled: !!productId && language !== 'en',
  });

  if (!productId || language === 'en' || !translation) {
    return {
      name: originalName,
      description: originalDescription,
      localizedSlug: originalSlug || null,
    };
  }

  const translatedName = translation.name || originalName;
  // Only use slug stored in DB — never generate client-side (client slug can't be resolved by backend)
  const localizedSlug = translation.slug || null;

  return {
    name: translatedName,
    description: translation.description || originalDescription,
    localizedSlug,
  };
}

export function useProductTranslations(productIds: number[]) {
  const { language } = useLanguage();
  
  const { data: translations = {} } = useQuery<Record<number, TranslatedProduct>>({
    queryKey: ["/api/translations", language, productIds.join(',')],
    queryFn: async () => {
      if (productIds.length === 0 || language === 'en') {
        return {};
      }
      const response = await fetch(`/api/translations/${language}?ids=${productIds.join(',')}`, {
        headers: { 'X-Market': getMarketFromHostname() }
      });
      if (!response.ok) {
        return {};
      }
      return response.json();
    },
    enabled: productIds.length > 0 && language !== 'en',
  });

  const getTranslation = (productId: number, originalName: string, originalDescription: string | null): TranslatedProduct => {
    if (language === 'en' || !translations[productId]) {
      return { name: originalName, description: originalDescription };
    }
    return {
      name: translations[productId].name || originalName,
      description: translations[productId].description || originalDescription
    };
  };

  return { translations, getTranslation };
}
