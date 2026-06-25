DROP POLICY IF EXISTS "society admins manage roles in their society" ON public.user_roles;

CREATE POLICY "society admins manage roles in their society"
ON public.user_roles
FOR ALL
USING (
  public.is_society_admin_for(auth.uid(), society_id)
  AND role = ANY (ARRAY['resident'::app_role, 'block_admin'::app_role, 'security'::app_role])
)
WITH CHECK (
  public.is_society_admin_for(auth.uid(), society_id)
  AND role = ANY (ARRAY['resident'::app_role, 'block_admin'::app_role, 'security'::app_role])
  AND society_id IS NOT NULL
);