
-- =========================================
-- Phase 2 — Auth, Onboarding & Pricing
-- =========================================

-- ---- pricing_settings (singleton) ----
CREATE TABLE IF NOT EXISTS public.pricing_settings (
  id smallint PRIMARY KEY DEFAULT 1,
  enterprise_threshold_units integer NOT NULL DEFAULT 500,
  trial_days integer NOT NULL DEFAULT 14,
  custom_module_prices jsonb NOT NULL DEFAULT '{}'::jsonb,
  enterprise_contact_email text,
  enterprise_contact_phone text,
  active_gateway text NOT NULL DEFAULT 'payu',
  promo_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  taxes jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT pricing_settings_singleton CHECK (id = 1)
);

INSERT INTO public.pricing_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.pricing_settings TO authenticated;
GRANT SELECT ON public.pricing_settings TO anon;
GRANT ALL ON public.pricing_settings TO service_role;

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_settings_read_all" ON public.pricing_settings;
CREATE POLICY "pricing_settings_read_all" ON public.pricing_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pricing_settings_super_admin_write" ON public.pricing_settings;
CREATE POLICY "pricing_settings_super_admin_write" ON public.pricing_settings
  FOR UPDATE USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

-- ---- societies additions ----
ALTER TABLE public.societies
  ADD COLUMN IF NOT EXISTS trial_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_units integer,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS full_address text,
  ADD COLUMN IF NOT EXISTS pincode text,
  ADD COLUMN IF NOT EXISTS invite_code_enabled boolean NOT NULL DEFAULT true;

-- ---- join_requests additions ----
ALTER TABLE public.join_requests
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS flat_number_input text,
  ADD COLUMN IF NOT EXISTS mobile text,
  ADD COLUMN IF NOT EXISTS owner_or_tenant text;

ALTER TABLE public.join_requests ALTER COLUMN flat_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS join_requests_unique_pending
  ON public.join_requests (user_id, society_id)
  WHERE status = 'pending';

-- ---- Remove resident-facing plans ----
DELETE FROM public.plans WHERE id IN ('resident', 'ad_free');

