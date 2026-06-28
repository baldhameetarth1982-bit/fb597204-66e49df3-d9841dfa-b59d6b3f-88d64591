CREATE OR REPLACE FUNCTION public.is_active_society_plan(_society_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.societies s
    WHERE s.id = _society_id
      AND (
        (
          s.plan_status = 'active'
          AND COALESCE(NULLIF(s.plan_id, ''), '') <> ''
          AND COALESCE(s.plan_expires_at, now() + interval '100 years') > now()
        )
        OR (
          s.plan_status = 'trialing'
          AND s.trial_ends_at IS NOT NULL
          AND s.trial_ends_at > now()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_society_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_society_plan(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.society_has_access(_society_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR _society_id IS NULL THEN
    RETURN false;
  END IF;

  IF public.is_super_admin(v_user) THEN
    RETURN true;
  END IF;

  IF NOT public.authorize_membership(v_user, _society_id) THEN
    RETURN false;
  END IF;

  RETURN public.is_active_society_plan(_society_id);
END;
$$;

REVOKE ALL ON FUNCTION public.society_has_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.society_has_access(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_current_auth_context()
RETURNS TABLE(profile jsonb, roles jsonb, primary_role text, society_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_society uuid;
  v_primary text;
  v_roles jsonb;
  v_profile jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role', ur.role,
        'society_id', ur.society_id,
        'block_id', ur.block_id
      ) ORDER BY ur.created_at
    ),
    '[]'::jsonb
  )
  INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = v_user;

  SELECT COALESCE(
    p.society_id,
    (
      SELECT ur.society_id
      FROM public.user_roles ur
      WHERE ur.user_id = v_user
        AND ur.society_id IS NOT NULL
      ORDER BY CASE ur.role
        WHEN 'society_admin'::public.app_role THEN 1
        WHEN 'resident'::public.app_role THEN 2
        WHEN 'block_admin'::public.app_role THEN 3
        WHEN 'security'::public.app_role THEN 4
        ELSE 9
      END, ur.created_at
      LIMIT 1
    )
  )
  INTO v_society
  FROM public.profiles p
  WHERE p.id = v_user;

  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'super_admin'::public.app_role) THEN 'super_admin'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'society_admin'::public.app_role) THEN 'society_admin'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'resident'::public.app_role) THEN 'resident'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'block_admin'::public.app_role) THEN 'block_admin'
    WHEN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user AND role = 'security'::public.app_role) THEN 'security'
    ELSE NULL
  END INTO v_primary;

  SELECT to_jsonb(p) || jsonb_build_object('society_id', v_society)
  INTO v_profile
  FROM public.profiles p
  WHERE p.id = v_user;

  RETURN QUERY SELECT v_profile, v_roles, v_primary, v_society;
END;
$$;

REVOKE ALL ON FUNCTION public.get_current_auth_context() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_auth_context() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_platform_summary()
RETURNS TABLE(
  total_users bigint,
  total_societies bigint,
  active_societies bigint,
  trialing_societies bigint,
  successful_payment_total numeric,
  unpaid_bill_total numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.profiles)::bigint,
    (SELECT count(*) FROM public.societies)::bigint,
    (SELECT count(*) FROM public.societies WHERE plan_status = 'active')::bigint,
    (SELECT count(*) FROM public.societies WHERE plan_status = 'trialing' AND trial_ends_at > now())::bigint,
    COALESCE((SELECT sum(amount) FROM public.payments WHERE status = 'success'), 0)::numeric,
    COALESCE((SELECT sum(amount) FROM public.bills WHERE status IN ('unpaid','overdue')), 0)::numeric;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_platform_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_platform_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_societies()
RETURNS TABLE(
  id uuid,
  name text,
  plan_id text,
  plan_status text,
  plan_expires_at timestamptz,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.plan_id, s.plan_status, s.plan_expires_at, s.status, s.created_at
  FROM public.societies s
  ORDER BY s.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_societies() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_societies() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  full_name text,
  email text,
  phone text,
  created_at timestamptz,
  society_id uuid,
  society_name text,
  plan_id text,
  plan_status text,
  plan_expires_at timestamptz,
  roles jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_super_admin(v_user) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.created_at,
    p.society_id,
    s.name AS society_name,
    s.plan_id,
    s.plan_status,
    s.plan_expires_at,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('role', ur.role, 'society_id', ur.society_id, 'block_id', ur.block_id) ORDER BY ur.created_at)
      FROM public.user_roles ur
      WHERE ur.user_id = p.id
    ), '[]'::jsonb) AS roles
  FROM public.profiles p
  LEFT JOIN public.societies s ON s.id = p.society_id
  ORDER BY p.created_at DESC
  LIMIT 1000;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_society_plan(
  _society_id uuid,
  _plan_id text,
  _months integer DEFAULT 1,
  _extend boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_base timestamptz;
  v_months integer := LEAST(GREATEST(COALESCE(_months, 1), 1), 120);
  v_plan text := NULLIF(trim(_plan_id), '');
BEGIN
  IF v_caller IS NULL OR NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _society_id IS NULL OR v_plan IS NULL THEN
    RAISE EXCEPTION 'society_id and plan_id required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = v_plan) THEN
    RAISE EXCEPTION 'Unknown plan: %', v_plan;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.societies WHERE id = _society_id) THEN
    RAISE EXCEPTION 'Unknown society';
  END IF;

  IF _extend THEN
    SELECT GREATEST(COALESCE(plan_expires_at, now()), now())
    INTO v_base
    FROM public.societies
    WHERE id = _society_id;
  ELSE
    v_base := now();
  END IF;

  UPDATE public.societies
  SET plan_id = v_plan,
      plan_status = 'active',
      plan_selected_at = now(),
      plan_expires_at = v_base + (v_months || ' months')::interval,
      status = 'active',
      updated_at = now()
  WHERE id = _society_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_society_plan(uuid, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_society_plan(uuid, text, integer, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_invalid_bill_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_flat_society uuid;
  v_block uuid;
BEGIN
  SELECT f.society_id, f.block_id
  INTO v_flat_society, v_block
  FROM public.flats f
  WHERE f.id = NEW.flat_id;

  IF v_flat_society IS NULL THEN
    RAISE EXCEPTION 'Bills can only be created for an existing housing unit';
  END IF;

  IF NEW.society_id IS DISTINCT FROM v_flat_society THEN
    RAISE EXCEPTION 'Bill society must match the housing unit society';
  END IF;

  IF v_block IS NULL THEN
    RAISE EXCEPTION 'Bills can only be created after the housing unit is assigned to a block';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invalid_bill_scope ON public.bills;
CREATE TRIGGER trg_prevent_invalid_bill_scope
BEFORE INSERT OR UPDATE OF society_id, flat_id ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.prevent_invalid_bill_scope();

REVOKE ALL ON FUNCTION public.prevent_invalid_bill_scope() FROM PUBLIC, anon, authenticated;