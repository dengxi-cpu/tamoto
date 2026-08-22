const crypto = require('crypto');
const webpush = require('web-push');
const { supabaseFetch, isReady } = require('./_supabase.js');

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
const cronSecret = process.env.CRON_SECRET || '';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function json(res, status, body) {
  return res.status(status).json(body);
}

async function parseResponse(response, label) {
  if (!response.ok) throw new Error(`${label}: ${response.status} ${await response.text()}`);
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

function validateDevice(deviceId, deviceSecret) {
  return UUID_RE.test(deviceId || '') && typeof deviceSecret === 'string' && deviceSecret.length >= 32;
}

async function authorizeDevice(deviceId, deviceSecret) {
  if (!validateDevice(deviceId, deviceSecret)) return false;
  const response = await supabaseFetch(
    `push_subscriptions?device_id=eq.${encodeURIComponent(deviceId)}&select=device_secret_hash&limit=1`,
  );
  const rows = await parseResponse(response, '读取设备失败');
  if (!rows.length) return false;
  const expected = Buffer.from(rows[0].device_secret_hash, 'hex');
  const actual = Buffer.from(hashSecret(deviceSecret), 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function localMinute(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  const weekdays = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: weekdays[parts.weekday]
  };
}

async function subscribe(req, res) {
  const { deviceId, deviceSecret, subscription, timezone, ocName } = req.body || {};
  if (!validateDevice(deviceId, deviceSecret) || !subscription?.endpoint || !subscription?.keys) {
    return json(res, 400, { success: false, error: '无效的设备或推送订阅' });
  }
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { return json(res, 400, { success: false, error: '无效时区' }); }

  const response = await supabaseFetch('push_subscriptions?on_conflict=device_id', {
    method: 'POST',
    body: JSON.stringify({
      device_id: deviceId,
      device_secret_hash: hashSecret(deviceSecret),
      endpoint: subscription.endpoint,
      subscription,
      timezone,
      oc_name: String(ocName || '小艾').slice(0, 30),
      enabled: true,
      last_seen_at: new Date().toISOString()
    }),
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
  });
  await parseResponse(response, '保存订阅失败');
  return json(res, 200, { success: true });
}

async function getRules(req, res) {
  const { deviceId, deviceSecret } = req.query || {};
  if (!await authorizeDevice(deviceId, deviceSecret)) return json(res, 401, { success: false, error: '设备验证失败' });
  const response = await supabaseFetch(
    `reminder_rules?device_id=eq.${encodeURIComponent(deviceId)}&select=id,time_local,weekdays,timezone,enabled,message_template&order=time_local.asc`,
  );
  const rules = await parseResponse(response, '读取提醒失败');
  return json(res, 200, { success: true, rules });
}

async function saveRules(req, res) {
  const { deviceId, deviceSecret, rules } = req.body || {};
  if (!await authorizeDevice(deviceId, deviceSecret)) return json(res, 401, { success: false, error: '设备验证失败' });
  if (!Array.isArray(rules) || rules.length > 10) return json(res, 400, { success: false, error: '提醒数量无效' });

  const normalized = rules.map(rule => ({
    device_id: deviceId,
    time_local: rule.time,
    weekdays: Array.isArray(rule.weekdays) ? [...new Set(rule.weekdays.map(Number))] : [],
    timezone: rule.timezone,
    enabled: rule.enabled !== false,
    message_template: String(rule.message || '【占位消息】该开始今天的专注啦，我在番茄钟里等你。').slice(0, 160)
  }));
  if (normalized.some(rule => !TIME_RE.test(rule.time_local) || !rule.weekdays.length || rule.weekdays.some(day => day < 0 || day > 6))) {
    return json(res, 400, { success: false, error: '提醒时间或重复日期无效' });
  }
  for (const rule of normalized) {
    try { new Intl.DateTimeFormat('en', { timeZone: rule.timezone }).format(); }
    catch { return json(res, 400, { success: false, error: '无效时区' }); }
  }

  await parseResponse(await supabaseFetch(`reminder_rules?device_id=eq.${encodeURIComponent(deviceId)}`, {
    method: 'DELETE', headers: { 'Prefer': 'return=minimal' }
  }), '清理旧提醒失败');
  if (normalized.length) {
    await parseResponse(await supabaseFetch('reminder_rules', {
      method: 'POST', body: JSON.stringify(normalized), headers: { 'Prefer': 'return=minimal' }
    }), '保存提醒失败');
  }
  return json(res, 200, { success: true, count: normalized.length });
}

async function dispatch(req, res) {
  const authorization = req.headers.authorization || '';
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) return json(res, 401, { success: false, error: 'Unauthorized' });
  if (!publicKey || !privateKey) return json(res, 503, { success: false, error: 'VAPID 未配置' });
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const subscriptions = await parseResponse(await supabaseFetch(
    'push_subscriptions?enabled=eq.true&select=device_id,subscription,timezone,oc_name'
  ), '读取订阅失败');
  const rules = await parseResponse(await supabaseFetch(
    'reminder_rules?enabled=eq.true&select=id,device_id,time_local,weekdays,timezone,message_template'
  ), '读取提醒失败');
  const subscriptionMap = new Map(subscriptions.map(item => [item.device_id, item]));
  const now = new Date();
  let sent = 0;
  let failed = 0;

  for (const rule of rules.slice(0, 100)) {
    const device = subscriptionMap.get(rule.device_id);
    if (!device) continue;
    let local;
    try { local = localMinute(now, rule.timezone || device.timezone); }
    catch { continue; }
    if (local.time !== String(rule.time_local).slice(0, 5) || !rule.weekdays.includes(local.weekday)) continue;

    const eventKey = `${rule.id}:${local.date}:${local.time}`;
    const claim = await parseResponse(await supabaseFetch('notification_deliveries?on_conflict=event_key', {
      method: 'POST',
      body: JSON.stringify({ event_key: eventKey, reminder_id: rule.id, device_id: rule.device_id, status: 'sending' }),
      headers: { 'Prefer': 'resolution=ignore-duplicates,return=representation' }
    }), '创建发送记录失败');
    if (!claim.length) continue;

    try {
      await webpush.sendNotification(device.subscription, JSON.stringify({
        title: device.oc_name || '伴柠番茄钟',
        body: rule.message_template,
        icon: '/icons/icon-192.png', badge: '/icons/icon-120.png',
        tag: `oc-reminder-${rule.id}`,
        url: '/?page=focus&source=reminder'
      }), { TTL: 300 });
      sent++;
      await supabaseFetch(`notification_deliveries?event_key=eq.${encodeURIComponent(eventKey)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }), headers: { 'Prefer': 'return=minimal' }
      });
    } catch (error) {
      failed++;
      await supabaseFetch(`notification_deliveries?event_key=eq.${encodeURIComponent(eventKey)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'failed', error: String(error.message).slice(0, 300) }), headers: { 'Prefer': 'return=minimal' }
      });
      if (error.statusCode === 404 || error.statusCode === 410) {
        await supabaseFetch(`push_subscriptions?device_id=eq.${encodeURIComponent(rule.device_id)}`, {
          method: 'PATCH', body: JSON.stringify({ enabled: false }), headers: { 'Prefer': 'return=minimal' }
        });
      }
    }
  }
  return json(res, 200, { success: true, sent, failed, checked: rules.length });
}

async function handler(req, res) {
  if (!isReady) return json(res, 503, { success: false, error: 'Supabase 尚未配置' });
  try {
    const action = String((req.query && req.query.action) || (req.body && req.body.action) || '');
    if (action === 'dispatch') return dispatch(req, res);
    if (action === 'subscribe' && req.method === 'POST') return subscribe(req, res);
    if (action === 'rules' && req.method === 'GET') return getRules(req, res);
    if (action === 'rules' && req.method === 'POST') return saveRules(req, res);
    return json(res, 400, { success: false, error: '未知操作' });
  } catch (error) {
    console.error('Reminder API 错误:', error.message);
    return json(res, 500, { success: false, error: '提醒服务暂时不可用' });
  }
}

module.exports = handler;
