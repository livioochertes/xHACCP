import { useLanguage } from "../contexts/language-context";

interface CategoryWithTranslations {
  id: number;
  name: string;
  description: string | null;
  translations?: Record<string, { name: string; description: string | null }>;
}

export function useCategoryTranslations(categoryIds: number[], categories?: CategoryWithTranslations[]) {
  const { language } = useLanguage();

  const getCategoryName = (categoryId: number, originalName: string): string => {
    if (language === 'en') return originalName;
    const category = categories?.find(c => c.id === categoryId);
    const translation = category?.translations?.[language];
    return translation?.name || originalName;
  };

  const getCategoryDescription = (categoryId: number, originalDescription: string | null): string | null => {
    if (language === 'en') return originalDescription;
    const category = categories?.find(c => c.id === categoryId);
    const translation = category?.translations?.[language];
    return translation?.description || originalDescription;
  };

  return { getCategoryName, getCategoryDescription };
}
