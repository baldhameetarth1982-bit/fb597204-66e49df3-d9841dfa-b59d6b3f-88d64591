
-- 1. PLANS catalog
CREATE TABLE public.plans (
  id text PRIMARY KEY,                 -- 'trial','basic','pro','premium'
  name text NOT NULL,
  price_monthly_inr int NOT NULL,
  txn_fee_pct numeric(4,2) NOT NULL,   -- 1.50 / 1.00 / 0.00
  ads_enabled boolean NOT NULL DEFAULT false,
  trial_days int NOT NULL DEFAULT 0,
  is_recommended boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable by all" ON public.plans FOR SELECT USING (true);
CREATE POLICY "plans admin write" ON public.plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

INSERT INTO public.plans (id, name, price_monthly_inr, txn_fee_pct, ads_enabled, trial_days, is_recommended, features, sort_order) VALUES
 ('trial',  'Free Trial',  0,   1.50, true,  14, false,
   '["All features unlocked","No credit card required","Auto-converts to Basic after 14 days"]'::jsonb, 0),
 ('basic',  'Basic',       799, 1.50, true,  0,  false,
   '["Visitor management","Bills & payments","Announcements","Ad-supported"]'::jsonb, 1),
 ('pro',    'Pro',         999, 1.00, false, 0,  false,
   '["Everything in Basic","Ad-free","Lower transaction fee","Priority support"]'::jsonb, 2),
 ('premium','Premium',     1499,0.00, false, 0,  true,
   '["Everything in Pro","Zero transaction fees","Dedicated success manager","Custom branding"]'::jsonb, 3);

-- 2. attach plan + trial to societies
ALTER TABLE public.societies
  ADD COLUMN IF NOT EXISTS plan_id text REFERENCES public.plans(id) DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS billing_active boolean NOT NULL DEFAULT true;

-- 3. FAMILY members
CREATE TABLE public.family_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 80),
  relation text NOT NULL CHECK (relation IN ('spouse','child','parent','sibling','helper','other')),
  phone text CHECK (phone IS NULL OR char_length(phone) <= 20),
  age int CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_members TO authenticated;
GRANT ALL ON public.family_members TO service_role;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "family own select" ON public.family_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "family own insert" ON public.family_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "family own update" ON public.family_members FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "family own delete" ON public.family_members FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER trg_family_touch BEFORE UPDATE ON public.family_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. simple rate-limit table for server functions
CREATE TABLE public.rate_limits (
  bucket text NOT NULL,
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, subject, window_start)
);
GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- no policies = only service_role (used from server fns) can touch it
