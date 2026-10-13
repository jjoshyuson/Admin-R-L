-- Attendance is independent of the tablet cashier's financial session.
CREATE TABLE public.staff_attendance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id text NOT NULL, employee_name text NOT NULL,
 business_date date NOT NULL, shift_type text NOT NULL CHECK (shift_type IN ('FIRST','SECOND')),
 shift_id text NOT NULL, device_id text NOT NULL, clocked_in_at timestamptz NOT NULL DEFAULT now(),
 clocked_out_at timestamptz, schedule_snapshot jsonb NOT NULL,
 CHECK (clocked_out_at IS NULL OR clocked_out_at >= clocked_in_at)
);
CREATE UNIQUE INDEX staff_attendance_one_open ON public.staff_attendance(employee_id) WHERE clocked_out_at IS NULL;
CREATE INDEX staff_attendance_employee_time ON public.staff_attendance(employee_id,clocked_in_at DESC);
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_attendance FROM PUBLIC,anon,authenticated;
-- Preserve the actual start time of currently working cashiers during migration.
INSERT INTO public.staff_attendance(employee_id,employee_name,business_date,shift_type,shift_id,device_id,clocked_in_at,schedule_snapshot)
 SELECT DISTINCT ON (employee_id) employee_id,employee_name,business_date,shift_type,shift_id,device_id,clocked_in_at,schedule_snapshot
 FROM public.shift_sessions WHERE status='OPEN' ORDER BY employee_id,clocked_in_at DESC;

