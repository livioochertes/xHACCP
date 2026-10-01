---
name: UUID security upgrade compatibility
description: Why security remediation of ExcelJS's UUID dependency must preserve CommonJS support.
---

Choose a patched UUID release with CommonJS exports when overriding ExcelJS's dependency; do not automatically select the newest ESM-only major.

**Why:** ExcelJS's latest available release still requests an affected older UUID major and calls it with `require`. UUID 11.1.1 fixes the buffer-bounds advisory while preserving that interface, avoiding a broader spreadsheet-library migration.

**How to apply:** Check whether the parent has gained a compatible fix first. If an override is still needed, exercise XLSX extended conditional formatting as well as ordinary workbook exports: plain exports can pass without reaching the UUID caller.