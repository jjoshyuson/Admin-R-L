-- Publish the tables already read by RNL so existing listeners receive committed changes.
DO $publication$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['products','categories','order_voids','daily_accounting','ingredient_price_logs','ingredients','ingredient_categories','recipes','recipe_ingredients','cash_movements','payables','admin_settings'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
   EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
  END IF;
 END LOOP;
END $publication$;
