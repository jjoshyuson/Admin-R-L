-- R&L <-> QRK MENU integration contract.
-- Safe to re-run. This migration does not modify or delete existing menu/order rows.

create table if not exists public.qrk_integrations (
  integration_id text primary key,
  description text not null default '',
  api_key_sha256 bytea not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.qrk_order_receipts (
  integration_id text not null references public.qrk_integrations(integration_id),
  idempotency_key text not null,
  source_order_id text not null,
  request_sha256 bytea not null,
  rnl_order_id uuid not null references public.orders(id),
  rnl_device_order_id text not null,
  received_at timestamptz not null default now(),
  primary key (integration_id, idempotency_key),
  unique (rnl_order_id),
  unique (rnl_device_order_id)
);

alter table public.qrk_order_receipts add column if not exists source_order_id text;
update public.qrk_order_receipts set source_order_id = idempotency_key where source_order_id is null;
alter table public.qrk_order_receipts alter column source_order_id set not null;
create unique index if not exists qrk_order_receipts_source_order_id_key
  on public.qrk_order_receipts (integration_id, source_order_id);

alter table public.qrk_integrations enable row level security;
alter table public.qrk_order_receipts enable row level security;
revoke all on public.qrk_integrations, public.qrk_order_receipts from public, anon, authenticated;

alter table public.orders
  drop constraint if exists orders_workflow_status_check,
  add constraint orders_workflow_status_check
    check (workflow_status in ('PENDING_ACCEPTANCE', 'PREPARING', 'SERVED', 'PAID'));

create or replace function public.qrk_require_integration(p_api_key text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_id text;
begin
  if nullif(btrim(p_api_key), '') is null then
    raise exception 'integration authentication failed' using errcode = '28000';
  end if;

  select integration_id into resolved_id
  from public.qrk_integrations
  where active
    and api_key_sha256 = extensions.digest(convert_to(p_api_key, 'UTF8'), 'sha256');

  if resolved_id is null then
    raise exception 'integration authentication failed' using errcode = '28000';
  end if;

  update public.qrk_integrations set last_used_at = now(), updated_at = now()
  where integration_id = resolved_id;
  return resolved_id;
end;
$$;

revoke all on function public.qrk_require_integration(text) from public, anon, authenticated;

create or replace function public.qrk_read_catalog(p_api_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_integration_id text;
begin
  resolved_integration_id := public.qrk_require_integration(p_api_key);
  return jsonb_build_object(
    'version', 1,
    'provider', 'rnl',
    'integrationId', resolved_integration_id,
    'generatedAt', now(),
    'modifierSupport', 'none',
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'externalId', category.id,
        'name', category.name,
        'sortOrder', category.sort_order,
        'active', category.is_active,
        'updatedAt', category.updated_at,
        'items', coalesce((
          select jsonb_agg(jsonb_build_object(
            'externalId', product.id,
            'name', product.name,
            'price', product.price,
            'halfOrderPrice', product.half_order_price,
            'availability', product.status,
            'active', product.is_active,
            'stockCount', product.stock_count,
            'lowStock', product.is_low_stock,
            'imagePath', product.image_path,
            'modifierGroups', '[]'::jsonb,
            'updatedAt', product.updated_at
          ) order by product.name, product.id)
          from public.products product
          where product.category_id = category.id
        ), '[]'::jsonb)
      ) order by category.sort_order, category.name, category.id)
      from public.categories category
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.qrk_ingest_order(p_api_key text, p_order jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_integration_id text;
  resolved_idempotency_key text;
  request_hash bytea;
  prior public.qrk_order_receipts%rowtype;
  source_order_id text;
  service_mode text;
  payment_method text;
  payment_status text;
  customer_name text;
  table_number text;
  order_note text;
  item_input jsonb;
  item_product public.products%rowtype;
  item_category text;
  quantity integer;
  is_half boolean;
  unit_price numeric;
  line_total numeric;
  items jsonb := '[]'::jsonb;
  subtotal numeric := 0;
  tax numeric;
  total numeric;
  cash_amount numeric;
  gcash_amount numeric;
  created public.orders%rowtype;
  device_order_id text;
begin
  resolved_integration_id := public.qrk_require_integration(p_api_key);
  if jsonb_typeof(p_order) <> 'object' then
    raise exception 'order must be a JSON object' using errcode = '22023';
  end if;

  resolved_idempotency_key := nullif(btrim(p_order ->> 'idempotencyKey'), '');
  source_order_id := nullif(btrim(p_order ->> 'sourceOrderId'), '');
  if resolved_idempotency_key is null or length(resolved_idempotency_key) > 160 then
    raise exception 'idempotencyKey is required and must be at most 160 characters' using errcode = '22023';
  end if;
  if source_order_id is null then
    raise exception 'sourceOrderId is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_order -> 'items') <> 'array' or jsonb_array_length(p_order -> 'items') = 0 then
    raise exception 'items must be a non-empty array' using errcode = '22023';
  end if;

  request_hash := extensions.digest(convert_to(p_order::text, 'UTF8'), 'sha256');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(resolved_integration_id || ':' || resolved_idempotency_key, 0));
  select * into prior from public.qrk_order_receipts
  where qrk_order_receipts.integration_id = resolved_integration_id
    and qrk_order_receipts.idempotency_key = resolved_idempotency_key;
  if prior.rnl_order_id is not null then
    if prior.request_sha256 <> request_hash then
      raise exception 'idempotency key was already used with a different payload' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'version', 1,
      'acknowledged', true,
      'idempotentReplay', true,
      'rnlOrderId', prior.rnl_order_id,
      'rnlDeviceOrderId', prior.rnl_device_order_id
    );
  end if;

  for item_input in select value from jsonb_array_elements(p_order -> 'items') loop
    if nullif(item_input ->> 'productId', '') is null then
      raise exception 'each item requires productId' using errcode = '22023';
    end if;
    select * into item_product from public.products
    where id = (item_input ->> 'productId')::uuid and is_active and lower(status) = 'available';
    if item_product.id is null then
      raise exception 'product is unavailable: %', item_input ->> 'productId' using errcode = '22023';
    end if;

    quantity := coalesce((item_input ->> 'quantity')::integer, 0);
    if quantity < 1 or quantity > 99 then
      raise exception 'item quantity must be between 1 and 99' using errcode = '22023';
    end if;
    is_half := coalesce((item_input ->> 'isHalfOrder')::boolean, false);
    if is_half and item_product.half_order_price is null then
      raise exception 'half order is not available for product: %', item_product.id using errcode = '22023';
    end if;
    unit_price := case when is_half then item_product.half_order_price else item_product.price end;
    line_total := round(unit_price * quantity, 2);
    select name into item_category from public.categories where id = item_product.category_id;
    subtotal := subtotal + line_total;
    items := items || jsonb_build_array(jsonb_build_object(
      'productId', item_product.id,
      'categoryName', coalesce(item_category, 'Uncategorized'),
      'name', item_product.name,
      'serviceMode', upper(coalesce(nullif(item_input ->> 'serviceMode', ''), p_order #>> '{fulfillment,serviceMode}', 'DINE IN')),
      'isHalfOrder', is_half,
      'quantity', quantity,
      'price', unit_price,
      'lineTotal', line_total,
      'kitchenStatus', 'PENDING',
      'isChecked', false,
      'paidQuantity', 0,
      'kitchenPrintedQuantity', 0
    ));
  end loop;

  subtotal := round(subtotal, 2);
  tax := round(coalesce((p_order #>> '{totals,tax}')::numeric, 0), 2);
  total := round(subtotal + tax, 2);
  if tax < 0 then raise exception 'tax cannot be negative' using errcode = '22023'; end if;
  if p_order #>> '{totals,subtotal}' is not null and round((p_order #>> '{totals,subtotal}')::numeric, 2) <> subtotal then
    raise exception 'subtotal does not match the live R&L catalog' using errcode = '22023';
  end if;
  if p_order #>> '{totals,total}' is not null and round((p_order #>> '{totals,total}')::numeric, 2) <> total then
    raise exception 'total does not match subtotal plus tax' using errcode = '22023';
  end if;

  service_mode := upper(coalesce(nullif(p_order #>> '{fulfillment,serviceMode}', ''), 'DINE IN'));
  if service_mode not in ('DINE IN', 'TAKE OUT') then
    raise exception 'unsupported serviceMode' using errcode = '22023';
  end if;
  payment_method := lower(coalesce(nullif(p_order #>> '{payment,method}', ''), 'counter'));
  if payment_method not in ('counter', 'cash', 'gcash', 'split') then
    raise exception 'unsupported payment method' using errcode = '22023';
  end if;
  payment_status := upper(coalesce(nullif(p_order #>> '{payment,status}', ''), 'UNPAID'));
  if payment_status not in ('UNPAID', 'PARTIAL', 'PAID') then
    raise exception 'unsupported payment status' using errcode = '22023';
  end if;
  cash_amount := nullif(p_order #>> '{payment,cashAmount}', '')::numeric;
  gcash_amount := nullif(p_order #>> '{payment,gcashAmount}', '')::numeric;
  customer_name := nullif(btrim(p_order #>> '{customer,name}'), '');
  table_number := nullif(btrim(p_order #>> '{fulfillment,tableNumber}'), '');
  order_note := concat_ws(' · ',
    case when customer_name is not null then 'Customer: ' || customer_name end,
    case when table_number is not null then 'Table ' || table_number end,
    nullif(btrim(p_order #>> '{customer,note}'), '')
  );
  device_order_id := 'QRK-' || upper(regexp_replace(resolved_integration_id, '[^a-zA-Z0-9]+', '-', 'g')) || '-' ||
    upper(substr(encode(extensions.digest(convert_to(resolved_idempotency_key, 'UTF8'), 'sha256'), 'hex'), 1, 20));

  insert into public.orders (
    device_order_id, device_id, service_mode, payment_method, payment_reference,
    subtotal, tax, total, items_json, uploaded_at, created_at,
    cash_amount, gcash_amount, gcash_reference_last4, order_note,
    payment_status, workflow_status, item_checklist_json, completed_at
  ) values (
    device_order_id, 'QRK MENU', service_mode, payment_method, nullif(p_order #>> '{payment,reference}', ''),
    subtotal, tax, total, items, now(), coalesce(nullif(p_order ->> 'createdAt', '')::timestamptz, now()),
    cash_amount, gcash_amount, right(regexp_replace(coalesce(p_order #>> '{payment,reference}', ''), '[^0-9]', '', 'g'), 4),
    nullif(order_note, ''), payment_status, case when payment_status = 'PAID' then 'PAID' else 'PENDING_ACCEPTANCE' end,
    (select coalesce(jsonb_agg(false), '[]'::jsonb) from generate_series(1, jsonb_array_length(items))),
    case when payment_status = 'PAID' then now() else null end
  ) returning * into created;

  insert into public.qrk_order_receipts(integration_id, idempotency_key, source_order_id, request_sha256, rnl_order_id, rnl_device_order_id)
  values (resolved_integration_id, resolved_idempotency_key, source_order_id, request_hash, created.id, created.device_order_id);

  return jsonb_build_object(
    'version', 1,
    'acknowledged', true,
    'idempotentReplay', false,
    'rnlOrderId', created.id,
    'rnlDeviceOrderId', created.device_order_id,
    'workflowStatus', created.workflow_status,
    'paymentStatus', created.payment_status,
    'createdAt', created.created_at
  );
end;
$$;

create or replace function public.qrk_read_order_status(p_api_key text, p_rnl_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_integration_id text;
  result public.orders%rowtype;
begin
  resolved_integration_id := public.qrk_require_integration(p_api_key);
  select orders.* into result
  from public.orders orders
  join public.qrk_order_receipts receipt on receipt.rnl_order_id = orders.id
  where orders.id = p_rnl_order_id and receipt.integration_id = resolved_integration_id;
  if result.id is null then raise exception 'order not found' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'version', 1,
    'rnlOrderId', result.id,
    'rnlDeviceOrderId', result.device_order_id,
    'workflowStatus', result.workflow_status,
    'paymentStatus', result.payment_status,
    'updatedAt', coalesce(result.completed_at, result.uploaded_at, result.created_at)
  );
end;
$$;

revoke all on function public.qrk_read_catalog(text) from public, authenticated;
revoke all on function public.qrk_ingest_order(text, jsonb) from public, authenticated;
revoke all on function public.qrk_read_order_status(text, uuid) from public, authenticated;
grant execute on function public.qrk_read_catalog(text) to anon;
grant execute on function public.qrk_ingest_order(text, jsonb) to anon;
grant execute on function public.qrk_read_order_status(text, uuid) to anon;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
