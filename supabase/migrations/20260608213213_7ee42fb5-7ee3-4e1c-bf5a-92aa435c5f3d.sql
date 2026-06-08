
-- 1) Restrict role escalation by society admins
DROP POLICY IF EXISTS "society admins manage roles in their society" ON public.user_roles;
CREATE POLICY "society admins manage roles in their society"
  ON public.user_roles
  FOR ALL
  USING (
    public.is_society_admin_for(auth.uid(), society_id)
    AND role = ANY (ARRAY['resident'::public.app_role, 'block_admin'::public.app_role])
  )
  WITH CHECK (
    public.is_society_admin_for(auth.uid(), society_id)
    AND role = ANY (ARRAY['resident'::public.app_role, 'block_admin'::public.app_role])
    AND society_id IS NOT NULL
  );

-- 2) Hide societies.invite_code from regular reads; expose via SECURITY DEFINER
REVOKE SELECT (invite_code) ON public.societies FROM authenticated;
REVOKE SELECT (invite_code) ON public.societies FROM anon;

CREATE OR REPLACE FUNCTION public.get_society_invite_code(_society_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (public.is_society_admin_for(auth.uid(), _society_id)
          OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT invite_code INTO v_code FROM public.societies WHERE id = _society_id;
  RETURN v_code;
END;
$$;

REVOKE ALL ON FUNCTION public.get_society_invite_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_society_invite_code(uuid) TO authenticated;

-- 3) Reinstall pg_net into the extensions schema (it doesn't support SET SCHEMA)
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;
DROP EXTENSION IF EXISTS pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
