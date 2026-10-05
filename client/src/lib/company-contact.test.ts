import assert from "node:assert/strict";
import test from "node:test";
import { formatCompanyPhone, getTelHref } from "./company-contact";

test("French company phone is formatted from the stored number", () => {
  assert.equal(formatCompanyPhone("0631361577", "fr"), "+33 6 31 36 15 77");
  assert.equal(formatCompanyPhone("+33 6 31 36 15 77", "fr"), "+33 6 31 36 15 77");
  assert.equal(formatCompanyPhone("0033 6 31 36 15 77", "fr"), "+33 6 31 36 15 77");
  assert.equal(formatCompanyPhone("+40 740 000 520", "ro"), "+40 740 000 520");
  assert.equal(getTelHref("+33 6 31 36 15 77"), "tel:+33631361577");
});
