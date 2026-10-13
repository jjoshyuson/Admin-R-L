-- The POS directory exposes only the fields needed to select a staff member, never PINs or wages.
CREATE FUNCTION public.rnl_pos_staff_directory() RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path='' STABLE AS $directory$
 SELECT jsonb_build_object('employees',coalesce(jsonb_agg(jsonb_build_object(
  'id',coalesce(e.item->>'id','employee-'||(e.idx-1)::text),
  'name',trim(e.item->>'name'),
  'isActive',coalesce(e.item->>'isActive',e.item->>'is_active','true')<>'false',
  'isCashier',coalesce(e.item->>'isCashier',e.item->>'is_cashier','true')<>'false'
 ) ORDER BY e.idx) FILTER (WHERE nullif(trim(e.item->>'name'),'') IS NOT NULL),'[]'::jsonb))
 FROM public.admin_settings s,LATERAL jsonb_array_elements(coalesce(s.value->'employees','[]'::jsonb)) WITH ORDINALITY e(item,idx)
 WHERE s.key='employees';
$directory$;
REVOKE ALL ON FUNCTION public.rnl_pos_staff_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rnl_pos_staff_directory() TO anon,authenticated;

DO $validation$
DECLARE definition text;
BEGIN
 definition:=pg_catalog.pg_get_functiondef('public.rnl_staff_clock(text,text,text,text,boolean,uuid)'::regprocedure);
 definition:=replace(definition,'IF p_action NOT IN','IF p_action IS NULL OR p_action NOT IN');
 definition:=replace(definition,
  $old$p_pin <> regexp_replace(coalesce(employee->>'pin',employee->>'loginPin',employee->>'login_pin',''),'[^0-9]','','g')$old$,
  $new$p_pin <> left(regexp_replace(coalesce(employee->>'pin',employee->>'loginPin',employee->>'login_pin',''),'[^0-9]','','g'),6)$new$);
 EXECUTE definition;
END $validation$;
