-- Generic updated_at trigger (reuse touch_updated_at if exists)
-- Already have public.touch_updated_at()

-- ============ BLOCKS ============
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (society_id, name)
);

CREATE INDEX idx_blocks_society ON public.blocks(society_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins full access to blocks"
ON public.blocks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "society admins manage blocks in their society"
ON public.blocks FOR ALL TO authenticated
USING (society_id IN (
  SELECT society_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'society_admin'
))
WITH CHECK (society_id IN (
  SELECT society_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'society_admin'
));

CREATE POLICY "residents view blocks in their society"
ON public.blocks FOR SELECT TO authenticated
USING (society_id IN (
  SELECT society_id FROM public.profiles WHERE id = auth.uid()
));

CREATE TRIGGER trg_blocks_touch BEFORE UPDATE ON public.blocks
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ FLATS ============
CREATE TABLE public.flats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id UUID NOT NULL REFERENCES public.societies(id) ON DELETE CASCADE,
  block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  flat_number TEXT NOT NULL,
  floor INTEGER,
  type TEXT,
  area_sqft NUMERIC,
  status TEXT NOT NULL DEFAULT 'vacant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (block_id, flat_number)
);

CREATE INDEX idx_flats_society ON public.flats(society_id);
CREATE INDEX idx_flats_block ON public.flats(block_id);

ALTER TABLE public.flats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins full access to flats"
ON public.flats FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "society admins manage flats in their society"
ON public.flats FOR ALL TO authenticated
USING (society_id IN (
  SELECT society_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'society_admin'
))
WITH CHECK (society_id IN (
  SELECT society_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'society_admin'
));

CREATE POLICY "residents view flats in their society"
ON public.flats FOR SELECT TO authenticated
USING (society_id IN (
  SELECT society_id FROM public.profiles WHERE id = auth.uid()
));

CREATE TRIGGER trg_flats_touch BEFORE UPDATE ON public.flats
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ FLAT RESIDENTS (link table) ============
CREATE TABLE public.flat_residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flat_id UUID NOT NULL REFERENCES public.flats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'owner', -- owner | tenant | family
  is_primary BOOLEAN NOT NULL DEFAULT false,
  moved_in_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flat_id, user_id)
);

CREATE INDEX idx_flat_residents_flat ON public.flat_residents(flat_id);
CREATE INDEX idx_flat_residents_user ON public.flat_residents(user_id);

ALTER TABLE public.flat_residents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super admins full access to flat_residents"
ON public.flat_residents FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "society admins manage flat_residents in their society"
ON public.flat_residents FOR ALL TO authenticated
USING (flat_id IN (
  SELECT f.id FROM public.flats f
  WHERE f.society_id IN (
    SELECT society_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'society_admin'
  )
))
WITH CHECK (flat_id IN (
  SELECT f.id FROM public.flats f
  WHERE f.society_id IN (
    SELECT society_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'society_admin'
  )
));

CREATE POLICY "residents view their own flat assignments"
ON public.flat_residents FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- ============ Allow society admin onboarding self-insert into societies ============
-- During onboarding a freshly signed-up user creates a society.
-- They aren't yet a society_admin, so let any authenticated user INSERT a society.
CREATE POLICY "any authenticated user can create a society"
ON public.societies FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to insert their OWN society_admin role (claims first society they create)
CREATE POLICY "users can claim society_admin for societies they create"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'society_admin');

-- Allow users to update their own profile to attach society_id during onboarding
-- (already have "users update own profile" policy)
