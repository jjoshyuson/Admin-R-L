-- Two-shift turnover, collection events, and approval-controlled adjustments.
create table if not exists public.shift_sessions (
  id uuid primary key default gen_random_uuid(),
  shift_id text not null,
  business_date date not null,
  shift_type text not null check (shift_type in ('FIRST', 'SECOND')),
  employee_id text not null,
  employee_name text not null,
  device_id text not null,
  clocked_in_at timestamptz not null default now(),
  clocked_out_at timestamptz,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  schedule_snapshot jsonb not null
);
create unique index if not exists shift_sessions_one_open_device_idx on public.shift_sessions(device_id) where status = 'OPEN';
create index if not exists shift_sessions_report_idx on public.shift_sessions(business_date, shift_type, clocked_in_at);

alter table public.orders add column if not exists shift_id text, add column if not exists shift_session_id uuid references public.shift_sessions(id);
alter table public.cash_movements add column if not exists shift_id text, add column if not exists shift_session_id uuid references public.shift_sessions(id);
-- `payments` is optional in this app; some deployments derive payments from orders.
do $$ begin
  if to_regclass('public.payments') is not null then
    alter table public.payments
      add column if not exists origin_shift_id text,
      add column if not exists collection_shift_id text,
      add column if not exists shift_session_id uuid references public.shift_sessions(id);
  end if;
end $$;

create table if not exists public.shift_payment_events (
  id text primary key,
  order_id text not null,
  origin_shift_id text,
  collection_shift_id text not null,
  shift_session_id uuid not null references public.shift_sessions(id),
  method text not null check (method in ('CASH', 'GCASH')),
  amount numeric(12,2) not null check (amount > 0),
  collected_by text not null,
  collected_at timestamptz not null default now()
);
create index if not exists shift_payment_events_report_idx on public.shift_payment_events(collection_shift_id, collected_at);
create index if not exists shift_payment_events_order_idx on public.shift_payment_events(order_id);

-- Remove stale collection rows left behind if an order was deleted before this migration.
delete from public.shift_payment_events payment
where not exists (
  select 1 from public.orders source_order
  where source_order.device_order_id = payment.order_id
);

create table if not exists public.shift_adjustments (
  id text primary key,
  shift_id text not null,
  shift_session_id uuid references public.shift_sessions(id),
  account text not null check (account in ('CASH', 'GCASH')),
  direction text not null check (direction in ('ADD', 'REMOVE')),
  amount numeric(12,2) not null check (amount > 0),
  reason text not null,
  requested_by text not null,
  requested_at timestamptz not null default now(),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  approved_by text,
  approved_at timestamptz
);
create index if not exists shift_adjustments_report_idx on public.shift_adjustments(shift_id, requested_at);

-- A shift becomes financially final only after an admin reconciles both cash and GCash.
create table if not exists public.shift_audits (
  id uuid primary key default gen_random_uuid(),
  shift_id text not null unique,
  business_date date not null,
  shift_type text not null check (shift_type in ('FIRST', 'SECOND')),
  expected_cash numeric(12,2) not null,
  counted_cash numeric(12,2) not null check (counted_cash >= 0),
  cash_variance numeric(12,2) not null,
  expected_gcash numeric(12,2) not null,
  verified_gcash numeric(12,2) not null check (verified_gcash >= 0),
  gcash_variance numeric(12,2) not null,
  notes text,
  variance_reason text,
  status text not null default 'AUDITED' check (status = 'AUDITED'),
  audited_by text not null,
  audited_at timestamptz not null default now(),
  safe_movement_id text not null unique
);
create index if not exists shift_audits_date_idx on public.shift_audits(business_date, shift_type);

create or replace function public.approve_shift_audit(
  p_shift_id text, p_business_date date, p_shift_type text,
  p_counted_cash numeric, p_verified_gcash numeric,
  p_notes text, p_variance_reason text, p_audited_by text
) returns public.shift_audits language plpgsql as $$
declare
  v_expected_cash numeric(12,2);
  v_expected_gcash numeric(12,2);
  v_cash_variance numeric(12,2);
  v_gcash_variance numeric(12,2);
  v_movement_id text := 'shift-audit-' || p_shift_id;
  v_audit public.shift_audits;
