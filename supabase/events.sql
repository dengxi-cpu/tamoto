-- 伴柠产品行为事件。可重复执行。
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  event TEXT NOT NULL,
  client_ts TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  focus_session_id TEXT,
  device_id TEXT,
  user_id UUID,
  ui TEXT NOT NULL DEFAULT 'classic',
  mode TEXT NOT NULL DEFAULT 'pomodoro',
  elapsed INT NOT NULL DEFAULT 0,
  policy_version TEXT,
  schema_version INT NOT NULL DEFAULT 1,
  sequence_no INT NOT NULL DEFAULT 0,
  props JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_events_name_time ON events(event, client_ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(focus_session_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_events_device_time ON events(device_id, client_ts DESC);

-- 浏览器不会直连此表；只允许使用服务端密钥的 /api/events 访问。
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
