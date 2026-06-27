-- 1) poll_votes: restrict SELECT to own votes only (vote privacy)
DROP POLICY IF EXISTS "society members view poll votes" ON public.poll_votes;
DROP POLICY IF EXISTS "society view poll votes" ON public.poll_votes;
DROP POLICY IF EXISTS "view poll votes" ON public.poll_votes;
DROP POLICY IF EXISTS "poll_votes_select" ON public.poll_votes;
DROP POLICY IF EXISTS "users view own poll votes" ON public.poll_votes;

CREATE POLICY "users view own poll votes"
ON public.poll_votes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 2) posts storage bucket: add UPDATE policy mirroring DELETE (owner-only)
DROP POLICY IF EXISTS "posts owner update" ON storage.objects;
CREATE POLICY "posts owner update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 3) Revoke EXECUTE from authenticated on internal SECURITY DEFINER helpers
-- These are only used by triggers / other SECURITY DEFINER funcs, not called from client.
REVOKE EXECUTE ON FUNCTION public.generate_society_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_referral_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_society_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_block_ids(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_block_admin(uuid, uuid) FROM PUBLIC, anon, authenticated;