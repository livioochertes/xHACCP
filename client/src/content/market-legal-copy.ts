export const FRENCH_PRIVACY_COMPLAINT_URL = "https://www.cnil.fr/fr/plaintes";

const FRENCH_PRIVACY_COMPLAINT =
  `Vous pouvez introduire une réclamation auprès de la Commission nationale de l’informatique et des libertés (CNIL) : ${FRENCH_PRIVACY_COMPLAINT_URL}.`;

const FRENCH_TERMS_JURISDICTION = [
  "Les présentes conditions sont régies par le droit français.",
  "Tout litige sera soumis au Tribunal des activités économiques de Paris.",
];

export function getPrivacyComplaintCopy(market: string, existingCopy: string): string {
  return market === "fr" ? FRENCH_PRIVACY_COMPLAINT : existingCopy;
}

export function getTermsJurisdictionCopy(
  market: string,
  existingCopy: string[],
): string[] {
  return market === "fr" ? [...FRENCH_TERMS_JURISDICTION] : existingCopy;
}
