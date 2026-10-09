-- Remove the unused table from the original Spanish schema.
-- This script stops without deleting anything if the table contains rows.
DO $$
BEGIN
  IF to_regclass('public.solicitudes') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.solicitudes LIMIT 1) THEN
      RAISE EXCEPTION 'public.solicitudes contains data; migrate those rows before cleanup';
    END IF;

    DROP TABLE public.solicitudes;
  END IF;
END;
$$;
