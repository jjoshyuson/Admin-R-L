-- Preserve menu data and the existing accounting/audit RPC interfaces.
CREATE OR REPLACE FUNCTION public.rnl_business_date(p_created_at timestamptz, p_shift_id text, p_session_id uuid)
RETURNS date LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $date$
  SELECT coalesce(
    (SELECT business_date FROM public.shift_sessions WHERE id=p_session_id),
    CASE WHEN p_shift_id ~ '^\d{4}-\d{2}-\d{2}-(first|second)$' THEN left(p_shift_id,10)::date END,
    ((p_created_at AT TIME ZONE 'Asia/Manila') -
      coalesce((SELECT CASE WHEN value->>'firstShiftStart' ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 THEN (value->>'firstShiftStart')::time END
                FROM public.admin_settings WHERE key='turnover_settings'), '08:00'::time))::date
  );
$date$;

CREATE OR REPLACE FUNCTION public.calculate_daily_accounting(p_business_date date)
 RETURNS SETOF public.daily_accounting
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = ''
AS $function$
with recursive active_orders as (
    select o.*
    from public.orders o
    left join public.order_voids ov on ov.device_order_id = o.device_order_id
    where ov.device_order_id is null
      and public.rnl_business_date(o.created_at, o.shift_id, o.shift_session_id) = p_business_date
),
order_items as (
    select
        ao.device_order_id,
        coalesce((item ->> 'name'), '') as item_name,
        coalesce(nullif(item ->> 'quantity', ''), '0')::numeric *
          case when item ->> 'isHalfOrder' = 'true' then 0.5 else 1 end as quantity
    from active_orders ao
    cross join lateral jsonb_array_elements(
        case
            when jsonb_typeof(ao.items_json::jsonb) = 'array' then ao.items_json::jsonb
            else '[]'::jsonb
        end
    ) item
),
matched_menu_items as (
    select
        oi.device_order_id,
        oi.item_name,
        oi.quantity,
        r.id as recipe_id
    from order_items oi
    join public.recipes r
      on r.recipe_type = 'MENU_ITEM'
     and r.normalized_recipe_name = public.normalize_accounting_key(oi.item_name)
),
missing_recipe_count as (
    select count(*)::integer as value
    from order_items oi
    left join public.recipes r
      on r.recipe_type = 'MENU_ITEM'
     and r.normalized_recipe_name = public.normalize_accounting_key(oi.item_name)
    where r.id is null
),
recursive_recipe_lines as (
    select
        mm.recipe_id as root_recipe_id,
        ri.ingredient_ref_id,
        ri.ingredient_ref_type,
        ri.ingredient_name,
        (mm.quantity * ri.recipe_quantity) as required_quantity,
        lower(trim(ri.recipe_unit)) as required_unit,
        false as has_conversion_issue,
        1 as depth,
        ARRAY[mm.recipe_id]::text[] as recipe_path
    from matched_menu_items mm
    join public.recipe_ingredients ri on ri.recipe_id = mm.recipe_id

    union all

    select
        rrl.root_recipe_id,
        child.ingredient_ref_id,
        child.ingredient_ref_type,
        child.ingredient_name,
        case
            when prep.yield_quantity is null or prep.yield_quantity <= 0 then null
            when public.measurement_family(rrl.required_unit) = 'unknown' then null
            when public.measurement_family(lower(trim(coalesce(prep.yield_unit, '')))) = 'unknown' then null
            when public.measurement_family(rrl.required_unit) <> public.measurement_family(lower(trim(coalesce(prep.yield_unit, '')))) then null
            when public.measurement_family(rrl.required_unit) = 'count'
                 and rrl.required_unit <> lower(trim(coalesce(prep.yield_unit, ''))) then null
            else (
                (rrl.required_quantity * public.measurement_factor(rrl.required_unit)) /
                (prep.yield_quantity * public.measurement_factor(lower(trim(coalesce(prep.yield_unit, '')))))
            ) * child.recipe_quantity
        end as required_quantity,
        lower(trim(child.recipe_unit)) as required_unit,
        (
            rrl.has_conversion_issue or
            prep.yield_quantity is null or prep.yield_quantity <= 0 or
            public.measurement_family(rrl.required_unit) = 'unknown' or
            public.measurement_family(lower(trim(coalesce(prep.yield_unit, '')))) = 'unknown' or
            public.measurement_family(rrl.required_unit) <> public.measurement_family(lower(trim(coalesce(prep.yield_unit, '')))) or
            (
                public.measurement_family(rrl.required_unit) = 'count' and
                rrl.required_unit <> lower(trim(coalesce(prep.yield_unit, '')))
            )
        ) as has_conversion_issue,
        rrl.depth + 1 as depth,
        rrl.recipe_path || prep.id as recipe_path
    from recursive_recipe_lines rrl
    join public.recipes prep
      on prep.id = rrl.ingredient_ref_id
     and rrl.ingredient_ref_type = 'recipe'
    join public.recipe_ingredients child on child.recipe_id = prep.id
    where rrl.depth < 10 and NOT prep.id = ANY(rrl.recipe_path)
),
leaf_recipe_lines as (
    select
        root_recipe_id,
        ingredient_ref_id as ingredient_id,
        ingredient_name,
        required_quantity,
        required_unit,
        has_conversion_issue
    from recursive_recipe_lines
    where ingredient_ref_type <> 'recipe'
),
resolved_prices as (
    select ingredient_id, price, unit, business_date
    from (
        select
            ipl.ingredient_id,
            ipl.price,
            lower(trim(ipl.unit)) as unit,
            ipl.business_date,
            row_number() over (
                partition by ipl.ingredient_id
                order by ipl.business_date desc, ipl.updated_at desc, ipl.created_at desc, ipl.id desc
            ) as row_num
        from public.ingredient_price_logs ipl
        where ipl.business_date <= p_business_date
    ) ranked
    where ranked.row_num = 1
),
costed_leaf_lines as (
    select
        lrl.root_recipe_id,
        case
            when lrl.required_quantity is null then null
            when rp.ingredient_id is null then null
            when public.measurement_family(lrl.required_unit) = 'unknown' then null
            when public.measurement_family(rp.unit) = 'unknown' then null
            when public.measurement_family(lrl.required_unit) <> public.measurement_family(rp.unit) then null
            when public.measurement_family(lrl.required_unit) = 'count' and lrl.required_unit <> rp.unit then null
            else (
                (lrl.required_quantity * public.measurement_factor(lrl.required_unit)) /
                public.measurement_factor(rp.unit)
            ) * rp.price
        end as line_cost,
        (
            lrl.has_conversion_issue or
            lrl.required_quantity is null or
            rp.ingredient_id is null or
            public.measurement_family(lrl.required_unit) = 'unknown' or
            public.measurement_family(rp.unit) = 'unknown' or
            public.measurement_family(lrl.required_unit) <> public.measurement_family(rp.unit) or
            (
                public.measurement_family(lrl.required_unit) = 'count' and
                lrl.required_unit <> rp.unit
            )
        ) as has_issue,
        case
            when rp.ingredient_id is null then true
            else rp.business_date <> p_business_date
        end as used_fallback
    from leaf_recipe_lines lrl
    left join resolved_prices rp on rp.ingredient_id = lrl.ingredient_id
),
unresolved_recipe_lines as (
    select 1 from recursive_recipe_lines rrl
    where rrl.ingredient_ref_type = 'recipe' and (
      rrl.depth >= 10 or rrl.ingredient_ref_id = ANY(rrl.recipe_path) or
      not exists (select 1 from public.recipes r join public.recipe_ingredients ri on ri.recipe_id=r.id where r.id=rrl.ingredient_ref_id)
    )
),
expense_summary as (
    select coalesce(sum(cm.amount),0)::numeric(12,2) as total_expenses
    from public.cash_movements cm
    where cm.movement_kind='PAY_OUT'
      and public.rnl_business_date(cm.created_at,cm.shift_id,cm.shift_session_id)=p_business_date
      and not exists (select 1 from public.cash_movements reversal
        where reversal.movement_kind='ADJUSTMENT_PLUS'
          and reversal.related_bill_id='void-expense:' || cm.id)
),
cost_summary as (
    select
        coalesce(sum(coalesce(line_cost, 0)), 0)::numeric(12,2) as total_cost,
        (coalesce(bool_or(has_issue), false) or exists (select 1 from unresolved_recipe_lines)) as has_conversion_issue,
        coalesce(bool_or(used_fallback), false) as has_fallback_pricing
    from costed_leaf_lines
),
sales_summary as (
    select
        coalesce(sum(coalesce(total, 0)), 0)::numeric(12,2) as total_sales,
        coalesce(sum(
            case
                when coalesce(subtotal, 0) > 0 then subtotal
                when coalesce(tax, 0) > 0 then greatest(total - tax, 0)
                else total
            end
        ), 0)::numeric(12,2) as net_sales,
        count(*)::integer as order_count
    from active_orders
),
upserted as (
    insert into public.daily_accounting (
        business_date,
        calculated_at,
        total_sales,
        net_sales,
        total_cost,
        gross_profit,
        net_profit,
        order_count,
        source_label,
        missing_recipe_count,
        has_fallback_pricing,
        has_conversion_issue,
        updated_at
    )
    select
        p_business_date,
        now(),
        ss.total_sales,
        ss.net_sales,
        cs.total_cost,
        (ss.net_sales - cs.total_cost)::numeric(12,2) as gross_profit,
        (ss.net_sales - cs.total_cost - es.total_expenses)::numeric(12,2) as net_profit,
        ss.order_count,
        'Supabase ingredient price logs with latest-earlier fallback',
        mrc.value,
        cs.has_fallback_pricing,
        cs.has_conversion_issue,
        now()
    from sales_summary ss
    cross join cost_summary cs
    cross join expense_summary es
    cross join missing_recipe_count mrc
    on conflict (business_date) do update set
        calculated_at = excluded.calculated_at,
        total_sales = excluded.total_sales,
        net_sales = excluded.net_sales,
        total_cost = excluded.total_cost,
        gross_profit = excluded.gross_profit,
        net_profit = excluded.net_profit,
        order_count = excluded.order_count,
        source_label = excluded.source_label,
        missing_recipe_count = excluded.missing_recipe_count,
        has_fallback_pricing = excluded.has_fallback_pricing,
        has_conversion_issue = excluded.has_conversion_issue,
        updated_at = excluded.updated_at
    returning *
)
select * from upserted;
$function$
;

