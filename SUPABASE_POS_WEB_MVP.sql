-- Optional POS Web MVP schema support.
-- Apply this so POS-created orders keep their status stage in Supabase instead
-- of only inside items_json. POS uses: PREPARING -> SERVED -> PAID.

alter table public.orders
  add column if not exists service_mode text,
  add column if not exists payment_status text not null default 'UNPAID',
  add column if not exists workflow_status text not null default 'PREPARING',
  add column if not exists item_checklist_json jsonb not null default '[]'::jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists order_note text,
  add column if not exists gcash_reference_last4 text,
  add column if not exists uploaded_at timestamptz;

alter table public.orders
  drop constraint if exists orders_workflow_status_check,
  add constraint orders_workflow_status_check
    check (workflow_status in ('PREPARING', 'SERVED', 'PAID'));

alter table public.orders
  drop constraint if exists orders_payment_status_check,
  add constraint orders_payment_status_check
    check (payment_status in ('UNPAID', 'PARTIAL', 'PAID'));

create index if not exists orders_workflow_status_created_at_idx
  on public.orders (workflow_status, created_at desc);

create index if not exists orders_device_id_created_at_idx
  on public.orders (device_id, created_at desc);
