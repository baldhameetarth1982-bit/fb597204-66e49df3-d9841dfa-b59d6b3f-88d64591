
-- 1. flat_outstanding: auth + ownership guard
CREATE OR REPLACE FUNCTION public.flat_outstanding(_flat_id uuid)
 RETURNS TABLE(pending numeric, overdue_count integer, next_due date)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_society uuid; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT society_id INTO v_society FROM public.flats WHERE id = _flat_id;
  IF v_society IS NULL THEN RAISE EXCEPTION 'Flat not found'; END IF;
  IF NOT (
    public.is_super_admin(v_uid)
    OR public.is_society_admin_for(v_uid, v_society)
    OR EXISTS (SELECT 1 FROM public.flat_residents WHERE flat_id = _flat_id AND user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN status IN ('pending','outstanding') AND period_start <= CURRENT_DATE THEN amount_due ELSE 0 END), 0),
    COUNT(*) FILTER (WHERE status IN ('pending','outstanding') AND due_date IS NOT NULL AND due_date < CURRENT_DATE)::int,
    MIN(due_date) FILTER (WHERE status IN ('pending','outstanding'))
  FROM public.maintenance_periods
  WHERE flat_id = _flat_id;
END $function$;

REVOKE ALL ON FUNCTION public.flat_outstanding(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flat_outstanding(uuid) TO authenticated;

-- 2. society_maintenance_summary: drop+recreate with auth guard, same return signature
DROP FUNCTION IF EXISTS public.society_maintenance_summary(uuid);
CREATE FUNCTION public.society_maintenance_summary(_society_id uuid)
 RETURNS TABLE(total_houses integer, paid_periods integer, pending_periods integer, advance_periods integer, overdue_periods integer, outstanding_amount numeric, advance_amount numeric, collection_percent numeric)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.is_super_admin(v_uid)
    OR public.is_society_admin_for(v_uid, _society_id)
    OR public.authorize_membership(v_uid, _society_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
  WITH t AS (
    SELECT status, amount_due, period_start, due_date FROM public.maintenance_periods
    WHERE society_id = _society_id
  )
  SELECT
    (SELECT COUNT(*)::int FROM public.flats WHERE society_id = _society_id),
    (SELECT COUNT(*)::int FROM t WHERE status = 'paid'),
    (SELECT COUNT(*)::int FROM t WHERE status IN ('pending','outstanding') AND period_start <= CURRENT_DATE),
    (SELECT COUNT(*)::int FROM t WHERE status = 'paid' AND period_start > CURRENT_DATE),
    (SELECT COUNT(*)::int FROM t WHERE status IN ('pending','outstanding') AND due_date IS NOT NULL AND due_date < CURRENT_DATE),
    (SELECT COALESCE(SUM(amount_due),0) FROM t WHERE status IN ('pending','outstanding') AND period_start <= CURRENT_DATE),
    (SELECT COALESCE(SUM(amount_due),0) FROM t WHERE status = 'paid' AND period_start > CURRENT_DATE),
    (SELECT CASE WHEN (COUNT(*) FILTER (WHERE period_start <= CURRENT_DATE)) = 0 THEN 0
      ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'paid' AND period_start <= CURRENT_DATE)
        / NULLIF(COUNT(*) FILTER (WHERE period_start <= CURRENT_DATE), 0), 1)
      END FROM t);
END $fn$;

REVOKE ALL ON FUNCTION public.society_maintenance_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.society_maintenance_summary(uuid) TO authenticated;

-- 3. Revoke anon execute on tenant/admin SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.bulk_approve_join_requests(uuid, uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bulk_reject_join_requests(uuid, uuid[], text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.commit_society_wizard(uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_society_full(text, text, text, text, text, text, text, integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.deactivate_flat_resident(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_society_access_status(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_pending_join_requests(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerate_society_invite_code(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_wizard_draft(uuid, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_society_invite_code_custom(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_society_invite_code_enabled(uuid, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.start_society_trial(uuid) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.bulk_approve_join_requests(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_reject_join_requests(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.commit_society_wizard(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_society_full(text, text, text, text, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_flat_resident(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_society_access_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_pending_join_requests(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_society_invite_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_wizard_draft(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_society_invite_code_custom(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_society_invite_code_enabled(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_society_trial(uuid) TO authenticated;

-- 4. Uploads bucket policies: remove public/shared, scope to owner's folder
DROP POLICY IF EXISTS "uploads_public_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_select" ON storage.objects;
DROP POLICY IF EXISTS "uploads_authenticated_insert" ON storage.objects;

CREATE POLICY "uploads_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'uploads'
    AND (owner = auth.uid() OR (storage.foldername(name))[1] = auth.uid()::text)
  );

CREATE POLICY "uploads_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'uploads'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
