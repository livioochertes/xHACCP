---
name: App database environment identity
description: Verify the active application database before sensitive account or data writes.
---

Do not treat a database name, a connection-variable presence check, or a development-only SQL query as sufficient proof that the running application uses that same development database. Before sensitive writes, compare non-sensitive read-only fingerprints through the app's normal database client and the development database tool, and require a development runtime context. Stop if the targets cannot be positively matched. Never print or inspect connection strings.

**Why:** Replit's database tool targets its managed database, while an app may use a separate connection; generic database names and secret-presence listings do not establish environment identity.

**How to apply:** Compare stable counts or IDs first, confirm the app is running in development, gate one-off writes to that environment, then verify the postconditions through the development database tool.