ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aadhaar_url text,
  ADD COLUMN IF NOT EXISTS aadhaar_last4 text,
  ADD COLUMN IF NOT EXISTS aadhaar_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS aadhaar_verified boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_society_id ON public.profiles(society_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_society_role ON public.user_roles(user_id, society_id, role);

COMMENT ON COLUMN public.profiles.aadhaar_url IS 'Private storage path for resident Aadhaar/KYC document.';
COMMENT ON COLUMN public.profiles.aadhaar_last4 IS 'Last 4 digits supplied for KYC matching.';
COMMENT ON COLUMN public.profiles.aadhaar_uploaded_at IS 'Time resident uploaded KYC document.';
COMMENT ON COLUMN public.profiles.aadhaar_verified IS 'KYC approval status controlled by society admin RPC.';