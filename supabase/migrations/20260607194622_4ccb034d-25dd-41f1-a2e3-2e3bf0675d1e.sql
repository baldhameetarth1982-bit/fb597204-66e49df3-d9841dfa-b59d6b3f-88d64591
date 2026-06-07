REVOKE EXECUTE ON FUNCTION public.is_society_admin_for(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_society_admin_for(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.is_society_admin_for(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_society_admin_for(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;