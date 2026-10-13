---
name: Marketing automation
description: Market-aware abandoned-cart thresholds and consent-gated marketing campaigns
---

Reminder timing and campaign audiences must be scoped to the marketplace (`ro`, `fr`, or `com`) rather than treated as global user settings. Marketing recipients require both email communication and promotions consent.

**Why:** The same account can use multiple storefronts with different currencies, senders, legal context, and customer intent; mixing audiences or sending without both preferences risks incorrect communication and compliance issues.

**How to apply:** Keep threshold configuration per market, preserve reminder progress per cart snapshot and threshold, and calculate campaign previews/send lists from the selected segment at send time.

AI recommendation campaign creation and editing must acquire the same market-scoped PostgreSQL transaction advisory lock before checking date overlap and writing the campaign.

**Why:** A separate overlap read and write lets concurrent requests both pass; locking by market allows identical schedules in separate markets.

**How to apply:** Any future code path that can create or reschedule these campaigns must use the same lock namespace and perform its overlap query and write in the locked transaction.

French imported prospect lists may be used for an invitation only when an administrator confirms the documented B2B contact basis. Importing a contact is not newsletter consent: the recipient must explicitly opt in before receiving newsletter campaigns. Signup offers a 20% voucher. Unsubscribes are removed from all active prospect list memberships, while the prospect record and unsubscribe marker remain.

**Why:** The user confirmed their list has a documented B2B basis, while requiring the initial invitation to ask permission and offer a 20% voucher; keeping the unsubscribe marker prevents an address from being re-added and mailed after a later import.

**How to apply:** Keep this flow France-only, never send on import, record explicit opt-in separately from the invitation basis, and keep unsubscribe suppression even when list memberships are removed.

When converting a supplied campaign DOCX to email HTML, preserve its original message, promotional artwork, and QR image instead of redesigning or dropping them. Change CTA and QR destinations only to match the requested signup or product page.

**Why:** Text extraction can omit embedded media, and the user corrected an earlier HTML conversion that changed the message and left out the source image.

**How to apply:** Inspect DOCX media and hyperlinks as well as extracted text, host images at public HTTPS URLs, and verify that CTA and QR links resolve to the intended storefront page.

As of 2026-10-08, the user reports their SendGrid plan allows 5,000 unique addresses and 15,000 sends per month; confirm current limits before scheduling large campaigns.

**Why:** The contact cap and monthly send allowance are separate; a full send to 3,000 contacts consumes 20% of the monthly send allocation.

**How to apply:** Budget all planned campaign sends against the monthly allowance, and re-check the account plan because provider limits can change.

The user wants prospect campaigns sent in 300–500-recipient batches, with SendGrid API acceptance shown separately from recipient-server delivery. Hard bounces, spam reports, unsubscribe requests, and confirmed invalid addresses must be suppressed across future prospect campaigns; temporary deferrals remain eligible.

**Why:** Batch-level submission confirmation and recipient-level delivery confirmation answer different questions, while transient deferrals should not permanently remove a valid contact.

**How to apply:** Keep batches at or below 500, use signed SendGrid events for delivery state, and never automatically resend an ambiguous network outcome because it may duplicate a message.

Campaign analysis should distinguish event totals from unique recipients. Open metrics should call out machine/privacy-generated opens as estimates, and app-managed unsubscribe events should retain signed campaign attribution.

**Why:** SendGrid can report repeated and automated opens, while an unsubscribe through the app's own link is not necessarily emitted as a SendGrid unsubscribe event.

**How to apply:** Show unique counts alongside event counts, label open rates as indicative, and keep campaign attribution in the signed unsubscribe token rather than an editable query parameter.

SendGrid's Signed Event Webhook Verification Key may be a bare Base64-encoded SPKI public key, not PEM text with BEGIN/END lines.

**Why:** SendGrid's official helpers decode the verification key as Base64 before parsing the ECDSA public key; PEM-only parsing rejects valid signed events.

**How to apply:** Accept PEM and Base64 SPKI formats, verify the timestamp concatenated with the exact raw request body, and never log the key value.

Campaign correlation values must be namespaced SendGrid custom arguments on each recipient personalization, not top-level mail arguments or SendGrid's reserved `marketing_campaign_id`.

**Why:** SendGrid acknowledged campaign sends, but its webhook events lacked a usable app campaign ID and were silently skipped.

**How to apply:** Send app-specific campaign and recipient IDs in personalization `custom_args`, then validate both IDs and recipient email before storing each event.

Invitation email CTA placement is controlled by the campaign HTML; do not append a generic signup button after the message.

**Why:** An automatically appended signup button appeared beneath the unsubscribe footer even though the campaign already had its intended CTA.

**How to apply:** Resolve explicit signup-link placeholders, but otherwise preserve the message structure supplied by the campaign template.