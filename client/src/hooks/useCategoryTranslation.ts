import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "../contexts/language-context";

interface TranslatedCategory {
  name: string;
  description: string | null;
}

export function useCategoryTranslations(categoryIds: number[]) {
  const { language } = useLanguage();

  const { data: translations = {} } = useQuery<Record<number, TranslatedCategory>>({
    queryKey: ["/api/category-translations", language, categoryIds.join(',')],
    queryFn: async () => {
      if (categoryIds.length === 0 || language === 'en') {
        return {};
      }
      const response = await fetch(`/api/category-translations/${language}?ids=${categoryIds.join(',')}`);
      if (!response.ok) {
        return {};
      }
      return response.json();
    },
    enabled: categoryIds.length > 0 && language !== 'en',
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const getCategoryName = (categoryId: number, originalName: string): string => {
    if (language === 'en' || !translations[categoryId]) {
      return originalName;
    }
    return translations[categoryId].name || originalName;
  };

  const getCategoryDescription = (categoryId: number, originalDescription: string | null): string | null => {
    if (language === 'en' || !translations[categoryId]) {
      return originalDescription;
    }
    return translations[categoryId].description || originalDescription;
  };

  return { getCategoryName, getCategoryDescription };
}