CREATE FUNCTION public.rnl_staff_clock(p_employee_id text,p_pin text,p_device_id text,p_action text,p_make_cashier boolean DEFAULT false,p_attendance_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $staff$
DECLARE employee jsonb; schedule jsonb; attendance public.staff_attendance; session public.shift_sessions;
 stamp timestamptz; local_now timestamp; first_start time; second_start time; zone text; kind text; day date; device text; shift_key text;
BEGIN
 IF p_action NOT IN ('status','clock_in','clock_out','use_cashier') OR nullif(trim(p_device_id),'') IS NULL THEN RAISE EXCEPTION 'Invalid staff clock request.'; END IF;
 SELECT e.item INTO employee FROM public.admin_settings s,
 LATERAL jsonb_array_elements(coalesce(s.value->'employees','[]'::jsonb)) WITH ORDINALITY e(item,idx)
 WHERE s.key='employees' AND coalesce(e.item->>'id','employee-'||(e.idx-1)::text)=p_employee_id LIMIT 1;
 IF employee IS NULL OR coalesce(employee->>'isActive',employee->>'is_active','true')='false'
 OR p_pin !~ '^[0-9]{4,6}$' OR p_pin IS NULL
 OR p_pin <> regexp_replace(coalesce(employee->>'pin',employee->>'loginPin',employee->>'login_pin',''),'[^0-9]','','g') THEN
  RAISE EXCEPTION 'Incorrect PIN or inactive staff member.';
 END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('attendance:'||p_employee_id,0));
 stamp:=clock_timestamp();
 SELECT * INTO attendance FROM public.staff_attendance WHERE employee_id=p_employee_id AND clocked_out_at IS NULL FOR UPDATE;
 IF p_action='clock_out' THEN
  IF p_attendance_id IS NULL THEN RAISE EXCEPTION 'Verify attendance before clocking out.'; END IF;
  SELECT * INTO attendance FROM public.staff_attendance WHERE id=p_attendance_id AND employee_id=p_employee_id FOR UPDATE;
  IF attendance.id IS NULL THEN RAISE EXCEPTION 'Attendance record changed. Verify your PIN again.'; END IF;
  IF attendance.clocked_out_at IS NULL THEN
   FOR device IN SELECT DISTINCT device_id FROM public.shift_sessions WHERE employee_id=p_employee_id AND status='OPEN' ORDER BY device_id LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clock-in:'||device,0));
   END LOOP;
   FOR shift_key IN SELECT DISTINCT shift_id FROM public.shift_sessions WHERE employee_id=p_employee_id AND status='OPEN' ORDER BY shift_id LOOP
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(shift_key,0));
   END LOOP;
   stamp:=clock_timestamp();
   UPDATE public.shift_sessions SET status='CLOSED',clocked_out_at=stamp WHERE employee_id=p_employee_id AND status='OPEN';
   UPDATE public.staff_attendance SET clocked_out_at=stamp WHERE id=attendance.id RETURNING * INTO attendance;
  END IF;
 ELSIF p_action='clock_in' THEN
  IF attendance.id IS NULL THEN
   SELECT jsonb_build_object('firstShiftStart','08:00','secondShiftStart','20:00','timezone','Asia/Manila') || coalesce(value,'{}'::jsonb)
    INTO schedule FROM public.admin_settings WHERE key='turnover_settings';
   schedule:=coalesce(schedule,'{"firstShiftStart":"08:00","secondShiftStart":"20:00","timezone":"Asia/Manila"}'::jsonb);
   IF schedule->>'firstShiftStart' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR schedule->>'secondShiftStart' !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'Invalid shift schedule.'; END IF;
   first_start:=(schedule->>'firstShiftStart')::time;second_start:=(schedule->>'secondShiftStart')::time;zone:=schedule->>'timezone';
   IF first_start=second_start OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=zone) THEN RAISE EXCEPTION 'Invalid shift schedule.'; END IF;
   local_now:=stamp AT TIME ZONE zone;day:=(local_now-first_start)::date;
   kind:=CASE WHEN (first_start<second_start AND local_now::time>=first_start AND local_now::time<second_start) OR (first_start>second_start AND (local_now::time>=first_start OR local_now::time<second_start)) THEN 'FIRST' ELSE 'SECOND' END;
   INSERT INTO public.staff_attendance(employee_id,employee_name,business_date,shift_type,shift_id,device_id,clocked_in_at,schedule_snapshot)
    VALUES(p_employee_id,trim(employee->>'name'),day,kind,day::text||'-'||lower(kind),p_device_id,stamp,schedule) RETURNING * INTO attendance;
  END IF;
 END IF;
 IF p_action='use_cashier' OR (p_action='clock_in' AND p_make_cashier) THEN
  IF attendance.id IS NULL OR attendance.clocked_out_at IS NOT NULL THEN RAISE EXCEPTION 'Clock in before becoming the active cashier.'; END IF;
  IF coalesce(employee->>'isCashier',employee->>'is_cashier','true')='false' THEN RAISE EXCEPTION 'This staff member is not a cashier.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('clock-in:'||p_device_id,0));
  SELECT * INTO session FROM public.shift_sessions WHERE device_id=p_device_id AND status='OPEN' FOR UPDATE;
  IF session.id IS NULL OR session.employee_id<>p_employee_id THEN
   PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(attendance.shift_id,0));
   IF EXISTS(SELECT 1 FROM public.shift_audits WHERE shift_id=attendance.shift_id) THEN RAISE EXCEPTION 'This financial shift has already been audited.'; END IF;
   stamp:=clock_timestamp();
   UPDATE public.shift_sessions SET status='CLOSED',clocked_out_at=stamp WHERE device_id=p_device_id AND status='OPEN';
   INSERT INTO public.shift_sessions(shift_id,business_date,shift_type,employee_id,employee_name,device_id,clocked_in_at,status,schedule_snapshot)
    VALUES(attendance.shift_id,attendance.business_date,attendance.shift_type,p_employee_id,attendance.employee_name,p_device_id,stamp,'OPEN',attendance.schedule_snapshot) RETURNING * INTO session;
  END IF;
 END IF;
 RETURN jsonb_build_object('attendance',CASE WHEN attendance.id IS NULL THEN NULL ELSE to_jsonb(attendance) END);
END $staff$;
REVOKE ALL ON FUNCTION public.rnl_staff_clock(text,text,text,text,boolean,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rnl_staff_clock(text,text,text,text,boolean,uuid) TO anon,authenticated;

-- The existing owner/invoker reset must clear attendance in the same transaction.
DO $reset$
DECLARE definition text;
BEGIN
 definition:=pg_catalog.pg_get_functiondef('public.reset_rnl_operational_data()'::regprocedure);
 IF position('''staff_attendance''' in definition)=0 THEN
  EXECUTE replace(definition,'''shift_sessions''','''staff_attendance'',''shift_sessions''');
 END IF;
END $reset$;
