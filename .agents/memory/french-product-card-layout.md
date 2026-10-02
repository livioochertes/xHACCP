---
name: French product-card layout
description: Durable scope for French product-card price, discount, and image geometry.
---

For French product cards, keep the image frame dimensions unchanged but show the entire uploaded product photo without cropping. Align prices and discount badges across regular-price and sale cards.

**Why:** This is an explicit project requirement. The product detail page shows the full image, while `object-cover` in cards cropped it; sale badges also previously shifted price rows.

**How to apply:** Use fit-within-frame image rendering without changing the card image frame size or zooming the image on hover. When changing tax-label or sale-price layout, reserve a stable discount row. Check the homepage carousel and product grid.