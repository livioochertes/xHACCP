---
name: WMS partner guide DOCX
description: Durable constraints when regenerating the Word version of the WMS partner guide
---

The partner guide DOCX can be updated in an environment without Pandoc by editing the existing file with `python-docx`. The document may not contain the standard `Heading 2` style, so append plain paragraphs rather than relying on named heading styles.

**Why:** The guide is a generated partner deliverable, but the available document tooling can vary between sessions and the existing template's style collection is not guaranteed.

**How to apply:** Keep the Markdown guide authoritative, then regenerate with Pandoc when available; otherwise use `python-docx`, verify the new text by reading the saved DOCX, and present the resulting file.