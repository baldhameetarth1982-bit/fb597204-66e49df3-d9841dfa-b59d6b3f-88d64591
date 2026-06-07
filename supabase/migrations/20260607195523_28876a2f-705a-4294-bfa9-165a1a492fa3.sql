CREATE OR REPLACE FUNCTION public.create_society_for_current_user(
  _name text,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _referral_code text DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := NULLIF(trim(_name), '');
  v_city text := NULLIF(trim(COALESCE(_city, '')), '');
  v_state text := NULLIF(trim(COALESCE(_state, '')), '');
  v_society_id uuid;
  v_invite_code text;
  v_referrer_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_name IS NULL OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Society name must be 1 to 120 characters';
  END IF;

  IF v_city IS NOT NULL AND length(v_city) > 60 THEN
    RAISE EXCEPTION 'City must be 60 characters or less';
  END IF;

  IF v_state IS NOT NULL AND length(v_state) > 60 THEN
    RAISE EXCEPTION 'State must be 60 characters or less';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = v_user_id
      AND ur.role = 'society_admin'::public.app_role
      AND ur.society_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You already manage a society';
  END IF;

  INSERT INTO public.societies (name, city, state, status)
  VALUES (v_name, v_city, v_state, 'active')
  RETURNING societies.id, societies.invite_code
  INTO v_society_id, v_invite_code;

  INSERT INTO public.user_roles (user_id, role, society_id)
  VALUES (v_user_id, 'society_admin'::public.app_role, v_society_id)
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles
  SET society_id = v_society_id,
      accepted_terms_at = COALESCE(accepted_terms_at, now()),
      updated_at = now()
  WHERE profiles.id = v_user_id;

  IF NULLIF(trim(COALESCE(_referral_code, '')), '') IS NOT NULL THEN
    SELECT public.find_referrer_by_code(_referral_code) INTO v_referrer_id;

    IF v_referrer_id IS NOT NULL AND v_referrer_id <> v_user_id THEN
      UPDATE public.profiles
      SET referred_by = COALESCE(referred_by, v_referrer_id),
          updated_at = now()
      WHERE profiles.id = v_user_id;
    END IF;
  END IF;

  SELECT referred_by INTO v_referrer_id
  FROM public.profiles
  WHERE profiles.id = v_user_id;

  IF v_referrer_id IS NOT NULL AND v_referrer_id <> v_user_id THEN
    INSERT INTO public.referral_earnings (referrer_id, referred_user_id, society_id, amount, rate, note)
    VALUES (v_referrer_id, v_user_id, v_society_id, 500, 0.10, 'Society signup commission');
  END IF;

  RETURN QUERY
  SELECT v_society_id, v_name, v_invite_code;
END;
$$;

REVOKE ALL ON FUNCTION public.create_society_for_current_user(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_society_for_current_user(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_society_for_current_user(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_society_for_current_user(text, text, text, text) TO service_role;

DROP TRIGGER IF EXISTS set_society_invite_code_trigger ON public.societies;
CREATE TRIGGER set_society_invite_code_trigger
BEFORE INSERT ON public.societies
FOR EACH ROW
EXECUTE FUNCTION public.set_society_invite_code();