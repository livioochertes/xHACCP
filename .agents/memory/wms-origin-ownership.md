---
name: WMS origin ownership
description: The ownership and validation rule for warehouse shipping origins used by outbound carrier integrations.
---

The shipping origin for an outbound WMS/carrier request must be stored as market-scoped logistics configuration and must be complete before the request is sent.

**Why:** Commercial company settings and environment variables can represent a different legal entity or operational location; using them as an implicit warehouse origin can send parcels from the wrong place.

**How to apply:** Keep the origin editable in the WMS area, authorize reads and writes by market, validate every carrier-required field server-side, and fail before quoting or creating a shipment when the origin is missing or incomplete.

For Sameday `.ro`, resolve the pickup point and contact context from the configured Romanian WMS origin before creating an AWB; do not silently fall back to company settings as the sender identity.

**Why:** The WMS origin is now the shared operational source for carrier integrations, while company settings remain commercial and invoice-facing data.

**How to apply:** Require an explicit provider pickup-point ID in the Romanian WMS origin, validate it against the live carrier list, and block AWB creation when it is missing or unavailable; never fall back to another point.