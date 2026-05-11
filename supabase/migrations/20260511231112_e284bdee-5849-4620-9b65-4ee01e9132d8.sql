-- Invite code column
ALTER TABLE public.societies
  ADD COLUMN IF NOT EXISTS invite_code TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_society_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; result TEXT := ''; i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars))::int + 1, 1);
  END LOOP;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.set_society_invite_code()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE new_code TEXT; attempts INT := 0;
BEGIN
  IF NEW.invite_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    new_code := public.generate_society_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.societies WHERE invite_code = new_code);
    attempts := attempts + 1;
    IF attempts > 10 THEN RAISE EXCEPTION 'Could not allocate invite code'; END IF;
  END LOOP;
  NEW.invite_code := new_code;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_society_invite_code ON public.societies;
CREATE TRIGGER trg_set_society_invite_code
BEFORE INSERT ON public.societies
FOR EACH ROW EXECUTE FUNCTION public.set_society_invite_code();

UPDATE public.societies SET invite_code = public.generate_society_code()
WHERE invite_code IS NULL;

-- Block scoping
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE;

-- Lookup helper
CREATE OR REPLACE FUNCTION public.find_society_by_code(_code TEXT)
RETURNS TABLE(id UUID, name TEXT, city TEXT, state TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, name, city, state FROM public.societies
  WHERE upper(invite_code) = upper(_code) AND status = 'active'
  LIMIT 1;
$$;

-- Join helper
CREATE OR REPLACE FUNCTION public.join_society_with_code(_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO sid FROM public.societies
  WHERE upper(invite_code) = upper(_code) AND status = 'active' LIMIT 1;
  IF sid IS NULL THEN RAISE EXCEPTION 'Invalid society code'; END IF;
  UPDATE public.profiles SET society_id = sid WHERE id = auth.uid();
  INSERT INTO public.user_roles (user_id, role, society_id)
  VALUES (auth.uid(), 'resident', sid)
  ON CONFLICT DO NOTHING;
  RETURN sid;
END; $$;

-- is_block_admin helper
CREATE OR REPLACE FUNCTION public.is_block_admin(_user_id UUID, _block_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'block_admin' AND block_id = _block_id
  );
$$;

-- Block admin RLS
CREATE POLICY "block admins view their block flats"
ON public.flats FOR SELECT TO authenticated
USING (block_id IN (
  SELECT block_id FROM public.user_roles
  WHERE user_id = auth.uid() AND role = 'block_admin' AND block_id IS NOT NULL
));

CREATE POLICY "block admins view flat_residents in their block"
ON public.flat_residents FOR SELECT TO authenticated
USING (flat_id IN (
  SELECT f.id FROM public.flats f
  WHERE f.block_id IN (
    SELECT block_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'block_admin' AND block_id IS NOT NULL
  )
));

CREATE POLICY "block admins view profiles in their block"
ON public.profiles FOR SELECT TO authenticated
USING (id IN (
  SELECT fr.user_id FROM public.flat_residents fr
  JOIN public.flats f ON f.id = fr.flat_id
  WHERE f.block_id IN (
    SELECT block_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'block_admin' AND block_id IS NOT NULL
  )
));

-- Society admins manage roles within their society
CREATE POLICY "society admins manage roles in their society"
ON public.user_roles FOR ALL TO authenticated
USING (society_id IN (
  SELECT ur.society_id FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'society_admin' AND ur.society_id IS NOT NULL
))
WITH CHECK (society_id IN (
  SELECT ur.society_id FROM public.user_roles ur
  WHERE ur.user_id = auth.uid() AND ur.role = 'society_admin' AND ur.society_id IS NOT NULL
));