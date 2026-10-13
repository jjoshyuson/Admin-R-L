-- Synthetic fixtures only. The success exception deliberately rolls back every write.
DO $test$
DECLARE prefix text:='fixture-'||gen_random_uuid()::text; a text; b text; d text; first jsonb; second jsonb; response jsonb; closed jsonb; reopened jsonb; wrong_pin boolean:=false; original_id uuid;
BEGIN
 a:=prefix||'-a';b:=prefix||'-b';d:=prefix||'-tablet';
 UPDATE public.admin_settings SET value=jsonb_set(value,'{employees}',coalesce(value->'employees','[]'::jsonb)||jsonb_build_array(
  jsonb_build_object('id',a,'name','Synthetic A','pin','1234','isActive',true,'isCashier',true),
  jsonb_build_object('id',b,'name','Synthetic B','pin','5678','isActive',true,'isCashier',true))) WHERE key='employees';
 BEGIN PERFORM public.rnl_staff_clock(a,'9999',d,'clock_in',true,NULL); EXCEPTION WHEN OTHERS THEN wrong_pin:=true; END;
 ASSERT wrong_pin,'Incorrect PIN accepted';
 ASSERT NOT EXISTS(SELECT 1 FROM public.staff_attendance WHERE employee_id=a),'Wrong PIN created attendance';
 first:=public.rnl_staff_clock(a,'1234',d,'clock_in',true,NULL);
 original_id:=(first->'attendance'->>'id')::uuid;
 response:=public.rnl_staff_clock(a,'1234',d,'clock_in',true,NULL);
 ASSERT response->'attendance'->>'id'=original_id::text,'Clock-in retry duplicated attendance';
 second:=public.rnl_staff_clock(b,'5678',d,'clock_in',false,NULL);
 ASSERT EXISTS(SELECT 1 FROM public.shift_sessions WHERE device_id=d AND employee_id=a AND status='OPEN'),'Attendance-only clock-in replaced cashier';
 PERFORM public.rnl_staff_clock(b,'5678',d,'use_cashier',false,NULL);
 ASSERT EXISTS(SELECT 1 FROM public.staff_attendance WHERE id=original_id AND clocked_out_at IS NULL),'Cashier switching ended another attendance';
 ASSERT EXISTS(SELECT 1 FROM public.shift_sessions WHERE device_id=d AND employee_id=b AND status='OPEN'),'Cashier did not switch';
 -- Simulate an original First Shift clock-in before overtime; never recalculate at clock-out.
 UPDATE public.staff_attendance SET clocked_in_at=clock_timestamp()-interval '13 hours',shift_type='FIRST',shift_id='2000-01-01-first',business_date='2000-01-01' WHERE id=original_id;
 closed:=public.rnl_staff_clock(a,'1234',d,'clock_out',false,original_id);
 ASSERT closed->'attendance'->>'shift_type'='FIRST' AND closed->'attendance'->>'business_date'='2000-01-01','Clock-out changed original shift';
 ASSERT EXISTS(SELECT 1 FROM public.shift_sessions WHERE device_id=d AND employee_id=b AND status='OPEN'),'Clocking out another staff closed active cashier';
 response:=public.rnl_staff_clock(a,'1234',d,'clock_out',false,original_id);
 ASSERT response->'attendance'->>'clocked_out_at'=closed->'attendance'->>'clocked_out_at','Clock-out retry changed timestamp';
 reopened:=public.rnl_staff_clock(a,'1234',d,'clock_in',false,NULL);
 PERFORM public.rnl_staff_clock(a,'1234',d,'clock_out',false,original_id);
 ASSERT EXISTS(SELECT 1 FROM public.staff_attendance WHERE id=(reopened->'attendance'->>'id')::uuid AND clocked_out_at IS NULL),'Stale clock-out closed newer attendance';
 PERFORM public.rnl_staff_clock(b,'5678',d,'clock_out',false,(second->'attendance'->>'id')::uuid);
 ASSERT NOT EXISTS(SELECT 1 FROM public.shift_sessions WHERE device_id=d AND status='OPEN'),'Active cashier did not close';
 ASSERT NOT EXISTS(SELECT 1 FROM public.shift_sessions WHERE device_id=d AND clocked_out_at<clocked_in_at),'Cashier timestamps inverted';
 ASSERT NOT has_table_privilege('anon','public.staff_attendance','SELECT'),'Anonymous attendance data exposed';
 PERFORM public.reset_rnl_operational_data();
 ASSERT NOT EXISTS(SELECT 1 FROM public.staff_attendance),'Reset left attendance open';
 RAISE EXCEPTION 'RNL_ATTENDANCE_PASS: 14 assertions; all fixture writes rolled back';
END $test$;