begin
  if exists (select 1 from public.shift_audits where shift_id = p_shift_id) then
    raise exception 'This shift has already been audited.';
  end if;
  if exists (select 1 from public.shift_sessions where shift_id = p_shift_id and status = 'OPEN') then
    raise exception 'Close all cashier sessions before auditing this shift.';
  end if;

  select coalesce(sum(amount) filter (where method = 'CASH'), 0),
         coalesce(sum(amount) filter (where method = 'GCASH'), 0)
    into v_expected_cash, v_expected_gcash
    from public.shift_payment_events where collection_shift_id = p_shift_id;
  v_expected_cash := v_expected_cash - coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift_id and movement_kind = 'PAY_OUT' and account_type <> 'BANK'), 0)
    + coalesce((select sum(case when direction = 'ADD' then amount else -amount end) from public.shift_adjustments where shift_id = p_shift_id and account = 'CASH' and status = 'APPROVED'), 0);
  v_expected_gcash := v_expected_gcash - coalesce((select sum(amount) from public.cash_movements where shift_id = p_shift_id and movement_kind = 'PAY_OUT' and account_type = 'BANK'), 0)
    + coalesce((select sum(case when direction = 'ADD' then amount else -amount end) from public.shift_adjustments where shift_id = p_shift_id and account = 'GCASH' and status = 'APPROVED'), 0);
  v_cash_variance := p_counted_cash - v_expected_cash;
  v_gcash_variance := p_verified_gcash - v_expected_gcash;
  if (v_cash_variance <> 0 or v_gcash_variance <> 0) and coalesce(trim(p_variance_reason), '') = '' then
    raise exception 'A variance reason is required.';
  end if;

  insert into public.cash_movements (id, account_id, account_type, source_account_id, destination_account_id, movement_kind, reason_category, amount, note, created_by, created_at, shift_id)
  values (v_movement_id, 'main-safe', 'SAFE', null, 'main-safe', 'TRANSFER_IN', 'SHIFT_AUDIT', p_counted_cash, coalesce(p_notes, 'Approved shift cash'), p_audited_by, now(), p_shift_id);
  insert into public.shift_audits (shift_id, business_date, shift_type, expected_cash, counted_cash, cash_variance, expected_gcash, verified_gcash, gcash_variance, notes, variance_reason, audited_by, safe_movement_id)
  values (p_shift_id, p_business_date, p_shift_type, v_expected_cash, p_counted_cash, v_cash_variance, v_expected_gcash, p_verified_gcash, v_gcash_variance, p_notes, p_variance_reason, p_audited_by, v_movement_id)
  returning * into v_audit;
  return v_audit;
end $$;

alter table public.shift_sessions enable row level security;
alter table public.shift_payment_events enable row level security;
alter table public.shift_adjustments enable row level security;
alter table public.shift_audits enable row level security;
drop policy if exists "anon shift sessions" on public.shift_sessions;
create policy "anon shift sessions" on public.shift_sessions for all to anon using (true) with check (true);
drop policy if exists "anon shift payments" on public.shift_payment_events;
create policy "anon shift payments" on public.shift_payment_events for all to anon using (true) with check (true);
drop policy if exists "anon shift adjustments" on public.shift_adjustments;
create policy "anon shift adjustments" on public.shift_adjustments for all to anon using (true) with check (true);
drop policy if exists "anon shift audits" on public.shift_audits;
create policy "anon shift audits" on public.shift_audits for all to anon using (true) with check (true);

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_sessions') then alter publication supabase_realtime add table public.shift_sessions; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_payment_events') then alter publication supabase_realtime add table public.shift_payment_events; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shift_adjustments') then alter publication supabase_realtime add table public.shift_adjustments; end if;
end $$;
