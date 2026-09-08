---
name: WMS credential monitoring
description: The WMS credential monitor runs as a one-shot scheduled check and persists alert cooldown state outside the web process.
---

The WMS credential check must remain separate from the autoscaled web server and use durable database-backed alert state when scheduled across multiple runs. It checks health plus sandbox and production order reads independently, and alert content may contain only safe check names, statuses, and endpoint paths—not credentials.

**Why:** Autoscaled instances do not provide reliable single-process scheduling or shared in-memory rate limits, while warehouse key failures need an operator signal without exposing secrets.

**How to apply:** Keep `WMS_BASE_URL`, both environment-specific WMS keys, database access, and SendGrid alert settings in the scheduled job environment. Pause the schedule or set the monitor pause variable during planned credential rotation.