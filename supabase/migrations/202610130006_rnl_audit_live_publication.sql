DO $publication$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='shift_audits') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.shift_audits;
 END IF;
END $publication$;
