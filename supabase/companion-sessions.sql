CREATE TABLE IF NOT EXISTS companion_sessions (
  session_id TEXT PRIMARY KEY,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  state_version INTEGER NOT NULL DEFAULT 1,
  last_turn_id BIGINT,
  last_turn_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_companion_sessions_expires_at
  ON companion_sessions(expires_at);

ALTER TABLE companion_sessions ENABLE ROW LEVEL SECURITY;

-- Server requests use SUPABASE_SERVICE_ROLE_KEY and bypass RLS.
-- No anonymous browser policy is intentionally created.
