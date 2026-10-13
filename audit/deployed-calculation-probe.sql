DO $probe$
DECLARE p public.products; s uuid; a public.daily_accounting; audit public.shift_audits; result jsonb;
BEGIN
 SELECT * INTO p FROM public.products WHERE price>0 ORDER BY id LIMIT 1;
 INSERT INTO public.shift_sessions(shift_id,business_date,shift_type,employee_id,employee_name,device_id,status,clocked_in_at,clocked_out_at,schedule_snapshot)
 VALUES('audit-probe','2026-10-12','SECOND','synthetic','Synthetic','audit-probe','CLOSED','2026-10-12 20:00+08','2026-10-13 09:00+08','{}') RETURNING id INTO s;
 INSERT INTO public.orders(device_order_id,payment_method,total,subtotal,items_json,created_at,shift_id,shift_session_id)
 VALUES('audit-probe','CASH',p.price,p.price,jsonb_build_array(jsonb_build_object('name',p.name,'quantity',1,'isHalfOrder',true)),'2026-10-13 00:01+08','audit-probe',s);
 INSERT INTO public.recipes(id,recipe_name,normalized_recipe_name) VALUES('audit-probe',p.name,public.normalize_accounting_key(p.name));
 INSERT INTO public.ingredients(id,name) VALUES('audit-probe','Synthetic ingredient');
 INSERT INTO public.recipe_ingredients(id,recipe_id,ingredient_ref_id,ingredient_name,recipe_quantity,recipe_unit) VALUES('audit-probe','audit-probe','audit-probe','Synthetic ingredient',1,'kg');
 INSERT INTO public.ingredient_price_logs(ingredient_id,ingredient_name,business_date,price,unit) VALUES('audit-probe','Synthetic ingredient','2026-10-12',20,'kg');
 INSERT INTO public.shift_payment_events(id,order_id,collection_shift_id,shift_session_id,method,amount,collected_by) VALUES('audit-probe','nonexistent-order','audit-probe',s,'CASH',100,'Synthetic');
 INSERT INTO public.cash_movements(id,account_id,account_type,movement_kind,reason_category,amount,shift_id) VALUES('audit-probe','drawer','CASH','PAY_OUT','OTHER',10,'audit-probe');
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-12');
 result=jsonb_build_object('shift_business_date_order_count',a.order_count);
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-13');
 result=result||jsonb_build_object('calendar_date_order_count',a.order_count,'half_order_cost',a.total_cost,'net_profit',a.net_profit,'gross_profit',a.gross_profit);
 SELECT * INTO audit FROM public.approve_shift_audit('audit-probe','2026-10-12','SECOND',90,0,'probe',null,'Synthetic');
 result=result||jsonb_build_object('orphan_payment_expected_cash',audit.expected_cash);
 RAISE EXCEPTION 'ROLLBACK_AUDIT_RESULT: %',result;
END $probe$;
