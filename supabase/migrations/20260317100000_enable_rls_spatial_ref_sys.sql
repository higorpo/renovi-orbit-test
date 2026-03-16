-- RLS on PostGIS catalog table spatial_ref_sys (read-only reference data).
-- Supabase recommends RLS on all tables; this removes the "no policy" warning.
-- The table is created by the PostGIS extension; we only allow SELECT.
-- If the current role is not owner of spatial_ref_sys (common in local PostGIS), we skip to avoid migration failure.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spatial_ref_sys'
  ) THEN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow read spatial_ref_sys"
      ON public.spatial_ref_sys
      FOR SELECT
      USING (true);
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    NULL; -- Not owner of spatial_ref_sys (e.g. extension-owned); skip RLS.
END
$$;
