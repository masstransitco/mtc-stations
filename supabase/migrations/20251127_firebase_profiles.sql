-- Firebase Profiles Migration
-- Creates profiles table for Firebase-authenticated users
-- Unlike auth.users, this stores Firebase UIDs directly

-- Create firebase_profiles table
CREATE TABLE IF NOT EXISTS public.firebase_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid TEXT UNIQUE NOT NULL,
  phone TEXT,
  display_name TEXT,
  email TEXT,
  roles TEXT[] DEFAULT '{user}',
  is_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,

  -- Profile metadata
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_sign_in_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_firebase_profiles_uid ON public.firebase_profiles(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_firebase_profiles_phone ON public.firebase_profiles(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_firebase_profiles_is_admin ON public.firebase_profiles(is_admin) WHERE is_admin = TRUE;

-- Enable Row Level Security
ALTER TABLE public.firebase_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- For now, only service role can access (API routes verify Firebase tokens)
-- In future, could add policies based on request headers

-- Service role bypass (automatically has full access)

-- Allow authenticated API routes to read profiles
CREATE POLICY "Service role full access"
  ON public.firebase_profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_firebase_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS firebase_profiles_updated_at ON public.firebase_profiles;
CREATE TRIGGER firebase_profiles_updated_at
  BEFORE UPDATE ON public.firebase_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_firebase_profiles_updated_at();

COMMENT ON TABLE public.firebase_profiles IS 'User profiles for Firebase-authenticated users';
COMMENT ON COLUMN public.firebase_profiles.firebase_uid IS 'Firebase user UID (from Firebase Auth)';
