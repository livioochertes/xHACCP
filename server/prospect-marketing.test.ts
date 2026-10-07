import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProspectCsv } from "./prospect-csv";
import {
  buildProspectMarketingEmail,
  createProspectMarketingToken,
  verifyProspectMarketingToken,
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

test("prospect invitation adds signup and unsubscribe links and escapes imported business fields", () => {
  const message = buildProspectMarketingEmail({
    htmlContent: "<h1>{{restaurant_name}}</h1><p>{{city}}</p>",
    textContent: "Bonjour {{restaurant_name}} à {{city}}",
    recipient: {
      prospectId: 42,
      restaurantName: "<Cuisine & Co>",
      city: "Paris",
    },
    audience: "invitation",
  });
  assert.match(message.html, /&lt;Cuisine &amp; Co&gt;/);
  assert.match(message.html, /newsletter\/subscribe\?token=/);
  assert.match(message.html, /prospect-unsubscribe\?token=/);
  assert.match(message.text, /newsletter\/subscribe\?token=/);
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