-- ---- Pricing Engine RPC ----
CREATE OR REPLACE FUNCTION public.get_applicable_plans(_total_units integer DEFAULT NULL)
RETURNS TABLE(
  tier text,
  plan_id text,
  plan_name text,
  price_monthly_inr integer,
  trial_days integer,
  features jsonb,
  is_recommended boolean,
  enterprise boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_threshold integer;
BEGIN
  SELECT enterprise_threshold_units INTO v_threshold FROM public.pricing_settings WHERE id = 1;
  IF _total_units IS NOT NULL AND _total_units > COALESCE(v_threshold, 500) THEN
    RETURN QUERY SELECT 'enterprise'::text, 'enterprise'::text, 'Enterprise'::text,
      NULL::integer, 0, '{}'::jsonb, true, true;
    RETURN;
  END IF;
  RETURN QUERY
    SELECT 'standard'::text, p.id, p.name, p.price_monthly_inr, p.trial_days, p.features,
           COALESCE(p.is_recommended,false), false
    FROM public.plans p
    WHERE p.id NOT IN ('resident','ad_free')
    ORDER BY p.sort_order;
END $$;

GRANT EXECUTE ON FUNCTION public.get_applicable_plans(integer) TO anon, authenticated;

-- ---- Society Access Status (server-authoritative) ----
CREATE OR REPLACE FUNCTION public.get_society_access_status(_society_id uuid)
RETURNS TABLE(
  status text,
  plan_id text,
  trial_ends_at timestamptz,
  plan_expires_at timestamptz,
  trial_consumed_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  s RECORD;
BEGIN
  IF _society_id IS NULL OR auth.uid() IS NULL THEN
    RETURN QUERY SELECT 'none'::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  IF NOT public.authorize_membership(auth.uid(), _society_id) AND NOT public.is_super_admin(auth.uid()) THEN
    RETURN QUERY SELECT 'forbidden'::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;
  SELECT plan_id, plan_status, trial_ends_at, plan_expires_at, trial_consumed_at
    INTO s FROM public.societies WHERE id = _society_id;
  IF s IS NULL THEN
    RETURN QUERY SELECT 'none'::text, NULL::text, NULL::timestamptz, NULL::timestamptz, NULL::timestamptz;
    RETURN;
  END IF;

  IF s.plan_status = 'trialing' AND s.trial_ends_at IS NOT NULL AND s.trial_ends_at > now() THEN
    RETURN QUERY SELECT 'trial'::text, s.plan_id, s.trial_ends_at, s.plan_expires_at, s.trial_consumed_at;
  ELSIF s.plan_status = 'trialing' THEN
    RETURN QUERY SELECT 'trial_expired'::text, s.plan_id, s.trial_ends_at, s.plan_expires_at, s.trial_consumed_at;
  ELSIF s.plan_status = 'active' AND (s.plan_expires_at IS NULL OR s.plan_expires_at > now()) THEN
    RETURN QUERY SELECT 'active'::text, s.plan_id, s.trial_ends_at, s.plan_expires_at, s.trial_consumed_at;
  ELSIF s.plan_status = 'active' THEN
    RETURN QUERY SELECT 'past_due'::text, s.plan_id, s.trial_ends_at, s.plan_expires_at, s.trial_consumed_at;
  ELSE
    RETURN QUERY SELECT COALESCE(s.plan_status,'none')::text, s.plan_id, s.trial_ends_at, s.plan_expires_at, s.trial_consumed_at;
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.get_society_access_status(uuid) TO authenticated;

-- ---- Start trial (one-time, server-controlled) ----
CREATE OR REPLACE FUNCTION public.start_society_trial(_society_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_days integer;
  v_consumed timestamptz;
  v_ends timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(auth.uid(), _society_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT trial_days INTO v_days FROM public.pricing_settings WHERE id = 1;
  v_days := COALESCE(v_days, 14);

  SELECT trial_consumed_at INTO v_consumed FROM public.societies WHERE id = _society_id FOR UPDATE;
  IF v_consumed IS NOT NULL THEN
    RAISE EXCEPTION 'Trial already used for this society';
  END IF;

  v_ends := now() + make_interval(days => v_days);
  UPDATE public.societies
    SET plan_id = 'trial',
        plan_status = 'trialing',
        trial_ends_at = v_ends,
        trial_consumed_at = now(),
        plan_selected_at = now(),
        status = 'active',
        updated_at = now()
  WHERE id = _society_id;
  RETURN v_ends;
END $$;

GRANT EXECUTE ON FUNCTION public.start_society_trial(uuid) TO authenticated;

-- ---- Invite code management ----
CREATE OR REPLACE FUNCTION public.regenerate_society_invite_code(_society_id uuid)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_code text;
  attempts int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(auth.uid(), _society_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  LOOP
    new_code := public.generate_society_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.societies WHERE invite_code = new_code);
    attempts := attempts + 1;
    IF attempts > 10 THEN RAISE EXCEPTION 'Could not allocate invite code'; END IF;
  END LOOP;
  UPDATE public.societies SET invite_code = new_code, updated_at = now() WHERE id = _society_id;
  RETURN new_code;
END $$;

GRANT EXECUTE ON FUNCTION public.regenerate_society_invite_code(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_society_invite_code_custom(_society_id uuid, _code text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_code text := upper(regexp_replace(COALESCE(_code,''),'[^A-Z0-9]','','g'));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(auth.uid(), _society_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF length(v_code) < 4 OR length(v_code) > 12 THEN
    RAISE EXCEPTION 'Code must be 4-12 alphanumeric characters';
  END IF;
  IF EXISTS (SELECT 1 FROM public.societies WHERE invite_code = v_code AND id <> _society_id) THEN
    RAISE EXCEPTION 'Code already in use';
  END IF;
  UPDATE public.societies SET invite_code = v_code, updated_at = now() WHERE id = _society_id;
  RETURN v_code;
END $$;

GRANT EXECUTE ON FUNCTION public.set_society_invite_code_custom(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_society_invite_code_enabled(_society_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(auth.uid(), _society_id) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.societies SET invite_code_enabled = COALESCE(_enabled, true), updated_at = now() WHERE id = _society_id;
  RETURN _enabled;
END $$;

GRANT EXECUTE ON FUNCTION public.set_society_invite_code_enabled(uuid, boolean) TO authenticated;

-- ---- Submit Join Request (with code verify) ----
CREATE OR REPLACE FUNCTION public.submit_join_request(
  _society_id uuid,
  _code text,
  _full_name text,
  _flat_number text,
  _mobile text,
  _owner_or_tenant text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code_ok boolean;
  v_enabled boolean;
  v_current_society uuid;
  v_req_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _society_id IS NULL THEN RAISE EXCEPTION 'society_id required'; END IF;
  IF NULLIF(trim(COALESCE(_full_name,'')),'') IS NULL THEN RAISE EXCEPTION 'Full name required'; END IF;
  IF NULLIF(trim(COALESCE(_flat_number,'')),'') IS NULL THEN RAISE EXCEPTION 'Flat number required'; END IF;
  IF _owner_or_tenant NOT IN ('owner','tenant') THEN RAISE EXCEPTION 'Choose owner or tenant'; END IF;

  SELECT (upper(invite_code) = upper(trim(COALESCE(_code,'')))), COALESCE(invite_code_enabled,true)
    INTO v_code_ok, v_enabled
    FROM public.societies WHERE id = _society_id;
  IF NOT v_enabled THEN RAISE EXCEPTION 'This society is not accepting code-based joins'; END IF;
  IF NOT COALESCE(v_code_ok,false) THEN RAISE EXCEPTION 'Invalid society code'; END IF;

  SELECT society_id INTO v_current_society FROM public.profiles WHERE id = v_user;
  IF v_current_society IS NOT NULL AND v_current_society <> _society_id THEN
    RAISE EXCEPTION 'You already belong to a society';
  END IF;

  INSERT INTO public.join_requests
    (user_id, society_id, full_name, flat_number_input, mobile, owner_or_tenant, relationship, status)
  VALUES
    (v_user, _society_id, trim(_full_name), trim(_flat_number), NULLIF(trim(_mobile),''),
     _owner_or_tenant, _owner_or_tenant, 'pending')
  ON CONFLICT (user_id, society_id) WHERE status='pending'
    DO UPDATE SET
      full_name = EXCLUDED.full_name,
      flat_number_input = EXCLUDED.flat_number_input,
      mobile = EXCLUDED.mobile,
      owner_or_tenant = EXCLUDED.owner_or_tenant,
      relationship = EXCLUDED.relationship,
      updated_at = now()
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END $$;

GRANT EXECUTE ON FUNCTION public.submit_join_request(uuid, text, text, text, text, text) TO authenticated;

-- ---- Bulk approve / reject ----
CREATE OR REPLACE FUNCTION public.bulk_approve_join_requests(_society_id uuid, _request_ids uuid[])
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count int := 0;
  r RECORD;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(v_caller, _society_id) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN
    SELECT id FROM public.join_requests
    WHERE society_id = _society_id
      AND status = 'pending'
      AND (_request_ids IS NULL OR id = ANY(_request_ids))
  LOOP
    BEGIN
      PERFORM public.respond_join_request(r.id, true, NULL);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Skip individual failures (e.g. already-resolved, flat mismatch) but continue.
      CONTINUE;
    END;
  END LOOP;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.bulk_approve_join_requests(uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.bulk_reject_join_requests(_society_id uuid, _request_ids uuid[], _reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_count int := 0;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(v_caller, _society_id) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.join_requests
    SET status='rejected', reviewer_id=v_caller, reviewed_at=now(),
        reason=NULLIF(trim(COALESCE(_reason,'')),''),
        updated_at=now()
    WHERE society_id = _society_id AND status='pending' AND id = ANY(_request_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

GRANT EXECUTE ON FUNCTION public.bulk_reject_join_requests(uuid, uuid[], text) TO authenticated;

-- ---- Search societies (with logo) ----
CREATE OR REPLACE FUNCTION public.search_societies_public(_q text)
RETURNS TABLE(id uuid, name text, city text, state text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT s.id, s.name, s.city, s.state, s.logo_url
  FROM public.societies s
  WHERE s.status = 'active'
    AND (
      _q IS NULL OR length(trim(_q)) = 0
      OR s.name ILIKE '%' || trim(_q) || '%'
      OR s.city ILIKE '%' || trim(_q) || '%'
    )
  ORDER BY s.name ASC
  LIMIT 25;
$$;

GRANT EXECUTE ON FUNCTION public.search_societies_public(text) TO anon, authenticated;

-- ---- Create Society (extended with new fields) ----
CREATE OR REPLACE FUNCTION public.create_society_full(
  _name text,
  _registration_number text,
  _full_address text,
  _city text,
  _state text,
  _pincode text,
  _logo_url text,
  _total_units integer,
  _referral_code text DEFAULT NULL
)
RETURNS TABLE(id uuid, name text, invite_code text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_name text := NULLIF(trim(_name),'');
  v_society_id uuid;
  v_invite_code text;
  v_referrer uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_name IS NULL OR length(v_name) > 120 THEN RAISE EXCEPTION 'Society name required (max 120)'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user AND ur.role = 'society_admin'::public.app_role AND ur.society_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You already manage a society';
  END IF;

  INSERT INTO public.societies (
    name, registration_number, full_address, city, state, pincode, logo_url, total_units, status
  ) VALUES (
    v_name,
    NULLIF(trim(COALESCE(_registration_number,'')),''),
    NULLIF(trim(COALESCE(_full_address,'')),''),
    NULLIF(trim(COALESCE(_city,'')),''),
    NULLIF(trim(COALESCE(_state,'')),''),
    NULLIF(trim(COALESCE(_pincode,'')),''),
    NULLIF(trim(COALESCE(_logo_url,'')),''),
    _total_units,
    'active'
  )
  RETURNING societies.id, societies.invite_code INTO v_society_id, v_invite_code;

  INSERT INTO public.user_roles (user_id, role, society_id)
  VALUES (v_user, 'society_admin'::public.app_role, v_society_id)
  ON CONFLICT DO NOTHING;

  PERFORM set_config('app.allow_society_change', 'on', true);
  UPDATE public.profiles
    SET society_id = v_society_id,
        accepted_terms_at = COALESCE(accepted_terms_at, now()),
        updated_at = now()
  WHERE id = v_user;
  PERFORM set_config('app.allow_society_change', 'off', true);

  IF NULLIF(trim(COALESCE(_referral_code,'')),'') IS NOT NULL THEN
    SELECT public.find_referrer_by_code(_referral_code) INTO v_referrer;
    IF v_referrer IS NOT NULL AND v_referrer <> v_user THEN
      UPDATE public.profiles SET referred_by = COALESCE(referred_by, v_referrer), updated_at = now()
      WHERE id = v_user;
    END IF;
  END IF;

  RETURN QUERY SELECT v_society_id, v_name, v_invite_code;
END $$;

GRANT EXECUTE ON FUNCTION public.create_society_full(text, text, text, text, text, text, text, integer, text) TO authenticated;

-- ---- List pending join requests with resident details (for admin) ----
CREATE OR REPLACE FUNCTION public.list_pending_join_requests(_society_id uuid)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  full_name text,
  mobile text,
  flat_number_input text,
  owner_or_tenant text,
  created_at timestamptz,
  requester_email text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jr.id, jr.user_id,
         COALESCE(jr.full_name, p.full_name),
         COALESCE(jr.mobile, p.phone),
         jr.flat_number_input,
         COALESCE(jr.owner_or_tenant, jr.relationship),
         jr.created_at,
         p.email
  FROM public.join_requests jr
  LEFT JOIN public.profiles p ON p.id = jr.user_id
  WHERE jr.society_id = _society_id
    AND jr.status = 'pending'
    AND (public.is_society_admin_for(auth.uid(), _society_id) OR public.is_super_admin(auth.uid()))
  ORDER BY jr.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_join_requests(uuid) TO authenticated;
