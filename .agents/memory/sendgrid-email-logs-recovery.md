---
name: SendGrid Email Logs recovery
description: SendGrid history retention, query limits, event attribution, and live-versus-imported reporting.
---

SendGrid Email Logs can provide historical event data for up to 30 days. Its query endpoint returns at most 1,000 messages without pagination, so large time ranges must be split; event details are fetched per message ID. Match history to the campaign and recipient using namespaced custom arguments when present, then verify the recipient email against the saved campaign row. Use the stable SendGrid event ID as the idempotency key.

**Why:** A missing webhook can leave useful campaign results in SendGrid temporarily, but provider retention and query caps make recovery time-sensitive and easy to truncate silently. The user wants recovery to reconcile the existing campaign and batch totals, not show a second set of statistics.

**How to apply:** Start recovery soon after a sent campaign, split capped searches, retry provider throttling, and upsert events by stable provider ID. Reconcile recipient delivery states and batch counts from those events, including a startup sweep of completed imports so older stored events can repair stale counts without another provider fetch. Aggregate historical plus webhook provider events once in the dashboard while retaining source internally for audit.
