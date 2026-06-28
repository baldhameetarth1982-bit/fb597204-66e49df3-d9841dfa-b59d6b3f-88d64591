
-- =========================================================
-- Phase 3: Setup Wizard + Custom Fields
-- =========================================================

-- 1) society_settings -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.society_settings (
  society_id uuid PRIMARY KEY REFERENCES public.societies(id) ON DELETE CASCADE,
  registration_no text,
  address text,
  city text,
  state text,
  pincode text,
  structure_type text NOT NULL DEFAULT 'blocks' CHECK (structure_type IN ('blocks','towers','wings','buildings','none')),
  opening_cash numeric(14,2) NOT NULL DEFAULT 0,
  opening_bank numeric(14,2) NOT NULL DEFAULT 0,
  opening_balance_date date,
  maintenance_frequency text NOT NULL DEFAULT 'monthly' CHECK (maintenance_frequency IN ('monthly','quarterly','half_yearly','yearly')),
  maintenance_due_day int NOT NULL DEFAULT 10 CHECK (maintenance_due_day BETWEEN 1 AND 28),
  grace_days int NOT NULL DEFAULT 5 CHECK (grace_days BETWEEN 0 AND 30),
  late_fee_amount numeric(10,2) NOT NULL DEFAULT 0,
  late_fee_type text NOT NULL DEFAULT 'flat' CHECK (late_fee_type IN ('flat','percent')),
  wizard_step int NOT NULL DEFAULT 0,
  setup_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.society_settings TO authenticated;
GRANT ALL ON public.society_settings TO service_role;
ALTER TABLE public.society_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "society_settings_select" ON public.society_settings
  FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.authorize_membership(auth.uid(), society_id));
CREATE POLICY "society_settings_insert" ON public.society_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_society_admin_for(auth.uid(), society_id));
CREATE POLICY "society_settings_update" ON public.society_settings
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_society_admin_for(auth.uid(), society_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_society_admin_for(auth.uid(), society_id));

CREATE TRIGGER trg_society_settings_touch
  BEFORE UPDATE ON public.society_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Immutability for opening balances after wizard completion
CREATE OR REPLACE FUNCTION public.lock_opening_balances()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.setup_completed_at IS NOT NULL
     AND NOT public.is_super_admin(auth.uid()) THEN
    IF NEW.opening_cash IS DISTINCT FROM OLD.opening_cash
       OR NEW.opening_bank IS DISTINCT FROM OLD.opening_bank
       OR NEW.opening_balance_date IS DISTINCT FROM OLD.opening_balance_date THEN
      RAISE EXCEPTION 'Opening balances are locked after setup. Use an Adjustment Entry instead.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.lock_opening_balances() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_lock_opening_balances
  BEFORE UPDATE ON public.society_settings
  FOR EACH ROW EXECUTE FUNCTION public.lock_opening_balances();

-- 2) custom_fields ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','dropdown','date','checkbox','file','image')),
  sort_order int NOT NULL DEFAULT 0,
  required boolean NOT NULL DEFAULT false,
  visibility text NOT NULL DEFAULT 'resident_editable' CHECK (visibility IN ('resident_editable','admin_only','hidden')),
  options jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (society_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_fields_select" ON public.custom_fields
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (public.authorize_membership(auth.uid(), society_id) AND visibility <> 'hidden')
    OR public.is_society_admin_for(auth.uid(), society_id)
  );
CREATE POLICY "custom_fields_admin_write" ON public.custom_fields
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_society_admin_for(auth.uid(), society_id))
  WITH CHECK (public.is_super_admin(auth.uid()) OR public.is_society_admin_for(auth.uid(), society_id));

CREATE TRIGGER trg_custom_fields_touch
  BEFORE UPDATE ON public.custom_fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_custom_fields_society ON public.custom_fields(society_id, sort_order);

-- 3) custom_field_values ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id uuid NOT NULL REFERENCES public.custom_fields(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  society_id uuid NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  value jsonb,
  file_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (field_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_values TO authenticated;
GRANT ALL ON public.custom_field_values TO service_role;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfv_select_self_or_admin" ON public.custom_field_values
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_super_admin(auth.uid())
    OR public.is_society_admin_for(auth.uid(), society_id)
  );
CREATE POLICY "cfv_self_write" ON public.custom_field_values
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.custom_fields cf
      WHERE cf.id = field_id AND cf.society_id = society_id
        AND cf.visibility = 'resident_editable'
    )
  );
CREATE POLICY "cfv_self_update" ON public.custom_field_values
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_society_admin_for(auth.uid(), society_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_society_admin_for(auth.uid(), society_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "cfv_admin_delete" ON public.custom_field_values
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.is_society_admin_for(auth.uid(), society_id));

CREATE TRIGGER trg_cfv_touch
  BEFORE UPDATE ON public.custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_cfv_user ON public.custom_field_values(user_id);
CREATE INDEX IF NOT EXISTS idx_cfv_field ON public.custom_field_values(field_id);

-- 4) complete_setup_wizard RPC --------------------------------------
CREATE OR REPLACE FUNCTION public.complete_setup_wizard(_society_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.is_society_admin_for(v_caller, _society_id) OR public.is_super_admin(v_caller)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.society_settings
    SET setup_completed_at = COALESCE(setup_completed_at, now()),
        updated_at = now()
  WHERE society_id = _society_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Run the setup wizard first';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_setup_wizard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_setup_wizard(uuid) TO authenticated;
