
-- 1. poll_options / poll_votes: scope SELECT to user's society
DROP POLICY IF EXISTS "society members view poll options" ON public.poll_options;
CREATE POLICY "society members view poll options"
ON public.poll_options FOR SELECT TO authenticated
USING (
  poll_id IN (
    SELECT p.id FROM public.polls p
    WHERE p.society_id = public.get_user_society_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "society members view votes" ON public.poll_votes;
CREATE POLICY "society members view votes"
ON public.poll_votes FOR SELECT TO authenticated
USING (
  poll_id IN (
    SELECT p.id FROM public.polls p
    WHERE p.society_id = public.get_user_society_id(auth.uid())
  )
);

-- 2. user_roles: remove self-claim privilege escalation
DROP POLICY IF EXISTS "users can claim society_admin for societies they create" ON public.user_roles;

-- 3. platform_settings: drop secret column (move to env secret)
ALTER TABLE public.platform_settings DROP COLUMN IF EXISTS razorpay_key_secret;

-- 4. rate_limits: lock to service_role only (only SECURITY DEFINER fns use it)
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;
