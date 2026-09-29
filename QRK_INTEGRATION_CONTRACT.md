# R&L / QRK MENU integration contract

R&L remains authoritative for its catalog and POS order lifecycle. QRK calls three authenticated PostgreSQL RPCs through the R&L Supabase REST endpoint. The QRK backend must hold the integration key; browsers must never receive it.

## Authentication

Provision an integration by generating a cryptographically random secret outside SQL and storing only its SHA-256 digest:

```sql
insert into public.qrk_integrations(integration_id, description, api_key_sha256)
values ('qrk-production', 'QRK MENU production connector', decode('<sha256 hex>', 'hex'));
```

Call RPCs with the normal R&L publishable key in the Supabase `apikey` header and the server-held integration key in `p_api_key`. Direct access to integration and receipt tables is revoked from `anon` and `authenticated`.

## Manual catalog read

`POST /rest/v1/rpc/qrk_read_catalog`

```json
{"p_api_key":"SERVER_HELD_SECRET"}
```

The response is versioned and contains every R&L category and product, including stable UUIDs, sort order, active state, prices, half-order prices, availability, stock state, image storage paths and update timestamps. R&L currently has no modifier tables; each item therefore returns `modifierGroups: []` and the response declares `modifierSupport: "none"`.

QRK should run this endpoint only when an operator requests an import, calculate a diff using `externalId` and `updatedAt`, and require confirmation before changing its local projection.

## Exactly-once order ingestion

`POST /rest/v1/rpc/qrk_ingest_order`

```json
{
  "p_api_key": "SERVER_HELD_SECRET",
  "p_order": {
    "version": 1,
    "idempotencyKey": "qrk-order-uuid",
    "sourceOrderId": "QRK-1042",
    "createdAt": "2026-09-27T01:00:00Z",
    "customer": {"name": "Guest", "note": "No onions"},
    "fulfillment": {"serviceMode": "DINE IN", "tableNumber": "4"},
    "payment": {"method": "counter", "status": "UNPAID"},
    "totals": {"subtotal": 320, "tax": 0, "total": 320},
    "items": [
      {"productId": "RNL-PRODUCT-UUID", "quantity": 2, "isHalfOrder": false, "serviceMode": "DINE IN"}
    ]
  }
}
```

R&L re-reads each product and price, rejects unavailable products and mismatched totals, creates the existing `public.orders` record, and records both the QRK source order ID and idempotency receipt in one transaction. A repeated identical request returns the original R&L IDs with `idempotentReplay: true`; reuse with a different payload fails.

Successful response:

```json
{
  "version": 1,
  "acknowledged": true,
  "idempotentReplay": false,
  "rnlOrderId": "uuid",
  "rnlDeviceOrderId": "QRK-...",
  "workflowStatus": "PENDING_ACCEPTANCE",
  "paymentStatus": "UNPAID",
  "createdAt": "timestamp"
}
```

New unpaid QRK orders enter `PENDING_ACCEPTANCE`. They appear behind the notification bell on the R&L Orders page and do not enter kitchen preparation until a cashier selects **Accept & Prepare**. The remaining R&L workflow statuses are `PREPARING`, `SERVED`, and `PAID`. Payment statuses are `UNPAID`, `PARTIAL`, and `PAID`.

## Status reconciliation

`POST /rest/v1/rpc/qrk_read_order_status`

```json
{"p_api_key":"SERVER_HELD_SECRET","p_rnl_order_id":"uuid"}
```

Only orders created through the same integration are returned. QRK may poll this endpoint with bounded backoff until a future webhook/status push is added.

## Automatic POS appearance

`public.orders` is added to the `supabase_realtime` publication. The existing POS already subscribes to all order changes and performs an authoritative refetch, so acknowledged QRK orders appear without a manual refresh.

## Rotation and rollback

Rotate by replacing `api_key_sha256`. Disable without deleting history:

```sql
update public.qrk_integrations set active = false, updated_at = now()
where integration_id = 'qrk-production';
```

Disabling the integration blocks all three RPCs while preserving menu, order and receipt history.
