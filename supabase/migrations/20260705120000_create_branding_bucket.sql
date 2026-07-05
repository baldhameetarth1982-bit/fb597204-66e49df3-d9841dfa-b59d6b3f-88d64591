-- The branding bucket policies were created in 20260703204509, but the bucket
-- itself was never created — logo/signature uploads fail without it.
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', false)
ON CONFLICT (id) DO NOTHING;
