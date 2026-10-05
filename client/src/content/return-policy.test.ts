import assert from "node:assert/strict";
import test from "node:test";
import {
  getReturnPolicyCopy,
  getReturnPolicySellerDetails,
} from "./return-policy";

test("return-policy legal text and sources follow the storefront market, not UI language", () => {
  const frenchMarketEnglish = getReturnPolicyCopy("en", "fr");
  const romanianMarketFrench = getReturnPolicyCopy("fr", "ro");
  const internationalMarketEnglish = getReturnPolicyCopy("en", "com");

  assert.match(frenchMarketEnglish.subtitle, /French storefront/);
  assert.match(frenchMarketEnglish.sections[2].paragraphs?.join(" "), /19 June 2026/);
  assert.ok(frenchMarketEnglish.sources.some((source) => source.includes("French Consumer Code")));

  assert.match(romanianMarketFrench.subtitle, /domaine roumain/);
  assert.ok(romanianMarketFrench.sources.some((source) => source.includes("OUG nº 34/2014")));
  assert.ok(romanianMarketFrench.sourceUrls?.every((url) => !url.includes("legifrance.gouv.fr")));

  assert.match(internationalMarketEnglish.subtitle, /country of residence/);
  assert.match(internationalMarketEnglish.sections[1].paragraphs?.join(" ") ?? "", /where EU consumer law governs the order/);
  assert.ok(internationalMarketEnglish.sources.every((source) => !source.includes("French Consumer Code")));
  assert.equal(internationalMarketEnglish.sourceUrls?.length, internationalMarketEnglish.sources.length);
});

test("the French seller and return destination are isolated to the French storefront", () => {
  const frenchContact = {
    name: "French company from settings",
    phone: "0123456789",
    address: "1 Rue Example",
    zipCode: "75001",
    city: "Paris",
    country: "France",
    registrationNumber: "FR-REG",
    vatNumber: "FR-VAT",
  };

  const french = getReturnPolicySellerDetails("fr", frenchContact);
  assert.equal(french.name, "French company from settings");
  assert.equal(french.phone, "0123456789");
  assert.deepEqual(french.postalAddress, ["1 Rue Example", "75001 Paris", "France"]);
  assert.equal(french.registrationNumber, "FR-REG");
  assert.equal(french.vatNumber, "FR-VAT");
  assert.deepEqual(french.returnAddress, [
    "Saint Laurent Logistic",
    "ZI SECTEUR D",
    "30 ALLEE DES GEOMETRES",
    "06700 SAINT-LAURENT-DU-VAR",
    "France",
  ]);

  const romanian = getReturnPolicySellerDetails("ro", {
    name: "Other market seller",
    phone: "+40 721 000 000",
    address: "Other market address",
    zipCode: "12345",
    city: "Other City",
    country: "Romania",
    registrationNumber: "OTHER-REG",
    vatNumber: "OTHER-VAT",
  });
  assert.equal(romanian.name, "Other market seller");
  assert.equal(romanian.phone, "+40 721 000 000");
  assert.equal(romanian.registrationNumber, "OTHER-REG");
  assert.equal(romanian.vatNumber, "OTHER-VAT");
  assert.deepEqual(romanian.returnAddress, []);
});
