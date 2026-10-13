-- The menu-only baseline is the start of a new operational generation.
INSERT INTO public.admin_settings(key,value,updated_at)
VALUES('operational_reset_at',to_jsonb(now()),now()) ON CONFLICT(key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.reject_pre_reset_order() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
DECLARE cutoff timestamptz;
BEGIN
 SELECT (value #>> '{}')::timestamptz INTO cutoff FROM public.admin_settings WHERE key='operational_reset_at';
 IF cutoff IS NOT NULL AND NEW.created_at <= cutoff THEN
   RAISE EXCEPTION 'This order predates the operational reset. Keep it in the recovery archive.';
 END IF;
 RETURN NEW;
END $guard$;
DROP TRIGGER IF EXISTS reject_pre_reset_order ON public.orders;
CREATE TRIGGER reject_pre_reset_order BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.reject_pre_reset_order();

CREATE OR REPLACE FUNCTION public.reset_rnl_operational_data() RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $reset$
DECLARE t text; remaining boolean;
BEGIN
 -- One transaction: permission failures leave every operational table intact.
 FOREACH t IN ARRAY ARRAY['shift_payment_events','order_edit_requests','shift_audits','shift_adjustments','cash_movements','payables','daily_accounting','recipe_ingredients','inventory_counts','ingredient_price_logs','inventory_items','recipes','ingredients','ingredient_categories','order_voids','qrk_order_receipts','orders','shift_sessions'] LOOP
   EXECUTE format('DELETE FROM public.%I',t);
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I)',t) INTO remaining;
   IF remaining THEN RAISE EXCEPTION 'Reset could not clear %; database permissions must be configured first.',t; END IF;
 END LOOP;
 UPDATE public.admin_settings SET value='{"workVaultShifts":[],"transactions":[],"schedule":[],"attendance":[]}'::jsonb,updated_at=now() WHERE key='salary_tracker';
 UPDATE public.admin_settings SET value='{"records":[]}'::jsonb,updated_at=now() WHERE key='employee_consumption';
 INSERT INTO public.admin_settings(key,value,updated_at) VALUES('operational_reset_at',to_jsonb(now()),now())
 ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at;
END $reset$;
