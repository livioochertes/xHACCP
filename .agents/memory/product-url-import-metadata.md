---
name: Product URL import metadata
description: Product-page imports must prioritize structured product data because generic social metadata can contain the site title.
---

For product URL imports, use `Product` JSON-LD first, then product-specific headings, and treat Open Graph title data only as a fallback.

**Why:** xHACCP product pages can expose the generic site identity in `og:title` while the actual product name is present in JSON-LD and the page H1. Trusting Open Graph first silently creates products under the wrong name.

**How to apply:** Normalize JSON-LD variants such as graphs, image objects/arrays, and aggregate offers; accept only non-empty product names before falling back to product headings and metadata.