-- Ten thousand real-menu-derived orders and collections. Intentional exception rolls everything back.
DO $stress$
DECLARE s uuid; a public.daily_accounting; v public.shift_audits; expected_sales numeric; expected_cost numeric; results jsonb; started timestamptz:=clock_timestamp();
BEGIN
 UPDATE public.admin_settings SET value='null'::jsonb WHERE key='operational_reset_at';
 INSERT INTO public.shift_sessions(shift_id,business_date,shift_type,employee_id,employee_name,device_id,status,clocked_in_at,clocked_out_at,schedule_snapshot)
 VALUES('2026-10-12-second','2026-10-12','SECOND','synthetic','Synthetic','stress-device','CLOSED','2026-10-12 20:00+08','2026-10-13 09:00+08','{}') RETURNING id INTO s;
 INSERT INTO public.ingredients(id,name) VALUES('stress-ingredient','Synthetic ingredient');
 INSERT INTO public.ingredient_price_logs(ingredient_id,ingredient_name,business_date,price,unit) VALUES('stress-ingredient','Synthetic ingredient','2026-10-12',20,'kg');
 INSERT INTO public.recipes(id,recipe_name,normalized_recipe_name)
 SELECT 'stress-recipe-'||min(id::text),min(name),public.normalize_accounting_key(name) FROM public.products WHERE price>0 GROUP BY public.normalize_accounting_key(name);
 INSERT INTO public.recipe_ingredients(id,recipe_id,ingredient_ref_id,ingredient_name,recipe_quantity,recipe_unit)
 SELECT 'stress-line-'||id,id,'stress-ingredient','Synthetic ingredient',1,'kg' FROM public.recipes WHERE id LIKE 'stress-recipe-%';
 WITH menu AS (SELECT *,row_number() over(order by id)-1 as n,count(*) over() as size FROM public.products WHERE price>0)
 INSERT INTO public.orders(device_order_id,payment_method,total,subtotal,items_json,created_at,shift_id,shift_session_id,payment_status)
 SELECT 'stress-order-'||i,'CASH',price,price,jsonb_build_array(jsonb_build_object('name',name,'quantity',1,'isHalfOrder',i%2=0)),'2026-10-13 00:01+08','2026-10-12-second',s,'PAID'
 FROM generate_series(1,10000) i JOIN menu ON n=(i-1)%size;
 SELECT sum(total),sum(CASE WHEN (items_json->0->>'isHalfOrder')::boolean THEN 10 ELSE 20 END) INTO expected_sales,expected_cost FROM public.orders WHERE device_order_id LIKE 'stress-order-%';
 INSERT INTO public.shift_payment_events(id,order_id,origin_shift_id,collection_shift_id,shift_session_id,method,amount,collected_by)
 SELECT 'stress-event-'||device_order_id,device_order_id,'2026-10-12-first','2026-10-12-second',s,'CASH',total,'Synthetic' FROM public.orders WHERE device_order_id LIKE 'stress-order-%';
 -- Stable identifiers make replay idempotent.
 INSERT INTO public.shift_payment_events SELECT * FROM public.shift_payment_events WHERE id LIKE 'stress-event-%' ON CONFLICT(id) DO NOTHING;
 INSERT INTO public.cash_movements(id,account_id,account_type,movement_kind,reason_category,amount,shift_id,created_at)
 VALUES('stress-expense','drawer','TABLET_DRAWER','PAY_OUT','OTHER',100,'2026-10-12-second','2026-10-13 00:02+08');
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-12');
 SELECT * INTO v FROM public.approve_shift_audit('2026-10-12-second','2026-10-12','SECOND',expected_sales-100,0,'Stress fixture',null,'Synthetic');
 results=jsonb_build_object('orders',a.order_count,'all_sales_exact',a.total_sales=expected_sales,'half_portion_cost_exact',a.total_cost=expected_cost,'profit_exact',a.net_profit=expected_sales-expected_cost-100,'audit_exact',v.expected_cash=expected_sales-100,'idempotent_event_count',(SELECT count(*)=10000 FROM public.shift_payment_events),'elapsed_ms',round(extract(epoch from clock_timestamp()-started)*1000));
 RAISE EXCEPTION 'ROLLBACK_STRESS_RESULTS: %',results;
END $stress$;
