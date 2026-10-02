---
name: App database environment identity
description: Verify the active application database before sensitive account or data writes.
---

For this xHACCP workspace, the user confirms that Replit Database pane's Production target writes to the Neon database used by the live app. A read-only production schema check returned database name `neondb` and all 17 pricing/tax columns.

**Why:** The production mapping is a user-confirmed workspace fact, while the development database and the agent's direct Neon connection can still differ. Do not generalize this mapping to another project or environment.

**How to apply:** For this project's production migration, use the Production target the user identified and verify schema/data through read-only queries. For development or any other project, confirm the target independently; never print or inspect connection strings.