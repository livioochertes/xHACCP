# WMS production readiness

See [WMS Integration API](wms-api.md) for the partner-facing endpoint
contract. This document covers the xHACCP operator checklist for publishing
and monitoring it.

Use this checklist before connecting the first warehouse. The production API
key must be stored in Replit Secrets or the warehouse's secret manager. Never
paste the plaintext key into chat, a ticket, a commit, or this file.

## 1. Publish the schema safely

1. Confirm `shared/schema.ts` contains the WMS tables and order columns from
   `db/migrations/0006_wms_partner_api.sql`.
2. Publish from the current development database.
3. In the Publish schema review, confirm the WMS changes are additive:
   `fulfillment_partners`, `market_fulfillment`, `wms_api_keys`,
   `wms_shipments`, `wms_order_events`, `wms_inventory`,
   `wms_idempotency_keys`, `wms_audit_logs`, and the WMS order columns.
4. Do not choose overwrite production data. If Publish reports a rename or a
   drop, stop and resolve the schema difference before continuing.
5. Confirm the published app responds to
   `GET /api/wms/v1/health` with HTTP 200.
6. Validate the repository contract before publishing:
   `npm run validate:wms-openapi`.

The repository does not run DDL during build or startup. Development schema
changes are applied through the normal post-merge flow, and production schema
changes are applied by Publish.

The partner-facing machine-readable contract is
`docs/openapi/wms-v1.json`. Run `npm run test:wms` before release; this also
checks the WMS route list, scopes, response codes, schemas, and documented
error codes for drift.

## 2. Record one routing decision per marketplace

In Admin → WMS partners, review all three cards:

- `ro`: activate the intended partner, or select the intended partner and
  leave **Rutare activă** unchecked.
- `fr`: make the same deliberate choice.
- `com`: make the same deliberate choice.

The overview marks a market as `activă`, `inactivă`, or `neconfigurată`.
Production readiness is complete only when all three are either active or
explicitly inactive. An unconfigured market is not an intentional decision.

An active route is used for new fulfillment snapshots. Changing routing does
not rewrite orders that already have a `fulfillment_partner_id`; requeue those
orders only after confirming the desired partner.

## 3. Test sandbox and production keys independently

Create one Sandbox key and one Production key for the intended partner. Store
the plaintext production key outside chat, then expose both values to the
local smoke check only through environment variables:

```sh
WMS_BASE_URL=https://your-published-domain \
WMS_SANDBOX_API_KEY="$WMS_SANDBOX_API_KEY" \
WMS_PRODUCTION_API_KEY="$WMS_PRODUCTION_API_KEY" \
npm run check:wms-production
```

The check verifies the public health endpoint, the `wms_test_` and `wms_live_`
prefixes, and an authenticated orders request for each key. It never prints
either plaintext key. Review the WMS audit log after the run and confirm the
two requests belong to the expected partner and key records.

New or rotated keys should include the `catalog:read` scope. Verify the
catalog read separately with
`GET /api/wms/v1/catalog?market=<authorized-market>&limit=1`; keys created
before the catalog endpoint was introduced must be replaced if they do not
already contain this scope.

After the warehouse passes its own sandbox test, keep the sandbox key for
future certification and only then enable the production route/key.

## 4. Schedule credential monitoring

The smoke check can run as a separate Replit Scheduled Deployment. Keep the
main store deployment on its existing web deployment target; the monitor is a
one-shot command that should run every 10–15 minutes:

```sh
npm run check:wms-production
```

Set `WMS_BASE_URL` to the published app URL, not the workspace development
URL. The monitor calls `/api/wms/v1/health` and then
`/api/wms/v1/orders?limit=1` independently with both keys. The order request
only reads one item and does not acknowledge or change an order.

### Required Replit Secrets and variables

Add these values to the Scheduled Deployment's environment. Store all secret
values through Replit Secrets; do not put them in this document or a command
history:

