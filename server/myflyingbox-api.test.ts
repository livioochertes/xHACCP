import assert from "node:assert/strict";
import { test } from "node:test";
import { MyFlyingBoxAPI } from "./myflyingbox-api.js";

test("selectOffer prefers home delivery when pickup offers are cheaper", () => {
  const api = new MyFlyingBoxAPI({
    baseUrl: "https://sandbox.example.test/v2",
    apiIdentifier: "test",
    password: "test",
  });

  const offer = api.selectOffer([
    {
      id: "relay",
      product: { code: "colis_prive_store_relais", name: "Relais à Relais" },
      total_price: { amount: 3.86, currency: "EUR" },
    },
    {
      id: "home",
      product: { code: "colis_prive_store_home", name: "Domicile" },
      total_price: { amount: 5.83, currency: "EUR" },
    },
  ]);

  assert.equal(offer.id, "home");
});

test("selectOffer honors an explicitly configured pickup product", () => {
  const api = new MyFlyingBoxAPI({
    baseUrl: "https://sandbox.example.test/v2",
    apiIdentifier: "test",
    password: "test",
    productCode: "colis_prive_store_relais",
  });

  const offer = api.selectOffer([
    {
      id: "relay",
      product: { code: "colis_prive_store_relais", name: "Relais à Relais" },
      total_price: { amount: 3.86, currency: "EUR" },
    },
    {
      id: "home",
      product: { code: "colis_prive_store_home", name: "Domicile" },
      total_price: { amount: 5.83, currency: "EUR" },
    },
  ]);

  assert.equal(offer.id, "relay");
});