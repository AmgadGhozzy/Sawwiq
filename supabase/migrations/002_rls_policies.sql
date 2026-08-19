-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Block completely for anon role
-- Note: by default, enabling RLS without policies denies all access to the table,
-- but for clarity we explicitly ensure no anon policies are created.

-- The Edge Function and Route Handlers use service_role_key which bypasses RLS.
-- This ensures clients cannot use NEXT_PUBLIC_SUPABASE_ANON_KEY to read/write data directly.
