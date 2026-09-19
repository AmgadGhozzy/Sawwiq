-- ── 1. Link sessions to future auth users ────────────────────────────────────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ── 2. Credit balance per user ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_credits (
  user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance          INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_earned  INTEGER NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS user_credits_updated_at ON user_credits;
CREATE TRIGGER user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 3. Full audit ledger ────────────────────────────────────────────────────
-- amount <> 0: prevents zero-value no-op rows.
-- reason is TEXT (not CHECK): flexible for future economics; validation in RPCs.
CREATE TABLE IF NOT EXISTS credit_transactions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount                INTEGER     NOT NULL CHECK (amount <> 0),
  reason                TEXT        NOT NULL,
  idempotency_key       TEXT        UNIQUE,
  generation_request_id UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_txn_user_created
  ON credit_transactions(user_id, created_at DESC);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE user_credits        ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_credits"
  ON user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_read_own_transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- ── 5. RPCs ──────────────────────────────────────────────────────────────────

-- award_credits: idempotent credit award (signup bonus, refill, etc.)
-- INSERT is the arbitration point. Ownership checked on conflict.
CREATE OR REPLACE FUNCTION award_credits(
  p_user_id         UUID,
  p_amount          INTEGER,
  p_reason          TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance   INTEGER;
  v_inserted_id   UUID;
  v_existing_user UUID;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_AMOUNT');
  END IF;

  INSERT INTO credit_transactions (user_id, amount, reason, idempotency_key)
  VALUES (p_user_id, p_amount, p_reason, p_idempotency_key)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT user_id INTO v_existing_user
    FROM credit_transactions WHERE idempotency_key = p_idempotency_key;
    IF v_existing_user = p_user_id THEN
      SELECT balance INTO v_new_balance FROM user_credits WHERE user_id = p_user_id;
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'balance', COALESCE(v_new_balance, 0));
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'IDEMPOTENCY_KEY_CONFLICT');
    END IF;
  END IF;

  INSERT INTO user_credits (user_id, balance, lifetime_earned)
  VALUES (p_user_id, p_amount, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance         = user_credits.balance + p_amount,
        lifetime_earned = user_credits.lifetime_earned + p_amount;

  SELECT balance INTO v_new_balance FROM user_credits WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'duplicate', false, 'balance', v_new_balance);
END;
$$;

-- deduct_credit: atomic credit deduction per generation.
-- Locks balance row first, then arbitrates on idempotency key.
CREATE OR REPLACE FUNCTION deduct_credit(
  p_user_id     UUID,
  p_request_id  UUID,
  p_credit_cost INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_idem_key      TEXT := 'generation:' || p_request_id::text;
  v_balance       INTEGER;
  v_inserted_id   UUID;
  v_existing_user UUID;
BEGIN
  IF p_credit_cost <= 0 OR p_credit_cost > 100 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_CREDIT_COST');
  END IF;

  SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id FOR UPDATE;

  IF NOT FOUND OR v_balance < p_credit_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_CREDITS', 'balance', COALESCE(v_balance, 0));
  END IF;

  INSERT INTO credit_transactions (user_id, amount, reason, idempotency_key, generation_request_id)
  VALUES (p_user_id, -p_credit_cost, 'generation', v_idem_key, p_request_id)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT user_id INTO v_existing_user FROM credit_transactions WHERE idempotency_key = v_idem_key;
    IF v_existing_user = p_user_id THEN
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'balance', v_balance);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'IDEMPOTENCY_KEY_CONFLICT');
    END IF;
  END IF;

  UPDATE user_credits SET balance = balance - p_credit_cost WHERE user_id = p_user_id;
  SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

