import assert from "node:assert/strict";
import test from "node:test";
import { pickImageForCategory } from "./ai-blog-generator";

test("does not repeat recent cover images when a category pool is exhausted", () => {
  const usedImages: string[] = [];

  for (let index = 0; index < 8; index += 1) {
    const image = pickImageForCategory("Étiquetage", usedImages);
    assert.equal(usedImages.includes(image), false);
    usedImages.push(image);
  }

  assert.equal(new Set(usedImages).size, usedImages.length);
});