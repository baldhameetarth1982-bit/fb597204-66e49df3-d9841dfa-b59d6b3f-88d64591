-- 1) Storage RLS for the branding bucket. Path convention: `<society_id>/<file>`.

CREATE POLICY "branding_read_members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'branding'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.society_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "branding_write_admin"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'branding'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('society_admin', 'block_admin')
        AND ur.society_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "branding_update_admin"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'branding'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('society_admin', 'block_admin')
        AND ur.society_id::text = (storage.foldername(name))[1]
    )
  )
);

CREATE POLICY "branding_delete_admin"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'branding'
  AND (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('society_admin', 'block_admin')
        AND ur.society_id::text = (storage.foldername(name))[1]
    )
  )
);

-- 2) Bulk hierarchy generator. Input example:
--    [{ "name": "A", "floors": 5, "flats_per_floor": 4, "start_floor": 0 }, ...]
CREATE OR REPLACE FUNCTION public.bulk_generate_society_hierarchy(
  _society_id uuid,
  _blocks jsonb
)
RETURNS TABLE (blocks_created int, flats_created int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b jsonb;
  block_id uuid;
  block_name text;
  floors int;
  fpf int;
  start_floor int;
  f int;
  fl int;
  flat_number text;
  bc int := 0;
  fc int := 0;
BEGIN
  -- Authorization: society_admin of this society, or super_admin
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('society_admin', 'block_admin')
        AND ur.society_id = _society_id
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden: not a society admin';
  END IF;

  FOR b IN SELECT * FROM jsonb_array_elements(COALESCE(_blocks, '[]'::jsonb))
  LOOP
    block_name := COALESCE(NULLIF(trim(b->>'name'), ''), 'Block');
    floors := GREATEST(1, COALESCE((b->>'floors')::int, 1));
    fpf := GREATEST(1, COALESCE((b->>'flats_per_floor')::int, 1));
    start_floor := COALESCE((b->>'start_floor')::int, 1);

    -- Get or create block
    SELECT id INTO block_id
    FROM public.blocks
    WHERE society_id = _society_id AND lower(name) = lower(block_name)
    LIMIT 1;

    IF block_id IS NULL THEN
      INSERT INTO public.blocks (society_id, name)
      VALUES (_society_id, block_name)
      RETURNING id INTO block_id;
      bc := bc + 1;
    END IF;

    -- Generate flats: FloorNumber x 100 + flat_index_on_floor.
    -- e.g. block A, floor 1, flat 1 -> "A-101". Floor 0 (ground) -> "A-001".
    FOR f IN 0..(floors - 1) LOOP
      FOR fl IN 1..fpf LOOP
        flat_number := block_name || '-' || lpad(((start_floor + f) * 100 + fl)::text, 3, '0');
        IF NOT EXISTS (
          SELECT 1 FROM public.flats
          WHERE society_id = _society_id AND number = flat_number
        ) THEN
          INSERT INTO public.flats (society_id, block_id, number, floor)
          VALUES (_society_id, block_id, flat_number, start_floor + f);
          fc := fc + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT bc, fc;
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_generate_society_hierarchy(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_generate_society_hierarchy(uuid, jsonb) TO authenticated;