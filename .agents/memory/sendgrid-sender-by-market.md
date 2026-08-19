---
name: SendGrid sender by market
description: Market-specific sender identity and the domain-routing rule used for outbound email.
---

Email associated with the France market must send from the verified SendGrid identity `info@xhaccp.fr`, configured as the non-secret `SENDGRID_FROM_EMAIL_FR` environment variable. Romanian and international email continue to use the existing `SENDGRID_FROM_EMAIL` identity.

**Why:** Recipients on `xhaccp.fr` need a French-domain sender, while changing the default would alter established RO and COM delivery.

**How to apply:** Any new market-aware mail flow must resolve its sender from the trusted canonical request domain or the persisted order/document market. Do not let public query parameters or headers override a recognized `xhaccp.fr` host when choosing the sender.