/**
 * Converts any product name to a URL-safe slug.
 * Handles French, Romanian, Spanish, German diacritics via Unicode normalization.
 * Must produce the same result as the backend slug generator.
 */
export function toSlug(name: string): string {
  return name
    .normalize('NFD')                     // decompose accented chars (é → e + ́)
    .replace(/[\u0300-\u036f]/g, '')      // remove combining diacritical marks
    .toLowerCase()
    .replace(/[''ʼ`'\u2018\u2019]/g, '') // remove apostrophes of all kinds
    .replace(/[^a-z0-9]+/g, '-')         // non-alphanumeric → dash
    .replace(/^-+|-+$/g, '');            // trim leading/trailing dashes
}
