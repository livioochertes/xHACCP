import assert from "node:assert/strict";
import test from "node:test";
import { searchFrenchDepartments } from "./location-data";

test("French departments can be searched by official code and name", () => {
  assert.deepEqual(
    searchFrenchDepartments("83").map(({ code, name }) => ({ code, name })),
    [{ code: "83", name: "Var" }],
  );
  assert.ok(searchFrenchDepartments("VA").some(({ code, name }) => code === "83" && name === "Var"));
  assert.deepEqual(
    searchFrenchDepartments("var").map(({ code }) => code),
    ["83"],
  );
});

test("French department name search ignores case and accents", () => {
  assert.ok(searchFrenchDepartments("herault").some(({ code }) => code === "34"));
  assert.ok(searchFrenchDepartments("2a").some(({ name }) => name === "Corse-du-Sud"));
  assert.deepEqual(searchFrenchDepartments("not-a-department"), []);
});