CREATE OR REPLACE FUNCTION public.approve_shift_audit(p_shift_id text, p_business_date date, p_shift_type text, p_counted_cash numeric, p_verified_gcash numeric, p_notes text, p_variance_reason text, p_audited_by text)
 RETURNS public.shift_audits
 LANGUAGE plpgsql
 SET search_path = ''
AS $function$
declare
  v_expected_cash numeric(12,2);
  v_expected_gcash numeric(12,2);
  v_cash_variance numeric(12,2);
  v_gcash_variance numeric(12,2);
  v_movement_id text := 'shift-audit-' || p_shift_id;
  v_audit public.shift_audits;
begin
  if p_shift_type not in ('FIRST','SECOND') or p_shift_type is null or p_business_date is null
     or p_shift_id is distinct from p_business_date::text || '-' || lower(p_shift_type) then
    raise exception 'Shift identity does not match its business date and type.';
  end if;
  if p_counted_cash is null or p_verified_gcash is null or p_counted_cash < 0 or p_verified_gcash < 0 then
    raise exception 'Cash and GCash counts must be nonnegative.';
  end if;
  -- Serialize audit attempts for the same financial shift.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_shift_id, 0));
  if exists (select 1 from public.shift_audits where shift_id = p_shift_id) then
    raise exception 'This shift has already been audited.';
  end if;
  if exists (select 1 from public.shift_sessions where shift_id = p_shift_id and status = 'OPEN') then
    raise exception 'Close all cashier sessions before auditing this shift.';
  end if;

  select coalesce(sum(amount) filter (where method = 'CASH'), 0),
         coalesce(sum(amount) filter (where method = 'GCASH'), 0)
    into v_expected_cash, v_expected_gcash
    from public.shift_payment_events e where collection_shift_id = p_shift_id
      and exists (select 1 from public.orders o where o.device_order_id=e.order_id)
      and not exists (select 1 from public.order_voids ov where ov.device_order_id=e.order_id);
  v_expected_cash := v_expected_cash - coalesce((select sum(amount) from public.cash_movements cm where shift_id = p_shift_id and movement_kind = 'PAY_OUT' and not exists (select 1 from public.cash_movements reversal where reversal.movement_kind='ADJUSTMENT_PLUS' and reversal.related_bill_id='void-expense:' || cm.id) and account_type <> 'BANK'), 0)
    + coalesce((select sum(case when direction = 'ADD' then amount else -amount end) from public.shift_adjustments where shift_id = p_shift_id and account = 'CASH' and status = 'APPROVED'), 0);
  v_expected_gcash := v_expected_gcash - coalesce((select sum(amount) from public.cash_movements cm where shift_id = p_shift_id and movement_kind = 'PAY_OUT' and not exists (select 1 from public.cash_movements reversal where reversal.movement_kind='ADJUSTMENT_PLUS' and reversal.related_bill_id='void-expense:' || cm.id) and account_type = 'BANK'), 0)
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
end $function$
;
