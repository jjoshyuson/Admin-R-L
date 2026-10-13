CREATE OR REPLACE FUNCTION public.clock_in_rnl_session(p_employee_id text,p_employee_name text,p_device_id text,p_schedule jsonb)
RETURNS public.shift_sessions LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $clock$
DECLARE first_start time; second_start time; zone text; local_now timestamp; business_day date; kind text; shift_key text; session public.shift_sessions; stamp timestamptz:=now();
BEGIN
 IF nullif(trim(p_employee_id),'') IS NULL OR nullif(trim(p_employee_name),'') IS NULL OR nullif(trim(p_device_id),'') IS NULL THEN
   RAISE EXCEPTION 'Employee and device identity are required.';
 END IF;
 IF coalesce(p_schedule->>'firstShiftStart','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(p_schedule->>'secondShiftStart','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
   RAISE EXCEPTION 'Shift start times must use HH:MM.';
 END IF;
 first_start:=(p_schedule->>'firstShiftStart')::time;
 second_start:=(p_schedule->>'secondShiftStart')::time;
 zone:=p_schedule->>'timezone';
 IF first_start=second_start OR zone IS NULL OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone) THEN
   RAISE EXCEPTION 'Shift schedule or timezone is invalid.';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clock-in:'||p_device_id,0));
 SELECT * INTO session FROM public.shift_sessions WHERE device_id=p_device_id AND status='OPEN' FOR UPDATE;
 IF session.id IS NOT NULL AND session.employee_id=p_employee_id THEN RETURN session; END IF;
 local_now:=stamp AT TIME ZONE zone;
 business_day:=(local_now-first_start)::date;
 kind:=CASE WHEN (first_start<second_start AND local_now::time>=first_start AND local_now::time<second_start)
   OR (first_start>second_start AND (local_now::time>=first_start OR local_now::time<second_start)) THEN 'FIRST' ELSE 'SECOND' END;
 shift_key:=business_day::text||'-'||lower(kind);
 IF EXISTS(SELECT 1 FROM public.shift_audits WHERE shift_id=shift_key) THEN RAISE EXCEPTION 'This financial shift has already been audited.'; END IF;
 UPDATE public.shift_sessions SET status='CLOSED',clocked_out_at=stamp WHERE device_id=p_device_id AND status='OPEN';
 INSERT INTO public.shift_sessions(shift_id,business_date,shift_type,employee_id,employee_name,device_id,clocked_in_at,status,schedule_snapshot)
 VALUES(shift_key,business_day,kind,p_employee_id,p_employee_name,p_device_id,stamp,'OPEN',p_schedule) RETURNING * INTO session;
 RETURN session;
END $clock$;
