
-- Add tracking columns for KYC verification decisions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aadhaar_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS aadhaar_verified_by uuid,
  ADD COLUMN IF NOT EXISTS aadhaar_rejected_reason text,
  ADD COLUMN IF NOT EXISTS aadhaar_rejected_at timestamptz;

-- Trigger: lock down KYC fields. Residents can do the FIRST upload only.
-- All later changes (verify/reject/re-upload/reset) must flip the
-- 'app.allow_kyc_change' session flag inside a SECURITY DEFINER RPC,
-- or be performed by service_role / super_admin.
CREATE OR REPLACE FUNCTION public.prevent_kyc_self_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed text := current_setting('app.allow_kyc_change', true);
  v_session_role text := current_setting('role', true);
  v_is_privileged boolean := (v_allowed = 'on')
    OR COALESCE(v_session_role, '') = 'service_role'
    OR public.is_super_admin(auth.uid());
BEGIN
  -- aadhaar_verified can NEVER be changed by the owner directly
  IF NEW.aadhaar_verified IS DISTINCT FROM OLD.aadhaar_verified AND NOT v_is_privileged THEN
    RAISE EXCEPTION 'aadhaar_verified can only be changed by a society admin via verify_resident_kyc';
  END IF;

  -- Verification metadata locked the same way
  IF (NEW.aadhaar_verified_at IS DISTINCT FROM OLD.aadhaar_verified_at
      OR NEW.aadhaar_verified_by IS DISTINCT FROM OLD.aadhaar_verified_by
      OR NEW.aadhaar_rejected_reason IS DISTINCT FROM OLD.aadhaar_rejected_reason
      OR NEW.aadhaar_rejected_at IS DISTINCT FROM OLD.aadhaar_rejected_at)
     AND NOT v_is_privileged THEN
    RAISE EXCEPTION 'KYC review fields are admin-controlled';
  END IF;

  -- Aadhaar document fields: first upload is free; any later change requires the flag
  IF OLD.aadhaar_url IS NOT NULL AND NOT v_is_privileged THEN
    IF NEW.aadhaar_url IS DISTINCT FROM OLD.aadhaar_url
       OR NEW.aadhaar_last4 IS DISTINCT FROM OLD.aadhaar_last4
       OR NEW.aadhaar_uploaded_at IS DISTINCT FROM OLD.aadhaar_uploaded_at THEN
      RAISE EXCEPTION 'Re-upload Aadhaar through reupload_own_kyc';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_kyc_self_modification() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_kyc_self_modification ON public.profiles;
CREATE TRIGGER trg_prevent_kyc_self_modification
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_kyc_self_modification();

-- RPC: society admin approves or rejects a resident's KYC
CREATE OR REPLACE FUNCTION public.verify_resident_kyc(
  _user_id uuid,
  _approved boolean,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_society uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_id required'; END IF;

  SELECT society_id INTO v_society FROM public.profiles WHERE id = _user_id;
  IF v_society IS NULL THEN RAISE EXCEPTION 'Resident has no society'; END IF;

  IF NOT (public.is_society_admin_for(v_caller, v_society) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT _approved AND (_reason IS NULL OR length(trim(_reason)) = 0) THEN
    RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  PERFORM set_config('app.allow_kyc_change', 'on', true);
  IF _approved THEN
    UPDATE public.profiles
      SET aadhaar_verified = true,
          aadhaar_verified_at = now(),
          aadhaar_verified_by = v_caller,
          aadhaar_rejected_reason = NULL,
          aadhaar_rejected_at = NULL,
          updated_at = now()
    WHERE id = _user_id;
  ELSE
    UPDATE public.profiles
      SET aadhaar_verified = false,
          aadhaar_verified_at = NULL,
          aadhaar_verified_by = v_caller,
          aadhaar_rejected_reason = trim(_reason),
          aadhaar_rejected_at = now(),
          updated_at = now()
    WHERE id = _user_id;
  END IF;
  PERFORM set_config('app.allow_kyc_change', 'off', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_resident_kyc(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_resident_kyc(uuid, boolean, text) TO authenticated;

-- RPC: resident re-uploads their Aadhaar after initial submission/rejection
CREATE OR REPLACE FUNCTION public.reupload_own_kyc(
  _aadhaar_url text,
  _aadhaar_last4 text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _aadhaar_url IS NULL OR length(_aadhaar_url) = 0 THEN
    RAISE EXCEPTION 'Document path required';
  END IF;
  IF _aadhaar_last4 IS NULL OR _aadhaar_last4 !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Last 4 digits must be numeric';
  END IF;

  PERFORM set_config('app.allow_kyc_change', 'on', true);
  UPDATE public.profiles
    SET aadhaar_url = _aadhaar_url,
        aadhaar_last4 = _aadhaar_last4,
        aadhaar_uploaded_at = now(),
        aadhaar_verified = false,
        aadhaar_verified_at = NULL,
        aadhaar_rejected_reason = NULL,
        aadhaar_rejected_at = NULL,
        updated_at = now()
  WHERE id = v_user;
  PERFORM set_config('app.allow_kyc_change', 'off', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reupload_own_kyc(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reupload_own_kyc(text, text) TO authenticated;

-- RPC: resident clears their own KYC (used by account deletion soft-wipe)
CREATE OR REPLACE FUNCTION public.reset_own_kyc()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM set_config('app.allow_kyc_change', 'on', true);
  UPDATE public.profiles
    SET aadhaar_url = NULL,
        aadhaar_last4 = NULL,
        aadhaar_uploaded_at = NULL,
        aadhaar_verified = false,
        aadhaar_verified_at = NULL,
        aadhaar_verified_by = NULL,
        aadhaar_rejected_reason = NULL,
        aadhaar_rejected_at = NULL,
        updated_at = now()
  WHERE id = v_user;
  PERFORM set_config('app.allow_kyc_change', 'off', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reset_own_kyc() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_own_kyc() TO authenticated;
