---
name: Admin numeric form fields
description: Validation rule for optional numeric values submitted by Admin forms.
---

Optional numeric controls in the Admin UI commonly submit an empty string when left blank. Server handlers must normalize those values before inserting or updating integer and decimal database columns.

**Why:** PostgreSQL rejects an empty string for numeric columns, and browser-side input types do not guarantee that the JSON payload contains a number or null.

**How to apply:** Normalize every optional integer/decimal field at the API boundary, use `undefined`/`null` to trigger the intended database default, and never spread raw form payload fields over normalized values.