
CREATE OR REPLACE FUNCTION public.admin_grant_society_plan(
  _society_id uuid,
  _plan_id text,
  _months integer DEFAULT 1,
  _extend boolean DEFAULT true
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_base timestamptz;
BEGIN
  IF v_caller IS NULL OR NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _society_id IS NULL OR _plan_id IS NULL THEN
    RAISE EXCEPTION 'society_id and plan_id required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = _plan_id) THEN
    RAISE EXCEPTION 'Unknown plan: %', _plan_id;
  END IF;

  IF _extend THEN
    SELECT GREATEST(COALESCE(plan_expires_at, now()), now()) INTO v_base
    FROM public.societies WHERE id = _society_id;
  ELSE
    v_base := now();
  END IF;

  UPDATE public.societies
  SET plan_id = _plan_id,
      plan_status = 'active',
      plan_selected_at = now(),
      plan_expires_at = v_base + (GREATEST(_months,1) || ' months')::interval,
      status = 'active',
      updated_at = now()
  WHERE id = _society_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_grant_society_plan(uuid, text, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_society_plan(uuid, text, integer, boolean) TO authenticated;
