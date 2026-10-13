---
name: Viva production egress blocking
description: How to distinguish valid Viva credentials from provider-side blocking of Production deployment traffic.
---

Every server-side Viva request must send the explicit `User-Agent: xHACCP/1.0` header through the shared helper. It is required but does not guarantee that Viva's edge will always accept Production traffic. If Viva returns an HTML `403 Access Denied`, the payment-health pipeline records an edge-denial code and sends a Production alert with status, response type, and sanitized provider reference.

**Why:** Production previously received Akamai HTML denials. After adding the explicit header, RO checkout succeeded; FR then returned structured `invalid_client` until its separate OAuth credential pair was corrected. Later, Production again recorded FR and RO HTML 403 edge denials despite the header. Header, credentials, and provider-side edge filtering are distinct failure causes.

**How to apply:** Keep the header on all Viva API calls, preserve the provider reference and UTC timestamp, and use the payment-health alert to escalate genuine 403 HTML edge denials to Viva. Do not treat JSON `invalid_client` as Akamai blocking and do not fall back to another marketplace account, currency, or sandbox endpoint.

An unauthenticated development probe returning JSON `400` or `401` establishes endpoint reachability only; it does not validate configured credentials. An HTML `403` alone does not prove an IP block. When several payment providers fail, compare their actual production HTTP statuses, response types, and safe OAuth error codes before assigning a shared cause.

**Why:** Generic authentication exceptions can hide either credential rejection or an edge denial; different underlying failures can appear identical in checkout.

**How to apply:** Preserve safe provider diagnostics without raw response bodies or secrets. Require equivalent authenticated evidence before concluding that development and production differ only by egress.

See [the Viva Production edge-denial runbook](../../docs/viva-akamai-production-blocking.md) for the operator steps and alert codes.