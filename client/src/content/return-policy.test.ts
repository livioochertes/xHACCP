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

test("the five-business-day returned-parcel refund term applies only to the French storefront", () => {
  const frenchMarketCopy = [
    getReturnPolicyCopy("fr", "fr"),
    getReturnPolicyCopy("ro", "fr"),
    getReturnPolicyCopy("en", "fr"),
  ];
  const expectedPhrases = [
    /5 jours ouvrés après réception/,
    /5 zile lucrătoare de la recepția/,
    /5 business days of receipt/,
  ];

  frenchMarketCopy.forEach((copy, index) => {
    const refundSection = copy.sections.find(({ title }) =>
      /^(Remboursement|Rambursarea|Refunds)$/i.test(title),
    );
    assert.ok(refundSection?.bullets);
    assert.match(refundSection.bullets.join(" "), expectedPhrases[index]);
    assert.match(refundSection.bullets.join(" "), /shorter|plus court|mai scurt/);
  });

  for (const market of ["ro", "com"]) {
    for (const language of ["fr", "ro", "en"]) {
      const copy = getReturnPolicyCopy(language, market);
      const refundSection = copy.sections.find(({ title }) =>
        /^(Remboursement|Rambursarea|Refunds)$/i.test(title),
      );
      assert.ok(refundSection?.bullets);
      assert.doesNotMatch(refundSection.bullets.join(" "), /5 (?:jours ouvrés|zile lucrătoare|business days)/);
    }
  }
});

test("the unused and unopened product condition applies only to the French storefront", () => {
  const frenchMarketCopy = [
    getReturnPolicyCopy("fr", "fr"),
    getReturnPolicyCopy("ro", "fr"),
    getReturnPolicyCopy("en", "fr"),
  ];
  const expectedPhrases = [
    /retournés inutilisés et non descellés/,
    /returnate nefolosite și nedesigilate/,
    /returned unused and unopened/,
  ];
  const inspectionRights = [
    /manipuler les biens dans la mesure nécessaire/,
    /manipula bunurile atât cât este necesar/,
    /handle goods as needed/,
  ];

  frenchMarketCopy.forEach((copy, index) => {
    const returnSection = copy.sections.find(({ title }) =>
      /^(Retour des biens|Returnarea bunurilor|Returning goods)$/i.test(title),
    );
    assert.ok(returnSection?.bullets);
    assert.match(returnSection.bullets.join(" "), expectedPhrases[index]);
    assert.match(returnSection.bullets.join(" "), inspectionRights[index]);
  });

  for (const market of ["ro", "com"]) {
    for (const language of ["fr", "ro", "en"]) {
      const copy = getReturnPolicyCopy(language, market);
      const returnSection = copy.sections.find(({ title }) =>
        /^(Retour des biens|Returnarea bunurilor|Returning goods)$/i.test(title),
      );
      assert.ok(returnSection?.bullets);
      assert.doesNotMatch(
        returnSection.bullets.join(" "),
        /retournés inutilisés et non descellés|returnate nefolosite și nedesigilate|returned unused and unopened/,
      );
    }
  }
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
