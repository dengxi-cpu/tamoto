-- OC 主动提醒：在 Supabase Dashboard → SQL Editor 中执行一次
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL UNIQUE,
  device_secret_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  subscription JSONB NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  oc_name TEXT NOT NULL DEFAULT '小艾',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES push_subscriptions(device_id) ON DELETE CASCADE,
  time_local TIME NOT NULL,
  weekdays SMALLINT[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6]::SMALLINT[],
  timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  message_template TEXT NOT NULL DEFAULT '【占位消息】该开始今天的专注啦，我在番茄钟里等你。',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  reminder_id UUID REFERENCES reminder_rules(id) ON DELETE SET NULL,
  device_id UUID NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS reminder_rules_device_idx ON reminder_rules(device_id);
CREATE INDEX IF NOT EXISTS reminder_rules_enabled_idx ON reminder_rules(enabled);
CREATE INDEX IF NOT EXISTS push_subscriptions_enabled_idx ON push_subscriptions(enabled);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

-- 调度配置在 Vercel 环境变量就绪后执行。请替换 CRON_SECRET：
-- SELECT cron.schedule(
--   'tamoto-push-dispatch',
--   '* * * * *',
--   $$ SELECT net.http_post(
--     url := 'https://tamoto-main.vercel.app/api/reminders?action=dispatch',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer CRON_SECRET'
--     ),
--     body := '{}'::jsonb
--   ); $$
-- );
