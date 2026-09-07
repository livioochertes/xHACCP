export const ADMIN_CATEGORY_LANGUAGES = new Set(["ro", "en", "fr"]);

export function normalizeAdminLanguage(language: unknown): string | null {
  const normalized = String(language || "").split("-")[0].toLowerCase();
  return ADMIN_CATEGORY_LANGUAGES.has(normalized) ? normalized : null;
}

type CategoryTranslation = {
  categoryId: number;
  name?: string | null;
  description?: string | null;
};

type CategoryTranslationLoader = (
  categoryIds: number[],
  language: string,
) => Promise<CategoryTranslation[]>;

export async function localizeAdminCategories(
  categories: any[],
  requestedLanguage: unknown,
  market: string | undefined,
  loadTranslations: CategoryTranslationLoader,
): Promise<any[]> {
  const language = normalizeAdminLanguage(requestedLanguage);
  const idsByLanguage = new Map<string, Set<number>>();
  const languageForCategory = (category: any) => {
    const categoryMarket = market && market !== "all" ? market : category.marketCode;
    return categoryMarket === "com" ? "en" : categoryMarket || "ro";
  };

  for (const category of categories) {
    if (!category?.id) continue;
    const marketLanguage = languageForCategory(category);
    const primaryLanguage = language || marketLanguage;
    const fallbackLanguage = primaryLanguage === marketLanguage ? null : marketLanguage;
    for (const translationLanguage of [primaryLanguage, fallbackLanguage]) {
      if (!translationLanguage) continue;
      if (!idsByLanguage.has(translationLanguage)) idsByLanguage.set(translationLanguage, new Set());
      idsByLanguage.get(translationLanguage)!.add(category.id);
    }
  }

  const translationsByLanguage = new Map<string, Map<number, CategoryTranslation>>();
  await Promise.all(Array.from(idsByLanguage.entries()).map(async ([translationLanguage, ids]) => {
    const translations = await loadTranslations(Array.from(ids), translationLanguage);
    translationsByLanguage.set(
      translationLanguage,
      new Map(translations.map(translation => [translation.categoryId, translation])),
    );
  }));

  return categories.map(category => {
    const marketLanguage = languageForCategory(category);
    const primaryLanguage = language || marketLanguage;
    const fallbackLanguage = primaryLanguage === marketLanguage ? null : marketLanguage;
    const translation =
      translationsByLanguage.get(primaryLanguage)?.get(category.id) ||
      (fallbackLanguage ? translationsByLanguage.get(fallbackLanguage)?.get(category.id) : undefined);
    return {
      ...category,
      localizedName: translation?.name || category.name,
      localizedDescription: translation?.description || category.description,
    };
  });
}