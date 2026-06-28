
-- 1. Drop residual broad SELECT policy on poll_votes
DROP POLICY IF EXISTS "society members view votes" ON public.poll_votes;

-- 2. Public-key read for Razorpay (safe non-secret values)
CREATE OR REPLACE FUNCTION public.get_razorpay_public_config()
RETURNS TABLE(key_id text, configured boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT razorpay_key_id, COALESCE(razorpay_configured, false)
  FROM public.platform_settings WHERE id = 1;
$$;
REVOKE ALL ON FUNCTION public.get_razorpay_public_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_razorpay_public_config() TO authenticated;

-- 3. Revoke EXECUTE from authenticated/anon on internal SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_block_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_society_id(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.society_has_access(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_society_admin_for(uuid, uuid) FROM PUBLIC, anon, authenticated;
