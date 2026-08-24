-- 自然语言单次提醒迁移
-- 在 Supabase Dashboard -> SQL Editor 中执行一次；可安全重复执行。

ALTER TABLE reminder_rules
  ADD COLUMN IF NOT EXISTS reminder_type TEXT NOT NULL DEFAULT 'recurring';

ALTER TABLE reminder_rules
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

DO $$ BEGIN
  ALTER TABLE reminder_rules ADD CONSTRAINT reminder_rules_type_check
    CHECK (reminder_type IN ('recurring', 'one_off')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS reminder_rules_scheduled_idx
  ON reminder_rules(scheduled_at)
  WHERE enabled = TRUE AND reminder_type = 'one_off';

CREATE TABLE IF NOT EXISTS oc_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  device_id UUID NOT NULL REFERENCES push_subscriptions(device_id) ON DELETE CASCADE,
  reminder_id UUID REFERENCES reminder_rules(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'reminder',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS oc_messages_device_created_idx
  ON oc_messages(device_id, created_at DESC);

ALTER TABLE oc_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS focus_away_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  away_key UUID NOT NULL UNIQUE,
  device_id UUID NOT NULL REFERENCES push_subscriptions(device_id) ON DELETE CASCADE,
  left_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notify_after TIMESTAMPTZ NOT NULL,
  returned_at TIMESTAMPTZ,
  notified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'cancelled', 'sent', 'suppressed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS focus_away_pending_idx
  ON focus_away_events(notify_after)
  WHERE status = 'pending';

ALTER TABLE focus_away_events ENABLE ROW LEVEL SECURITY;
