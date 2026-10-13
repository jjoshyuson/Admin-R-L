-- Always rolls back. ROLLBACK_REGRESSION_RESULTS is the intentional result signal.
DO $probe$
DECLARE p public.products; s uuid; a public.daily_accounting; v public.shift_audits; results jsonb := '{}';
BEGIN
 -- Allow historical fixtures only inside this rolled-back owner transaction.
 UPDATE public.admin_settings SET value='null'::jsonb WHERE key='operational_reset_at';
 SELECT * INTO p FROM public.products WHERE price>0 ORDER BY id LIMIT 1;
 INSERT INTO public.shift_sessions(shift_id,business_date,shift_type,employee_id,employee_name,device_id,status,clocked_in_at,clocked_out_at,schedule_snapshot)
 VALUES('2026-10-12-second','2026-10-12','SECOND','synthetic','Synthetic','audit-probe','CLOSED','2026-10-12 20:00+08','2026-10-13 09:00+08','{}') RETURNING id INTO s;
 INSERT INTO public.orders(device_order_id,payment_method,total,subtotal,items_json,created_at,shift_id,shift_session_id)
 VALUES('audit-valid','CASH',p.price,p.price,jsonb_build_array(jsonb_build_object('name',p.name,'quantity',1,'isHalfOrder',true)),'2026-10-13 00:01+08','2026-10-12-second',s);
 INSERT INTO public.recipes(id,recipe_name,normalized_recipe_name) VALUES('audit-probe',p.name,public.normalize_accounting_key(p.name));
 INSERT INTO public.ingredients(id,name) VALUES('audit-probe','Synthetic ingredient');
 INSERT INTO public.recipe_ingredients(id,recipe_id,ingredient_ref_id,ingredient_name,recipe_quantity,recipe_unit) VALUES('audit-probe','audit-probe','audit-probe','Synthetic ingredient',1,'kg');
 INSERT INTO public.ingredient_price_logs(ingredient_id,ingredient_name,business_date,price,unit) VALUES('audit-probe','Synthetic ingredient','2026-10-12',20,'kg');
 INSERT INTO public.shift_payment_events(id,order_id,collection_shift_id,shift_session_id,method,amount,collected_by) VALUES
 ('audit-valid','audit-valid','2026-10-12-second',s,'CASH',100,'Synthetic'),
 ('audit-orphan','nonexistent-order','2026-10-12-second',s,'CASH',500,'Synthetic');
 INSERT INTO public.cash_movements(id,account_id,account_type,movement_kind,reason_category,amount,shift_id,created_at) VALUES
 ('audit-expense','drawer','TABLET_DRAWER','PAY_OUT','OTHER',10,'2026-10-12-second','2026-10-13 00:02+08'),
 ('audit-voided-expense','drawer','TABLET_DRAWER','PAY_OUT','OTHER',25,'2026-10-12-second','2026-10-13 00:03+08');
 INSERT INTO public.cash_movements(id,account_id,account_type,movement_kind,reason_category,amount,shift_id,related_bill_id) VALUES
 ('audit-reversal','drawer','TABLET_DRAWER','ADJUSTMENT_PLUS','OTHER',25,'2026-10-12-second','void-expense:audit-voided-expense');
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-12');
 results=results||jsonb_build_object('overnight_business_date',a.order_count=1,'half_portion_cost',a.total_cost=10,'net_profit_deducts_active_expenses',a.net_profit=p.price-20);
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-13');
 results=results||jsonb_build_object('not_double_counted_next_date',a.order_count=0);
 SELECT * INTO v FROM public.approve_shift_audit('2026-10-12-second','2026-10-12','SECOND',90,0,'probe','synthetic variance','Synthetic');
 results=results||jsonb_build_object('audit_excludes_orphan_and_voided_expense',v.expected_cash=90);
 -- Verify voided source orders do not count as collections.
 DELETE FROM public.shift_audits WHERE shift_id='2026-10-12-second';
 DELETE FROM public.cash_movements WHERE id='shift-audit-2026-10-12-second';
 INSERT INTO public.order_voids(device_order_id,void_reason,voided_by) VALUES('audit-valid','Synthetic','Synthetic');
 SELECT * INTO v FROM public.approve_shift_audit('2026-10-12-second','2026-10-12','SECOND',0,0,'probe','synthetic variance','Synthetic');
 results=results||jsonb_build_object('audit_excludes_voided_order',v.expected_cash=-10);
 DELETE FROM public.order_voids WHERE device_order_id='audit-valid';
 UPDATE public.ingredient_price_logs SET price=40,updated_at=now()+interval '1 second' WHERE ingredient_id='audit-probe' AND business_date='2026-10-12';
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-12');
 results=results||jsonb_build_object('latest_same_day_price',a.total_cost=20);
 UPDATE public.recipe_ingredients SET ingredient_ref_type='recipe',ingredient_ref_id='audit-probe' WHERE id='audit-probe';
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-12');
 results=results||jsonb_build_object('cyclic_recipe_flags_incomplete_cost',a.has_conversion_issue);
 UPDATE public.recipe_ingredients SET ingredient_ref_id='missing-recipe' WHERE id='audit-probe';
 SELECT * INTO a FROM public.calculate_daily_accounting('2026-10-12');
 results=results||jsonb_build_object('missing_nested_recipe_flags_incomplete_cost',a.has_conversion_issue);
 RAISE EXCEPTION 'ROLLBACK_REGRESSION_RESULTS: %',results;
END $probe$;
