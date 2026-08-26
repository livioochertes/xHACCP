---
name: Product description formatting
description: Product descriptions retain editable plain text while the storefront uses a deterministic formatted HTML representation.
---

Keep the original product and translation descriptions as editable source text. Generate the product's storefront HTML when it is created or when its name/description changes; translations use the same shared formatter at display time.

**Why:** Formatting only on a product's first storefront visit was inconsistent, and storing HTML in translation textareas would make future editing difficult.

**How to apply:** Use the shared formatter for paragraphs, headings, the first product-name occurrence, bullets, numbered lists, and callouts. Preserve an existing formatted description when unrelated product fields are edited.