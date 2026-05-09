
-- 1. ROLES ENUM
CREATE TYPE public.app_role AS ENUM ('super_admin', 'society_admin', 'resident');

-- 2. SOCIETIES
CREATE TABLE public.societies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  registration_no TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'basic' CHECK (plan IN ('basic','pro','premium')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PROFILES (user_id == auth.users.id)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  society_id UUID REFERENCES public.societies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. USER ROLES (separate table — never store role on profiles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  society_id UUID REFERENCES public.societies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, society_id)
);

-- 5. SECURITY-DEFINER ROLE CHECK (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 6. AUTO-CREATE PROFILE + DEFAULT RESIDENT ROLE ON SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'resident');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. UPDATED_AT TRIGGER
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER touch_profiles BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER touch_societies BEFORE UPDATE ON public.societies
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.societies ENABLE ROW LEVEL SECURITY;

-- 9. PROFILE POLICIES
CREATE POLICY "users view own profile" ON public.profiles
FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "users update own profile" ON public.profiles
FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "super admins view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "society admins view profiles in their society" ON public.profiles
FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'society_admin')
  AND society_id IN (
    SELECT society_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'society_admin'
  )
);

-- 10. USER_ROLES POLICIES
CREATE POLICY "users view own roles" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "super admins manage all roles" ON public.user_roles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

-- 11. SOCIETIES POLICIES
CREATE POLICY "super admins full access to societies" ON public.societies
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'super_admin'))
WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "society admins view their society" ON public.societies
FOR SELECT TO authenticated USING (
  id IN (
    SELECT society_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'society_admin'
  )
);

CREATE POLICY "society admins update their society" ON public.societies
FOR UPDATE TO authenticated USING (
  id IN (
    SELECT society_id FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'society_admin'
  )
);

CREATE POLICY "residents view their society" ON public.societies
FOR SELECT TO authenticated USING (
  id IN (SELECT society_id FROM public.profiles WHERE id = auth.uid())
);
