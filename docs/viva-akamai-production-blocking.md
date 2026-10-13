# Viva Production edge-denial runbook

## Current request behavior

Every server-side request to Viva sends the explicit `User-Agent: xHACCP/1.0` header through the shared Viva HTTP helper. Keep this header on OAuth token requests, payment-order requests, status checks, callbacks/webhook verification, and recurring payments.

This was added after Production requests had received an HTML `403 Access Denied` response with an Akamai reference. Following the header change, the Romanian checkout succeeded, while the French OAuth endpoint returned structured JSON `invalid_client`; the French checkout started working after its FR OAuth Client ID and Client Secret were corrected. Therefore, the incident involved both edge behavior and a separate FR credential-pair error. Do not attribute every Viva failure to Akamai.

A later Production log sample on 2026-10-13 recorded renewed HTTP 403 HTML edge denials at the Viva OAuth token endpoint for both FR and RO, while the application still sent the explicit User-Agent. The provider references were `18.96623017.1791927091.5868f7e` (FR, 21:31:31Z), `18.a8aa3717.1791927157.36fe67b` (FR, 21:32:37Z), and `18.8e623017.1791927237.77e4564` (RO, 21:33:57Z). SendGrid accepted incident notifications for the first FR and RO events. The header is required but does not guarantee that Viva's edge will always accept Production traffic; these logs alone do not establish why the edge denied the requests.

## Alert and diagnosis

The Production payment-health system sends incident alerts to `info@namarteccl.com`. A Viva edge refusal is identified when the provider returns HTTP `403`, HTML, and an `Access Denied` body. The alert uses the stable code `VIVA_AUTH_EDGE_ACCESS_DENIED` for token requests or `VIVA_CHECKOUT_EDGE_ACCESS_DENIED` for order requests, and includes the response type and a sanitized Viva reference when present.

For an edge-denial alert:

1. Record the UTC timestamp, marketplace, HTTP status, response type, and Viva `Reference`.
2. Confirm the outgoing request still uses `User-Agent: xHACCP/1.0`.
3. Send Viva support the timestamp and reference and ask them to review Production edge filtering. Do not send credentials, access tokens, customer data, or raw provider response bodies.
4. Treat structured OAuth JSON such as `invalid_client` separately: verify the matching market-specific OAuth Client ID and Client Secret. A JSON credential rejection is not proof of an Akamai block.

Alerts are based on real payment failures, deduplicated per provider/market incident with the existing cooldown. They are not synthetic daily tests and do not guarantee that every transient or provider-side condition is detected before a customer encounters it.
