---
name: Promotional banner QR assets
description: Quality requirements for marketing banners used as homepage image slides.
---

For promotional banners that include exact text or a QR code, use image generation only for background imagery. Render copy as deterministic SVG/vector text and generate the QR from the confirmed destination URL. Export at the homepage hero's aspect ratio and keep the rendered hero at its fixed base height; use contain rather than cropping or stretching the full banner. If the fixed frame leaves space around it, use a clean backdrop sampled from the banner's edge color rather than a blurred duplicate.

Store finished homepage banners without passing them through the product-image optimizer. Keep the original file format, dimensions, and bytes on admin upload so vector-rendered text and QR codes are not softened by downscaling and JPEG recompression.

**Why:** Generated raster text can be illegible and AI-drawn QR patterns are not dependable. Product-image compression and an oversized hero frame both undermine a cover that is otherwise sharp and correctly composed. A blurred underlay can make the side areas look messy; matching the edge color removes the black bars without cropping or stretching the artwork. A 1920-pixel export displayed around 960 CSS pixels halves its typography too, so microcopy needs to be sized for the rendered width.

**How to apply:** Confirm the QR target from the campaign owner or an existing verified code, compose the QR and readable copy over the design, inspect it at the actual homepage width, simplify or enlarge any unreadable microcopy, check export dimensions and scanability, and use a dedicated original-preserving upload path for homepage banners. For multiple artwork variants, pair each QR crop with its own source art; code patterns and crop positions can differ.