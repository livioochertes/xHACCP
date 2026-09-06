---
name: Review query URL convention
description: Product review queries must use the complete endpoint URL because the shared query function only reads queryKey[0].
---

The client query key for product reviews must contain the complete URL, such as `/api/products/{id}/reviews`, as its first element. Additional query-key segments are not converted into URL path segments by the shared query function.

**Why:** A key shaped like `["/api/products", productId, "reviews"]` requests `/api/products`, so the product catalog can be rendered as if it were a list of reviews.

**How to apply:** Use a full endpoint string as the first query-key element whenever a resource path contains an identifier or nested route.