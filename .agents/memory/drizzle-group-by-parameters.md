---
name: Drizzle grouped SQL expressions
description: PostgreSQL grouping behavior when Drizzle renders the same parameterized SQL fragment more than once.
---

When a selected aggregate bucket is built from a parameterized `sql` template, repeating that template in `GROUP BY` can produce a different set of PostgreSQL parameter placeholders. PostgreSQL may then treat the grouping expression as distinct from the selected expression.

**Why:** A report chart query failed at runtime even though its selected bucket and `GROUP BY` used the same apparent SQL expression; Drizzle assigned separate placeholders to repeated template interpolations.

**How to apply:** For a grouped computed value, use a stable selected ordinal such as `GROUP BY 1`/`ORDER BY 1`, or put the computed value in a derived table and group by its named column. Keep any raw SQL fragment fixed and non-user-controlled.