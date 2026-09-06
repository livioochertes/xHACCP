import type { Review } from "@shared/schema";

type ReviewCandidate = Pick<Review, "userId" | "rating" | "comment">;

export function isPublicReview(review: ReviewCandidate): boolean {
  const rating = Number(review.rating);
  const comment = typeof review.comment === "string" ? review.comment.trim() : "";

  return (
    review.userId != null &&
    Number.isInteger(rating) &&
    rating >= 1 &&
    rating <= 5 &&
    comment.length > 0
  );
}

export function filterPublicReviews<T extends ReviewCandidate>(reviews: T[]): T[] {
  return reviews.filter(isPublicReview);
}