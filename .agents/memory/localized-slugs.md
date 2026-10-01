---
name: Localized product routing
description: Canonicalizing a product URL can trigger Wouter and React Query to load the product again.
---

Product translations may supply a market-specific slug. When product details replaces the current URL with a canonical or localized slug, Wouter observes that history change and the slug-based product query key changes too. Put the already-resolved product into React Query under the destination slug key before replacing the URL. The route can then update without another product API request or a second loading state.

**Why:** Production logs showed one request for the link's slug followed by another request for the same product under its localized slug.

**How to apply:** For any product URL normalization that changes a slug-based query key, seed the exact destination query key before calling `history.replaceState`. Keep the cache value aligned with the product response shape.