-- refund_credit: idempotent refund of a failed generation.
-- Verifies original deduction belongs to same user before refunding.
CREATE OR REPLACE FUNCTION refund_credit(
  p_user_id    UUID,
  p_request_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gen_idem_key    TEXT := 'generation:' || p_request_id::text;
  v_refund_idem_key TEXT := 'refund:generation:' || p_request_id::text;
  v_balance         INTEGER;
  v_deducted_amount INTEGER;
  v_inserted_id     UUID;
  v_existing_user   UUID;
BEGIN
  SELECT ABS(amount) INTO v_deducted_amount
  FROM credit_transactions
  WHERE idempotency_key = v_gen_idem_key AND user_id = p_user_id AND amount < 0;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_REFUND_OR_NOT_OWNER');
  END IF;

  INSERT INTO credit_transactions (user_id, amount, reason, idempotency_key, generation_request_id)
  VALUES (p_user_id, v_deducted_amount, 'generation_refund', v_refund_idem_key, p_request_id)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NULL THEN
    SELECT user_id INTO v_existing_user FROM credit_transactions WHERE idempotency_key = v_refund_idem_key;
    IF v_existing_user = p_user_id THEN
      SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id;
      RETURN jsonb_build_object('success', true, 'duplicate', true, 'balance', v_balance);
    ELSE
      RETURN jsonb_build_object('success', false, 'error', 'IDEMPOTENCY_KEY_CONFLICT');
    END IF;
  END IF;

  UPDATE user_credits SET balance = balance + v_deducted_amount WHERE user_id = p_user_id;
  SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id;
  RETURN jsonb_build_object('success', true, 'balance', v_balance);
END;
$$;

-- get_credit_balance: read-only balance lookup for API routes
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance FROM user_credits WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('balance', 0, 'exists', false);
  END IF;
  RETURN jsonb_build_object('balance', v_balance, 'exists', true);
END;
$$;

-- ── 6. Grants ─────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION award_credits(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION award_credits(UUID, INTEGER, TEXT, TEXT) TO service_role;

REVOKE ALL ON FUNCTION deduct_credit(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION deduct_credit(UUID, UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION refund_credit(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION refund_credit(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION get_credit_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_credit_balance(UUID) TO service_role;

-- ── 7. claim_and_merge_session ───────────────────────────────────────────────
-- Atomic session ownership claim + anonymous generation migration.
--
-- Replaces the non-atomic two-step UPDATE pattern in the application layer.
-- Uses SELECT … FOR UPDATE to serialize concurrent claims on the same session
-- token so that only one caller can win the claim; all others get a clear
-- deterministic result back.
--
-- Return shapes:
--   { success: true,  merged: true }                    → claimed + gens migrated
--   { success: true,  merged: false, reason: "ALREADY_OWNED" }  → idempotent
--   { success: true,  merged: false, reason: "SESSION_NOT_FOUND" } → no-op OK
--   { success: false, error: "SESSION_ALREADY_LINKED" }  → owned by another user
CREATE OR REPLACE FUNCTION claim_and_merge_session(
  p_user_id       UUID,
  p_session_token TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id UUID;
  v_owner_id   UUID;
BEGIN
  -- Lock the session row to serialise concurrent claim attempts.
  -- Any second caller with the same token blocks here until this
  -- transaction commits, then reads the updated user_id.
  SELECT id, user_id
    INTO v_session_id, v_owner_id
    FROM sessions
   WHERE session_token = p_session_token
     FOR UPDATE;

  IF NOT FOUND THEN
    -- No matching session — nothing to merge, not an error.
    RETURN jsonb_build_object('success', true, 'merged', false, 'reason', 'SESSION_NOT_FOUND');
  END IF;

  -- Another user has already claimed this session.
  IF v_owner_id IS NOT NULL AND v_owner_id <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'SESSION_ALREADY_LINKED');
  END IF;

  -- Claim (or re-confirm) the session and ensure the anonymous rate limit is
  -- bypassed. Running this UPDATE even for ALREADY_OWNED sessions is intentional:
  -- it self-heals sessions that were claimed before max_limit was applied
  -- (e.g. user hit the free limit, then signed in).
  UPDATE sessions
     SET user_id   = p_user_id,
         max_limit = 2147483647
   WHERE id = v_session_id;

  -- Migrate all still-anonymous generations within the same transaction.
  -- Rows already assigned to a user (user_id IS NOT NULL) are left untouched.
  UPDATE generations
     SET user_id = p_user_id
   WHERE session_id = v_session_id
     AND user_id IS NULL;

  IF v_owner_id = p_user_id THEN
    RETURN jsonb_build_object('success', true, 'merged', false, 'reason', 'ALREADY_OWNED');
  END IF;

  RETURN jsonb_build_object('success', true, 'merged', true);
END;
$$;

REVOKE ALL ON FUNCTION claim_and_merge_session(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION claim_and_merge_session(UUID, TEXT) TO service_role;
