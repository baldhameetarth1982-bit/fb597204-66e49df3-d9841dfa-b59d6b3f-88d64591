
ALTER TABLE public.societies
  ADD COLUMN IF NOT EXISTS legal_business_name TEXT,
  ADD COLUMN IF NOT EXISTS business_address TEXT,
  ADD COLUMN IF NOT EXISTS business_city TEXT,
  ADD COLUMN IF NOT EXISTS business_state TEXT,
  ADD COLUMN IF NOT EXISTS business_pincode TEXT,
  ADD COLUMN IF NOT EXISTS business_gstin TEXT,
  ADD COLUMN IF NOT EXISTS business_pan TEXT;

CREATE OR REPLACE FUNCTION public.update_society_business_profile(
  _society_id uuid,
  _legal_business_name text,
  _business_address text,
  _business_city text,
  _business_state text,
  _business_pincode text,
  _business_gstin text,
  _business_pan text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(v_caller, _society_id) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _business_pan IS NOT NULL AND _business_pan <> '' AND _business_pan !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' THEN
    RAISE EXCEPTION 'PAN must be in format ABCDE1234F';
  END IF;
  IF _business_pincode IS NOT NULL AND _business_pincode <> '' AND _business_pincode !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'Pincode must be 6 digits';
  END IF;
  UPDATE public.societies
  SET legal_business_name = NULLIF(trim(_legal_business_name), ''),
      business_address = NULLIF(trim(_business_address), ''),
      business_city = NULLIF(trim(_business_city), ''),
      business_state = NULLIF(trim(_business_state), ''),
      business_pincode = NULLIF(trim(_business_pincode), ''),
      business_gstin = NULLIF(trim(upper(_business_gstin)), ''),
      business_pan = NULLIF(trim(upper(_business_pan)), ''),
      updated_at = now()
  WHERE id = _society_id;
END;
$$;

REVOKE ALL ON FUNCTION public.update_society_business_profile(uuid,text,text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_society_business_profile(uuid,text,text,text,text,text,text,text) TO authenticated;
