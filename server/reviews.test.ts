import assert from "node:assert/strict";
import test from "node:test";
import type { NextFunction, Request, Response } from "express";
import { getProductReviewsQueryKey } from "../client/src/lib/queryClient";
import { authenticateToken } from "./authentication";
import { filterPublicReviews } from "./review-validation";

test("product review queries use the nested review endpoint", () => {
  assert.equal(getProductReviewsQueryKey(42), "/api/products/42/reviews");
  assert.notEqual(getProductReviewsQueryKey(42), "/api/products");
});

test("public review responses exclude unauthenticated or incomplete reviews", () => {
  const reviews = [
    { id: 1, userId: 7, rating: 5, comment: "Works well" },
    { id: 2, userId: null, rating: 5, comment: "Missing author" },
    { id: 3, userId: 7, rating: 0, comment: "Invalid rating" },
    { id: 4, userId: 7, rating: 6, comment: "Invalid rating" },
    { id: 5, userId: 7, rating: 4, comment: "   " },
    { id: 6, userId: 7, rating: 4, comment: null },
  ];

  assert.deepEqual(filterPublicReviews(reviews), [reviews[0]]);
});

test("anonymous review submissions remain unauthorized", async () => {
  let statusCode: number | undefined;
  let responseBody: unknown;
  let continued = false;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  const next: NextFunction = () => {
    continued = true;
  };

  await authenticateToken(
    { headers: {} } as Request,
    response,
    next,
  );

  assert.equal(statusCode, 401);
  assert.deepEqual(responseBody, { message: "Access token required" });
  assert.equal(continued, false);
});