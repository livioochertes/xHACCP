import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  localizeAdminCategories,
  normalizeAdminLanguage,
} from "./admin-category-localization";

test("uses the selected admin language without changing category identity", async () => {
  const category = {
    id: 12,
    name: "Etichete",
    description: "Descriere de bază",
    slug: "etichete",
    marketCode: "ro",
  };
  const calls: Array<{ ids: number[]; language: string }> = [];

  const localized = await localizeAdminCategories(
    [category],
    "fr-FR",
    "ro",
    async (ids, language) => {
      calls.push({ ids, language });
      return language === "fr"
        ? [{ categoryId: 12, name: "Étiquettes", description: "Description française" }]
        : [];
    },
  );

  assert.deepEqual(localized[0], {
    ...category,
    localizedName: "Étiquettes",
    localizedDescription: "Description française",
  });
  assert.deepEqual(localized[0] && {
    id: localized[0].id,
    slug: localized[0].slug,
    marketCode: localized[0].marketCode,
  }, {
    id: 12,
    slug: "etichete",
    marketCode: "ro",
  });
  assert.deepEqual(calls, [
    { ids: [12], language: "fr" },
    { ids: [12], language: "ro" },
  ]);
});

test("falls back to the marketplace language when the selected translation is missing", async () => {
  const category = {
    id: 34,
    name: "Catégorie de base",
    description: "Description de base",
    slug: "category",
    marketCode: "fr",
  };

  const localized = await localizeAdminCategories(
    [category],
    "en",
    "fr",
    async (_ids, language) => (
      language === "fr"
        ? [{ categoryId: 34, name: "Catégorie française" }]
        : []
    ),
  );

  assert.equal(localized[0].localizedName, "Catégorie française");
  assert.equal(localized[0].localizedDescription, category.description);
  assert.equal(normalizeAdminLanguage("en-US"), "en");
  assert.equal(normalizeAdminLanguage("de-DE"), null);
});

test("uses each category's marketplace language when loading all marketplaces", async () => {
  const categories = [
    { id: 1, name: "Română", slug: "ro", marketCode: "ro" },
    { id: 2, name: "English", slug: "en", marketCode: "com" },
  ];
  const requestedLanguages: string[] = [];

  const localized = await localizeAdminCategories(
    categories,
    undefined,
    "all",
    async (ids, language) => {
      requestedLanguages.push(language);
      return ids.map(categoryId => ({
        categoryId,
        name: `${language}-${categoryId}`,
      }));
    },
  );

  assert.deepEqual(localized.map(category => category.localizedName), ["ro-1", "en-2"]);
  assert.deepEqual(requestedLanguages.sort(), ["en", "ro"]);
  assert.deepEqual(localized.map(category => ({ id: category.id, slug: category.slug })), [
    { id: 1, slug: "ro" },
    { id: 2, slug: "en" },
  ]);
});

test("all category label consumers use the localized response field", () => {
  const source = readFileSync("admin-src/AdminApp.jsx", "utf8");

  assert.match(source, /const getCategoryName = \(category\) => category\?\.localizedName/);
  assert.match(source, /value=\{cat\.id\}>\{getCategoryName\(cat\)\}<\/option>/);
  assert.match(source, /value=\{productFormData\.categoryId\}[\s\S]{0,500}\{getCategoryName\(category\)\}/);
  assert.match(source, /<td style=\{\{padding: '12px', fontWeight: '500'\}\}>[\s\S]{0,160}\{getCategoryName\(category\)\}/);
  assert.match(source, /<option value="">\+ Add Category to Main Top<\/option>[\s\S]{0,400}\{getCategoryName\(category\)\}/);
  assert.match(source, /<option value="">\+ Add Category to Shop Section<\/option>[\s\S]{0,400}\{getCategoryName\(category\)\}/);
  assert.match(source, /\}, \[selectedMarketTab, i18n\.language\]\);/);
  assert.match(source, /params\.set\('market', market\);/);
  assert.match(source, /params\.set\('language', i18n\.language\);/);
});