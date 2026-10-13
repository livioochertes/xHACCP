---
name: SendGrid Email Logs recovery
description: SendGrid history retention, query limits, event attribution, and live-versus-imported reporting.
---

SendGrid Email Logs can provide historical event data for up to 30 days. Its query endpoint returns at most 1,000 messages without pagination, so large time ranges must be split; event details are fetched per message ID. Match history to the campaign and recipient using SendGrid custom arguments, then verify the recipient email against the saved campaign row. Use the stable SendGrid event ID to avoid duplicate metrics, and keep imported history distinguishable from live webhook data.

**Why:** A missing webhook can leave useful campaign results in SendGrid temporarily, but provider retention and query caps make recovery time-sensitive and easy to truncate silently.

**How to apply:** Start recovery soon after a sent campaign, split capped searches, retry provider throttling, and report imported results separately from current delivery-status counts.
