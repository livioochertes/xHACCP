---
name: Autoscale startup readiness
description: Autoscale publishing probes the HTTP port before slow database warm-up should block startup.
---

Autoscale services must bind their configured port and expose the root HTTP response before non-critical database seeding, cache warm-up, or backfill work runs.

**Why:** A successful image build can still fail during promotion when startup work delays the port listener beyond the readiness window.

**How to apply:** Keep route registration and static serving before `listen`, bind on `0.0.0.0` using `PORT`, and run slow warm-up after the listener is active with non-fatal error handling.