- `WMS_SANDBOX_API_KEY` — the `wms_test_` key.
- `WMS_PRODUCTION_API_KEY` — the `wms_live_` key.
- `NEON_DATABASE_URL` (or the app's `DATABASE_URL`) — used to persist alert
  cooldown state across scheduled runs. Apply migration
  `db/migrations/0007_wms_monitor_alerts.sql` before enabling the monitor.
- `SENDGRID_API_KEY` — used only to send operator alerts.
- `SENDGRID_FROM_EMAIL` — a verified SendGrid sender.
- `WMS_ALERT_EMAIL` — the operator mailbox that receives alerts.

`WMS_BASE_URL`, `WMS_ALERT_COOLDOWN_MINUTES` (default `60`), and
`WMS_CHECK_TIMEOUT_MS` (default `10000`) are ordinary configuration variables,
not credentials. Each check has its own failure fingerprint, so a repeated
outage sends at most one alert per cooldown window while a newly changed
failure alerts immediately. No API key value is written to logs, database
state, or notifications.

### Planned key rotation

Before revoking or replacing a key, pause the Scheduled Deployment or set
`WMS_MONITOR_PAUSED=true`. A paused run makes no WMS requests and sends no
alerts. Complete the rotation, update both Replit Secrets, run the manual
check once, then resume the schedule and remove the pause variable. Do not
delete the database alert-state rows; keeping them avoids losing the
outage history during a rotation.# WMS production readiness

See [WMS Integration API](wms-api.md) for the partner-facing endpoint
contract. This document covers the xHACCP operator checklist for publishing
and monitoring it.

Use this checklist before connecting the first warehouse. The production API
key must be stored in Replit Secrets or the warehouse's secret manager. Never
paste the plaintext key into chat, a ticket, a commit, or this file.

## 1. Publish the schema safely

1. Confirm `shared/schema.ts` contains the WMS tables and order columns from
   `db/migrations/0006_wms_partner_api.sql`.
2. Publish from the current development database.
3. In the Publish schema review, confirm the WMS changes are additive:
   `fulfillment_partners`, `market_fulfillment`, `wms_api_keys`,
   `wms_shipments`, `wms_order_events`, `wms_inventory`,
   `wms_idempotency_keys`, `wms_audit_logs`, and the WMS order columns.
4. Do not choose overwrite production data. If Publish reports a rename or a
   drop, stop and resolve the schema difference before continuing.
5. Confirm the published app responds to
   `GET /api/wms/v1/health` with HTTP 200.
6. Validate the repository contract before publishing:
   `npm run validate:wms-openapi`.

The repository does not run DDL during build or startup. Development schema
changes are applied through the normal post-merge flow, and production schema
changes are applied by Publish.

The partner-facing machine-readable contract is
`docs/openapi/wms-v1.json`. Run `npm run test:wms` before release; this also
checks the WMS route list, scopes, response codes, schemas, and documented
error codes for drift.

## 2. Record one routing decision per marketplace

In Admin → WMS partners, review all three cards:

- `ro`: activate the intended partner, or select the intended partner and
  leave **Rutare activă** unchecked.
- `fr`: make the same deliberate choice.
- `com`: make the same deliberate choice.

The overview marks a market as `activă`, `inactivă`, or `neconfigurată`.
Production readiness is complete only when all three are either active or
explicitly inactive. An unconfigured market is not an intentional decision.

An active route is used for new fulfillment snapshots. Changing routing does
not rewrite orders that already have a `fulfillment_partner_id`; requeue those
orders only after confirming the desired partner.

## 3. Test sandbox and production keys independently

Create one Sandbox key and one Production key for the intended partner. Store
the plaintext production key outside chat, then expose both values to the
local smoke check only through environment variables:

```sh
WMS_BASE_URL=https://your-published-domain \
WMS_SANDBOX_API_KEY="$WMS_SANDBOX_API_KEY" \
WMS_PRODUCTION_API_KEY="$WMS_PRODUCTION_API_KEY" \
npm run check:wms-production
```

The check verifies the public health endpoint, the `wms_test_` and `wms_live_`
prefixes, and an authenticated orders request for each key. It never prints
either plaintext key. Review the WMS audit log after the run and confirm the
two requests belong to the expected partner and key records.

After the warehouse passes its own sandbox test, keep the sandbox key for
future certification and only then enable the production route/key.

## 4. Schedule credential monitoring

The smoke check can run as a separate Replit Scheduled Deployment. Keep the
main store deployment on its existing web deployment target; the monitor is a
one-shot command that should run every 10–15 minutes:

```sh
npm run check:wms-production
```

Set `WMS_BASE_URL` to the published app URL, not the workspace development
URL. The monitor calls `/api/wms/v1/health` and then
`/api/wms/v1/orders?limit=1` independently with both keys. The order request
only reads one item and does not acknowledge or change an order.

### Required Replit Secrets and variables

Add these values to the Scheduled Deployment's environment. Store all secret
values through Replit Secrets; do not put them in this document or a command
history:

- `WMS_SANDBOX_API_KEY` — the `wms_test_` key.
- `WMS_PRODUCTION_API_KEY` — the `wms_live_` key.
- `NEON_DATABASE_URL` (or the app's `DATABASE_URL`) — used to persist alert
  cooldown state across scheduled runs. Apply migration
  `db/migrations/0007_wms_monitor_alerts.sql` before enabling the monitor.
- `SENDGRID_API_KEY` — used only to send operator alerts.
- `SENDGRID_FROM_EMAIL` — a verified SendGrid sender.
- `WMS_ALERT_EMAIL` — the operator mailbox that receives alerts.

`WMS_BASE_URL`, `WMS_ALERT_COOLDOWN_MINUTES` (default `60`), and
`WMS_CHECK_TIMEOUT_MS` (default `10000`) are ordinary configuration variables,
not credentials. Each check has its own failure fingerprint, so a repeated
outage sends at most one alert per cooldown window while a newly changed
failure alerts immediately. No API key value is written to logs, database
state, or notifications.

### Planned key rotation

Before revoking or replacing a key, pause the Scheduled Deployment or set
`WMS_MONITOR_PAUSED=true`. A paused run makes no WMS requests and sends no
alerts. Complete the rotation, update both Replit Secrets, run the manual
check once, then resume the schedule and remove the pause variable. Do not
delete the database alert-state rows; keeping them avoids losing the
outage history during a rotation.