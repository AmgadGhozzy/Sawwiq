-- =============================================================================
-- Sawwiq — Initial Schema
-- Run this in Supabase → SQL Editor
-- =============================================================================

-- 1. Sessions Table (anonymous session tracking + rate limiting)
CREATE TABLE IF NOT EXISTS sessions (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token     TEXT        UNIQUE NOT NULL,
    generations_count INTEGER     DEFAULT 0 NOT NULL,
    max_limit         INTEGER     DEFAULT 3 NOT NULL,
    created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 2. Generations Table (full generation history with JSONB output)
CREATE TABLE IF NOT EXISTS generations (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id   UUID        REFERENCES sessions(id) ON DELETE CASCADE,
    prompt       TEXT        NOT NULL,
    platform     TEXT        NOT NULL,
    content_type TEXT        NOT NULL,
    arabic_style TEXT        NOT NULL,
    ai_response  JSONB       NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- 3. Waitlist Table (lead capture)
CREATE TABLE IF NOT EXISTS waitlist (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID        REFERENCES sessions(id) ON DELETE SET NULL,
    email      TEXT        UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_token      ON sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_generations_session ON generations(session_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_email      ON waitlist(email);

-- Auto-update updated_at on sessions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
