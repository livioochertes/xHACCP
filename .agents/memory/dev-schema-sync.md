---
name: Development schema sync
description: Development database schema changes should be applied through the database development SQL flow when Drizzle push cannot receive interactive prompts.
---

Use the development database tooling for additive schema changes when `drizzle-kit push` stops at a non-interactive confirmation prompt; do not force truncation or apply DDL to production.

**Why:** The workspace shell is non-interactive, so Drizzle's confirmation prompt can appear to complete without applying the schema. Forcing the prompt risks approving destructive changes.

**How to apply:** Keep the Drizzle schema and migration source in the repository, then apply the reviewed migration to `development` through the database tool and verify the workflow logs.