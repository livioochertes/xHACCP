---
name: Viva production egress blocking
description: How to distinguish valid Viva credentials from provider-side blocking of Production deployment traffic.
---

If the Viva production token endpoint returns an HTML `403 Access Denied` only from the published deployment while the same market credentials return `200` from development, treat it as Viva/Akamai blocking the deployment's outbound traffic rather than as invalid OAuth credentials.

**Why:** Invalid or missing OAuth credentials normally reach the token service and return a structured JSON authentication error. An HTML denial generated before the token service, combined with a successful opaque credential test from development, isolates the failure to the provider's edge filtering or the deployment egress path.

**How to apply:** Keep token validation before local order creation, retain the provider reference ID and timestamp in logs, and ask Viva to investigate or allow the Production egress. Do not fall back to another marketplace account, currency, or sandbox endpoint.

An unauthenticated development probe returning JSON `400` or `401` establishes endpoint reachability only; it does not validate configured credentials. An HTML `403` alone does not prove an IP block. When several payment providers fail, compare their actual production HTTP statuses, response types, and safe OAuth error codes before assigning a shared cause.

**Why:** Generic authentication exceptions can hide either credential rejection or an edge denial; different underlying failures can appear identical in checkout.

**How to apply:** Preserve safe provider diagnostics without raw response bodies or secrets. Require equivalent authenticated evidence before concluding that development and production differ only by egress.