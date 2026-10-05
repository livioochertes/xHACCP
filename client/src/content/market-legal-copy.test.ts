import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPrivacyComplaintCopy,
  getTermsJurisdictionCopy,
} from "./market-legal-copy";

test("French storefront uses the approved CNIL complaint information", () => {
  const copy = getPrivacyComplaintCopy("fr", "Romanian authority copy");

  assert.match(copy, /Commission nationale de l’informatique et des libertés \(CNIL\)/);
  assert.match(copy, /https:\/\/www\.cnil\.fr\/fr\/plaintes/);
  assert.doesNotMatch(copy, /dataprotection\.ro|Romania/i);
});

test("French storefront uses approved governing law and court venue", () => {
  const copy = getTermsJurisdictionCopy("fr", [
    "Romanian law",
    "Bucharest courts",
    "Consumer rights clause",
  ]);

  assert.deepEqual(copy, [
    "Les présentes conditions sont régies par le droit français.",
    "Tout litige sera soumis au Tribunal des activités économiques de Paris.",
  ]);
});

test("non-French markets preserve their existing legal copy", () => {
  const privacyCopy = "National Supervisory Authority for Personal Data Processing (www.dataprotection.ro)";
  const termsCopy = ["Romanian law", "Competent courts in Bucharest", "Consumer rights clause"];

  assert.equal(getPrivacyComplaintCopy("ro", privacyCopy), privacyCopy);
  assert.deepEqual(getTermsJurisdictionCopy("ro", termsCopy), termsCopy);
  assert.equal(getPrivacyComplaintCopy("com", privacyCopy), privacyCopy);
  assert.deepEqual(getTermsJurisdictionCopy("com", termsCopy), termsCopy);
});
