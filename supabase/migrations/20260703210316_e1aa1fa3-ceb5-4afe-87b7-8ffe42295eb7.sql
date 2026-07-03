
DROP POLICY IF EXISTS pricing_settings_read_all ON public.pricing_settings;
CREATE POLICY pricing_settings_read_auth ON public.pricing_settings
  FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.pricing_settings FROM anon;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon, PUBLIC', r.proname, r.args);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.find_society_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_societies_public(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_razorpay_live() TO anon;
GRANT EXECUTE ON FUNCTION public.get_applicable_plans(integer) TO anon;
