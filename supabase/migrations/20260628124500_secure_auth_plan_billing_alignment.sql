-- Structural hardening for auth hydration, subscription gates, and premature billing prevention.

-- Billing schedules must never auto-run just because a society row exists.
-- They become enabled only when the society admin explicitly saves/enables Bill Studio.
ALTER TABLE public.billing_schedules
  ALTER COLUMN enabled SET DEFAULT false,
  ALTER COLUMN next_run_at SET DEFAULT (date_trunc('month', now()) + interval '1 month');

UPDATE public.billing_schedules
SET enabled = false,
    next_run_at = GREATEST(next_run_at, now() + interval '1 day')
WHERE last_run_at IS NULL
  AND created_at >= now() - interval '30 days'
  AND next_run_at <= now();

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
          lower(COALESCE(s.plan_status, '')) = 'active'
          AND COALESCE(NULLIF(s.plan_id, ''), '') NOT IN ('', 'trial')
          AND COALESCE(s.plan_expires_at, now() + interval '100 years') > now()
        )
        OR (
          lower(COALESCE(s.plan_status, '')) = 'trialing'
          AND s.trial_ends_at IS NOT NULL
          AND s.trial_ends_at > now()
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_society_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_society_plan(uuid) TO authenticated;

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
  v_expires timestamptz;
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

  v_expires := v_base + (v_months || ' months')::interval;

  UPDATE public.societies
  SET plan_id = v_plan,
      plan_status = 'active',
      plan_selected_at = now(),
      plan_expires_at = v_expires,
      status = 'active',
      billing_active = true,
      updated_at = now()
  WHERE id = _society_id;

  INSERT INTO public.audit_log (actor_id, action, target_table, target_id, society_id, metadata)
  VALUES (
    v_caller,
    'admin_grant_society_plan',
    'societies',
    _society_id,
    _society_id,
    jsonb_build_object('plan_id', v_plan, 'months', v_months, 'expires_at', v_expires, 'extend', _extend)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_society_plan(uuid, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_society_plan(uuid, text, integer, boolean) TO authenticated;

-- Hard database stop: bills can only be written for a real unit in the same society,
-- assigned to a block, and linked to at least one resident whose profile is in that society.
CREATE OR REPLACE FUNCTION public.prevent_invalid_bill_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_flat_society uuid;
  v_block uuid;
  v_has_resident boolean;
BEGIN
  IF NEW.society_id IS NULL OR NEW.flat_id IS NULL THEN
    RAISE EXCEPTION 'Bills require society and housing unit';
  END IF;

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

  SELECT EXISTS (
    SELECT 1
    FROM public.flat_residents fr
    JOIN public.profiles p ON p.id = fr.user_id
    WHERE fr.flat_id = NEW.flat_id
      AND p.society_id = NEW.society_id
  ) INTO v_has_resident;

  IF NOT v_has_resident THEN
    RAISE EXCEPTION 'Bills can only be created for units assigned to a resident in this society';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_invalid_bill_scope ON public.bills;
CREATE TRIGGER trg_prevent_invalid_bill_scope
BEFORE INSERT OR UPDATE OF society_id, flat_id ON public.bills
FOR EACH ROW EXECUTE FUNCTION public.prevent_invalid_bill_scope();

REVOKE ALL ON FUNCTION public.prevent_invalid_bill_scope() FROM PUBLIC, anon, authenticated;

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
  WITH role_society AS (
    SELECT DISTINCT ON (ur.user_id)
      ur.user_id,
      ur.society_id
    FROM public.user_roles ur
    WHERE ur.society_id IS NOT NULL
    ORDER BY ur.user_id,
      CASE ur.role
        WHEN 'society_admin'::public.app_role THEN 1
        WHEN 'resident'::public.app_role THEN 2
        WHEN 'block_admin'::public.app_role THEN 3
        WHEN 'security'::public.app_role THEN 4
        ELSE 9
      END,
      ur.created_at
  )
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.created_at,
    COALESCE(p.society_id, rs.society_id) AS society_id,
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
  LEFT JOIN role_society rs ON rs.user_id = p.id
  LEFT JOIN public.societies s ON s.id = COALESCE(p.society_id, rs.society_id)
  ORDER BY p.created_at DESC
  LIMIT 1000;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_income_summary()
RETURNS TABLE(
  subscription_mrr numeric,
  transaction_fee_revenue numeric,
  total_revenue numeric,
  plans jsonb
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
  WITH plan_counts AS (
    SELECT
      p.id,
      p.name,
      p.price_monthly_inr,
      p.txn_fee_pct,
      p.sort_order,
      COUNT(s.id) FILTER (WHERE s.plan_id = p.id) AS society_count
    FROM public.plans p
    LEFT JOIN public.societies s ON s.plan_id = p.id
    GROUP BY p.id, p.name, p.price_monthly_inr, p.txn_fee_pct, p.sort_order
  ), sub AS (
    SELECT COALESCE(SUM(COALESCE(p.price_monthly_inr, 0)), 0)::numeric AS amount
    FROM public.societies s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE COALESCE(s.plan_status, '') IN ('active', 'trialing')
  ), fees AS (
    SELECT COALESCE(SUM((COALESCE(pay.amount, 0) * COALESCE(pl.txn_fee_pct, 1.5)) / 100), 0)::numeric AS amount
    FROM public.payments pay
    LEFT JOIN public.societies soc ON soc.id = pay.society_id
    LEFT JOIN public.plans pl ON pl.id = soc.plan_id
    WHERE pay.status = 'success'
  )
  SELECT
    sub.amount,
    fees.amount,
    (sub.amount + fees.amount),
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pc.id,
          'name', pc.name,
          'price_monthly_inr', pc.price_monthly_inr,
          'txn_fee_pct', pc.txn_fee_pct,
          'society_count', pc.society_count
        ) ORDER BY pc.sort_order
      )
      FROM plan_counts pc
    ), '[]'::jsonb)
  FROM sub, fees;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_income_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_income_summary() TO authenticated;

-- Repair historical members whose profile.society_id is blank even though their role row is scoped.
-- This prevents existing residents/admins from ever falling back into onboarding after refresh/login.
DO $$
BEGIN
  PERFORM set_config('app.allow_society_change', 'on', true);

  WITH chosen AS (
    SELECT DISTINCT ON (ur.user_id)
      ur.user_id,
      ur.society_id
    FROM public.user_roles ur
    WHERE ur.society_id IS NOT NULL
    ORDER BY ur.user_id,
      CASE ur.role
        WHEN 'society_admin'::public.app_role THEN 1
        WHEN 'resident'::public.app_role THEN 2
        WHEN 'block_admin'::public.app_role THEN 3
        WHEN 'security'::public.app_role THEN 4
        ELSE 9
      END,
      ur.created_at
  )
  UPDATE public.profiles p
  SET society_id = chosen.society_id,
      updated_at = COALESCE(p.updated_at, now())
  FROM chosen
  WHERE p.id = chosen.user_id
    AND p.society_id IS NULL;

  PERFORM set_config('app.allow_society_change', 'off', true);
END;
$$;
