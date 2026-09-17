# SmartBill product synchronization

## Supported API contract

SmartBill does not expose a supported V1 `GET` or `POST /products` endpoint.
The published V3 `/v3/companies/{cif}/products` resource is a paginated,
read-only catalog listing and requires a separate Bearer token.

Romanian product synchronization therefore uses the supported V1
`POST /invoice/v2` contract:

- `isDraft: true` prevents invoice numbering and keeps the synchronization
  document as a draft.
- Each product is sent with `saveToDb: true`.
- SmartBill creates a missing catalog product and updates an existing product
  matched by `code`.
- The payload uses `productDescription`, `measuringUnitName`, `taxName`,
  `taxPercentage`, and `isTaxIncluded`; unsupported `/products` fields are not
  sent.
- A draft contains at most 400 product lines, matching the SmartBill API
  limit. Larger catalogs are split into multiple drafts.
- The Admin response reports products submitted, draft count, failures, and
  duplicate local codes skipped. It does not claim to know whether an
  individual remote row was created or updated.

## Controlled verification

On 2026-09-17, the test product code `XHACCP-SB-SYNC-CHECK` was submitted
twice through `/invoice/v2` with `saveToDb: true`, first with its initial
name/price and then with updated values. Both requests returned HTTP 200 with
an empty `errorText`, the SmartBill message `Factura a fost salvata in
ciorna.`, and no invoice number. The application-level synchronization test
also submitted the same code once when duplicate local rows were provided,
and reported the second row in `skippedDuplicateCodes`.

The Admin product sync button now displays the real submitted, draft, and
failure counts. Catalog listing through the separate `/admin/api/smartbill/products`
route remains unavailable until a `SMARTBILL_V3_TOKEN` (or equivalent V3
environment secret) is configured.