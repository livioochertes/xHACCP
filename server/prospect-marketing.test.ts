import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProspectCsv } from "./prospect-csv";
import {
  buildProspectMarketingEmail,
  createProspectMarketingToken,
  verifyProspectMarketingToken,
  verifyProspectMarketingTokenClaims,
} from "./prospect-marketing-security";

process.env.SESSION_SECRET ||= "prospect-marketing-test-secret-with-at-least-32-characters";

test("parses the attached Romanian CSV shape, quoted delimiters, and UTF-8 BOM", () => {
  const csv = `\uFEFFEmail,Nume restaurant,Oraș,Adresă,Telefon,Site web,Notă Alim'confiance,Reprezentant legal,SIRET,Sursă\r
contact@example.test,"Chez ""Diane"", Paris",Paris,"2, rue de Lyon",+33123456789,https://example.test,"Avis: première ligne
deuxième ligne",Camille Martin,12345678900000,Google Maps\r
CONTACT@example.test,Duplicate,Paris,,,,,,,,\r
adresse-invalide,No email,Paris,,,,,,,,`;

  const result = parseProspectCsv(csv);
  assert.equal(result.totalRows, 3);
  assert.equal(result.rows.length, 1);
  assert.equal(result.invalidRows, 1);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.rows[0].email, "contact@example.test");
  assert.equal(result.rows[0].restaurantName, 'Chez "Diane", Paris');
  assert.equal(result.rows[0].address, "2, rue de Lyon");
  assert.equal(result.rows[0].foodSafetyNote, "Avis: première ligne\ndeuxième ligne");
});

test("detects a semicolon-delimited French CSV and maps alternate headings", () => {
  const result = parseProspectCsv(
    "Courriel;Restaurant;Ville;Adresse;Téléphone;Site web;Source\nchef@example.test;Le Marché;Lyon;1 rue du Port;0102030405;https://marche.example;site web",
  );
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].restaurantName, "Le Marché");
  assert.equal(result.rows[0].city, "Lyon");
  assert.equal(result.rows[0].source, "site web");
});

test("rejects files without an email column and invalid CSV input", () => {
  assert.throws(() => parseProspectCsv("Restaurant,Ville\nLe Marché,Lyon"), /Email column/);
  assert.throws(() => parseProspectCsv(""), /empty/);
});

test("marketing tokens are signed for one purpose and cannot be changed", () => {
  const token = createProspectMarketingToken("subscribe", 42);
  assert.equal(verifyProspectMarketingToken("subscribe", token), 42);
  assert.equal(verifyProspectMarketingToken("unsubscribe", token), null);
  assert.equal(verifyProspectMarketingToken("subscribe", "42.invalid"), null);
  assert.equal(verifyProspectMarketingToken("subscribe", "0.invalid"), null);
});

test("campaign unsubscribe tokens identify their source campaign and reject tampering", () => {
  const token = createProspectMarketingToken("unsubscribe", 42, 101);
  assert.deepEqual(verifyProspectMarketingTokenClaims("unsubscribe", token), {
    prospectId: 42,
    campaignId: 101,
  });
  assert.equal(verifyProspectMarketingToken("unsubscribe", token), 42);
  assert.equal(verifyProspectMarketingTokenClaims("subscribe", token), null);
  assert.equal(verifyProspectMarketingTokenClaims("unsubscribe", "42.102." + token.split(".")[2]), null);
});

test("prospect invitation adds signup and unsubscribe links and escapes imported business fields", () => {
  const message = buildProspectMarketingEmail({
    htmlContent: "<h1>{{restaurant_name}}</h1><p>{{city}}</p><p>{{discount_display}}</p><p>{{offer_terms}}</p><a href=\"{{newsletter_signup_url}}\">Offre</a>",
    textContent: "Bonjour {{restaurant_name}} à {{city}} — {{discount_display}} {{offer_terms}} {{newsletter_signup_url}}",
    recipient: {
      prospectId: 42,
      campaignId: 101,
      restaurantName: "<Cuisine & Co>",
      city: "Paris",
    },
    audience: "invitation",
    offer: {
      name: "Offre France",
      discountType: "fixed",
      discountValue: "8.50",
      validMonths: 4,
    },
  });
  assert.match(message.html, /&lt;Cuisine &amp; Co&gt;/);
  assert.match(message.html, /xhaccp\.fr\/chef-event/);
  assert.match(message.html, /8,50\s*€/);
  assert.match(message.html, /4 mois/);
  assert.doesNotMatch(message.html, /BIENVENUE20|20 ?%|12 mois/);
  assert.match(message.html, /prospect-unsubscribe\?token=/);
  assert.match(message.html, /token=42\.101\./);
  assert.match(message.text, /xhaccp\.fr\/chef-event/);
  assert.equal(message.headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
});

test("newsletter messages include an unsubscribe footer without the invitation CTA", () => {
  const message = buildProspectMarketingEmail({
    htmlContent: "<p>Actualités xHACCP</p>",
    recipient: { prospectId: 7 },
    audience: "newsletter",
  });
  assert.match(message.html, /prospect-unsubscribe\?token=/);
  assert.doesNotMatch(message.html, /newsletter\/subscribe\?token=/);
});

test("invitation messages keep only the signup and shop links authored in the template", () => {
  const message = buildProspectMarketingEmail({
    htmlContent: '<p>Offre de bienvenue</p><a href="https://xhaccp.fr/products">Profiter de l’offre</a>',
    textContent: "Offre de bienvenue — https://xhaccp.fr/products",
    audience: "invitation",
    offer: {
      name: "Offre France",
      discountType: "percentage",
      discountValue: "20",
      validMonths: 12,
    },
    testMode: true,
  });

  assert.match(message.html, /https:\/\/xhaccp\.fr\/products/);
  assert.doesNotMatch(message.html, /M'inscrire et recevoir mon code personnel/);
  assert.doesNotMatch(message.text, /Inscrivez-vous pour recevoir votre code personnel/);
});

test("marketing test emails use safe generic links and never create subscription tokens", () => {
  const message = buildProspectMarketingEmail({
    htmlContent: '<a href="{{newsletter_signup_url}}">Join</a><a href="{{unsubscribe_url}}">Unsubscribe</a><p>{{discount_display}}</p>',
    audience: "invitation",
    offer: {
      name: "Offre",
      discountType: "percentage",
      discountValue: "15",
      validMonths: 3,
    },
    testMode: true,
  });
  assert.match(message.html, /xhaccp\.fr\/chef-event/);
  assert.match(message.html, /xhaccp\.fr\/privacy/);
  assert.match(message.html, /15\s*%/);
  assert.match(message.html, /email de test uniquement/i);
  assert.doesNotMatch(message.html, /subscribe\?token=|unsubscribe\?token=/);
  assert.deepEqual(message.headers, {});
});
