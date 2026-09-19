-- =============================================================================
-- Phase 5 Part 1 — Backend Rectification for Generation History
--
-- 1. Partial index on generations(user_id) for user-scoped history queries.
--    WHERE user_id IS NOT NULL keeps the index small: anonymous session rows
--    (the majority) are never indexed; only logged-in users' rows are.
-- 2. persist_generation gains p_user_id (DEFAULT NULL) so the Edge Function can
--    attribute rows at insert time — no more retroactive merge lag.
--    A new parameter = a new signature in Postgres, so the old function is
--    dropped first (data untouched — DROP FUNCTION never touches table rows).
-- 3. No RLS policy changes: reads stay service_role-only via API routes.
-- =============================================================================

-- ── 1. Partial index ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_generations_user_created
    ON generations(user_id, created_at DESC)
    WHERE user_id IS NOT NULL;


-- ── 2. persist_generation with instant user attribution ──────────────────────
-- Body is identical to 20260830000000 (steps 0-6) except the INSERT now writes
-- user_id. Old 8-arg signature is dropped; existing callers use named notation
-- and keep working (new param has a DEFAULT).
DROP FUNCTION IF EXISTS persist_generation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB);

CREATE FUNCTION persist_generation(
    p_session_id   UUID,
    p_request_id   UUID,
    p_prompt       TEXT,
    p_platform     TEXT,
    p_content_type TEXT,
    p_arabic_style TEXT,
    p_ai_response  JSONB,
    p_metadata     JSONB DEFAULT '{}',
    p_user_id      UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
    v_limit INTEGER;
BEGIN
    -- 0. Reject null request_id — column is NOT NULL + guard = two layers
    IF p_request_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'REQUEST_ID_REQUIRED');
    END IF;

    -- 1. Lock the session row to prevent concurrent-request races
    SELECT generations_count, max_limit
    INTO v_count, v_limit
    FROM sessions
    WHERE id = p_session_id
    FOR UPDATE;

    -- 2. Session must exist
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'SESSION_NOT_FOUND');
    END IF;

    -- 3. Idempotency BEFORE rate limit: a retry of a finished request succeeds
    --    even if the session exhausted its limit afterwards
    IF EXISTS (SELECT 1 FROM generations WHERE request_id = p_request_id) THEN
        RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - v_count);
    END IF;

    -- 4. Rate limit (only for genuinely new requests)
    IF v_count >= v_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMIT_REACHED');
    END IF;

    -- 5. Persist — unique_violation covers a narrow concurrent-insert race
    BEGIN
        INSERT INTO generations (
            session_id, request_id, prompt, platform, content_type, arabic_style, ai_response, metadata, user_id
        ) VALUES (
            p_session_id, p_request_id, p_prompt, p_platform, p_content_type,
            p_arabic_style, p_ai_response, COALESCE(p_metadata, '{}'), p_user_id
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - v_count);
    END;

    -- 6. Atomically bump the session counter
    UPDATE sessions
    SET generations_count = generations_count + 1
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - (v_count + 1));
END;
$$;


-- ── 3. Grants for the new signature (DROP removed the old ones) ─────────────
REVOKE ALL ON FUNCTION persist_generation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, UUID)
    FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION persist_generation(UUID, UUID, TEXT, TEXT, TEXT, TEXT, JSONB, JSONB, UUID)
    TO service_role;
