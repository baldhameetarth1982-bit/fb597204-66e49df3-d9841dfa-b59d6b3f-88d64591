
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aadhaar_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aadhaar_last4 text,
  ADD COLUMN IF NOT EXISTS aadhaar_verified_at timestamptz;

CREATE OR REPLACE FUNCTION public.mark_aadhaar_verified(_last4 text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _last4 IS NULL OR _last4 !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid last4';
  END IF;
  UPDATE public.profiles
     SET aadhaar_verified = true,
         aadhaar_last4 = _last4,
         aadhaar_verified_at = now()
   WHERE id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_aadhaar_verified(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_aadhaar_verified(text) TO authenticated;

-- Storage RLS for kyc-admin (bucket itself created via storage tool)
CREATE POLICY "kyc-admin: users manage own folder - select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-admin' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kyc-admin: users manage own folder - insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-admin' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "kyc-admin: users manage own folder - delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kyc-admin' AND (storage.foldername(name))[1] = auth.uid()::text);
