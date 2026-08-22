-- =============================================================================
-- Sawwiq — Migration 005: Generation Metadata Support
-- Adds metadata JSONB column to generations table and updates persist_generation RPC
-- =============================================================================

-- 1. Add metadata column to generations table if not already present
ALTER TABLE generations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Update persist_generation RPC with metadata support (maintaining backward compatibility)
CREATE OR REPLACE FUNCTION persist_generation(
  p_session_id UUID,
  p_request_id UUID,
  p_prompt TEXT,
  p_platform TEXT,
  p_content_type TEXT,
  p_arabic_style TEXT,
  p_ai_response JSONB,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
BEGIN
  -- Lock session row for update to prevent race conditions
  SELECT generations_count, max_limit 
  INTO v_count, v_limit
  FROM sessions 
  WHERE id = p_session_id 
  FOR UPDATE;

  -- 1. Atomic rate limit check
  IF v_count >= v_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'RATE_LIMIT_REACHED');
  END IF;

  -- 2. Insert generation with idempotency check
  BEGIN
    INSERT INTO generations (
      session_id, request_id, prompt, platform, content_type, arabic_style, ai_response, metadata
    ) VALUES (
      p_session_id, p_request_id, p_prompt, p_platform, p_content_type, p_arabic_style, p_ai_response, COALESCE(p_metadata, '{}'::jsonb)
    );
  EXCEPTION WHEN unique_violation THEN
    -- If it already exists, just return current state without incrementing again
    RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - v_count);
  END;

  -- 3. Atomic increment
  UPDATE sessions 
  SET generations_count = generations_count + 1 
  WHERE id = p_session_id;

  RETURN jsonb_build_object('success', true, 'remainingGenerations', v_limit - (v_count + 1));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
