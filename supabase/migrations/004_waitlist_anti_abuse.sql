-- =============================================================================
-- Sawwiq — Waitlist Anti-Abuse Protection
--
-- Adds:
--   1. fingerprint_hash + client_ip columns to waitlist
--   2. Indexes for fast abuse lookups
--   3. Atomic register_waitlist RPC with hardcoded anti-abuse constants
--
-- Design principle: Registration is always allowed. Bonus is conditional.
-- =============================================================================

-- 1. New columns
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT;
ALTER TABLE waitlist ADD COLUMN IF NOT EXISTS client_ip TEXT;

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_fingerprint
  ON waitlist(fingerprint_hash)
  WHERE fingerprint_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_waitlist_ip_created
  ON waitlist(client_ip, created_at)
  WHERE client_ip IS NOT NULL;

-- 3. Atomic RPC: register_waitlist
--
-- Flow:
--   1. If no session → INSERT waitlist, return registered + no bonus
--   2. Lock session FOR UPDATE
--   3. Check abuse signals BEFORE insert (against existing rows only):
--      a. max_limit >= MAX_BONUS_CAP → no bonus
--      b. fingerprint_hash found in existing rows → no bonus
--      c. client_ip bonus count in window >= limit → no bonus
--   4. INSERT waitlist (UNIQUE email handles race conditions)
--   5. If eligible → UPDATE session max_limit + 1
--   6. Return result
--
-- Anti-abuse constants are hardcoded here — not accepted as parameters.

CREATE OR REPLACE FUNCTION register_waitlist(
  p_email          TEXT,
  p_session_id     UUID,
  p_fingerprint_hash TEXT,
  p_client_ip      TEXT
)
RETURNS JSONB AS $$
DECLARE
  -- Hardcoded anti-abuse constants (server-side source of truth)
  MAX_BONUS_CAP         CONSTANT INTEGER := 5;
  IP_BONUS_LIMIT        CONSTANT INTEGER := 3;
  IP_BONUS_WINDOW_HOURS CONSTANT INTEGER := 24;

  v_max_limit    INTEGER;
  v_eligible     BOOLEAN := TRUE;
  v_reason       TEXT := NULL;
  v_fp_exists    BOOLEAN;
  v_ip_count     INTEGER;
BEGIN
  -- ── No session: register without bonus ──────────────────────────────
  IF p_session_id IS NULL THEN
    BEGIN
      INSERT INTO waitlist (email, fingerprint_hash, client_ip)
      VALUES (p_email, p_fingerprint_hash, p_client_ip);
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'registered', false,
        'bonus', false,
        'reason', 'EMAIL_EXISTS'
      );
    END;

    RETURN jsonb_build_object(
      'registered', true,
      'bonus', false,
      'reason', 'NO_SESSION'
    );
  END IF;

  -- ── Lock session to prevent concurrent bonus grants ─────────────────
  SELECT max_limit
  INTO v_max_limit
  FROM sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Session doesn't exist in DB; treat as no-session
    BEGIN
      INSERT INTO waitlist (email, session_id, fingerprint_hash, client_ip)
      VALUES (p_email, NULL, p_fingerprint_hash, p_client_ip);
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'registered', false,
        'bonus', false,
        'reason', 'EMAIL_EXISTS'
      );
    END;

    RETURN jsonb_build_object(
      'registered', true,
      'bonus', false,
      'reason', 'SESSION_NOT_FOUND'
    );
  END IF;

  -- ── Check abuse signals BEFORE inserting (existing rows only) ───────

  -- 1. Bonus cap
  IF v_max_limit >= MAX_BONUS_CAP THEN
    v_eligible := FALSE;
    v_reason := 'CAP_REACHED';
  END IF;

  -- 2. Fingerprint (only if still eligible and fingerprint provided)
  IF v_eligible AND p_fingerprint_hash IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM waitlist
      WHERE fingerprint_hash = p_fingerprint_hash
      LIMIT 1
    ) INTO v_fp_exists;

    IF v_fp_exists THEN
      v_eligible := FALSE;
      v_reason := 'FINGERPRINT';
    END IF;
  END IF;

  -- 3. IP rate limit (only if still eligible and IP provided)
  IF v_eligible AND p_client_ip IS NOT NULL THEN
    SELECT COUNT(*) INTO v_ip_count
    FROM waitlist
    WHERE client_ip = p_client_ip
      AND created_at > NOW() - (IP_BONUS_WINDOW_HOURS || ' hours')::INTERVAL;

    IF v_ip_count >= IP_BONUS_LIMIT THEN
      v_eligible := FALSE;
      v_reason := 'IP_RATE';
    END IF;
  END IF;

  -- ── INSERT the waitlist row ─────────────────────────────────────────
  BEGIN
    INSERT INTO waitlist (email, session_id, fingerprint_hash, client_ip)
    VALUES (p_email, p_session_id, p_fingerprint_hash, p_client_ip);
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'registered', false,
      'bonus', false,
      'reason', 'EMAIL_EXISTS'
    );
  END;

  -- ── Grant bonus if eligible ─────────────────────────────────────────
  IF v_eligible THEN
    UPDATE sessions
    SET max_limit = max_limit + 1
    WHERE id = p_session_id;

    RETURN jsonb_build_object(
      'registered', true,
      'bonus', true,
      'reason', NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'registered', true,
    'bonus', false,
    'reason', v_reason
  );
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;

-- Restrict execution to service_role only (bypasses RLS)
REVOKE ALL ON FUNCTION register_waitlist(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION register_waitlist(TEXT, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION register_waitlist(TEXT, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION register_waitlist(TEXT, UUID, TEXT, TEXT) TO service_role;
