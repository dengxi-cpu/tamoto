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
    `reminder_rules?device_id=eq.${encodeURIComponent(deviceId)}&reminder_type=eq.recurring&select=id,time_local,weekdays,timezone,enabled,message_template&order=time_local.asc`,
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

  await parseResponse(await supabaseFetch(`reminder_rules?device_id=eq.${encodeURIComponent(deviceId)}&reminder_type=eq.recurring`, {
    method: 'DELETE', headers: { 'Prefer': 'return=minimal' }
  }), '清理旧提醒失败');
  if (normalized.length) {
    await parseResponse(await supabaseFetch('reminder_rules', {
      method: 'POST', body: JSON.stringify(normalized), headers: { 'Prefer': 'return=minimal' }
    }), '保存提醒失败');
  }
  return json(res, 200, { success: true, count: normalized.length });
}

async function createOneOff(req, res) {
  const { deviceId, deviceSecret, title, scheduledAt, timezone } = req.body || {};
  if (!await authorizeDevice(deviceId, deviceSecret)) {
    return json(res, 401, { success: false, error: '请先开启系统通知，再创建提醒' });
  }
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(); }
  catch { return json(res, 400, { success: false, error: '无效时区' }); }

  const scheduled = new Date(scheduledAt);
  const now = new Date();
  if (Number.isNaN(scheduled.getTime()) || scheduled <= now) {
    return json(res, 400, { success: false, error: '提醒时间必须晚于当前时间' });
  }
  if (scheduled.getTime() > now.getTime() + 366 * 24 * 60 * 60 * 1000) {
    return json(res, 400, { success: false, error: '暂时只能创建一年内的提醒' });
  }
  const cleanTitle = String(title || '').trim().slice(0, 80);
  if (!cleanTitle) return json(res, 400, { success: false, error: '提醒事项不能为空' });

  const local = localMinute(scheduled, timezone);
  const response = await supabaseFetch('reminder_rules', {
    method: 'POST',
    body: JSON.stringify({
      device_id: deviceId,
      time_local: local.time,
      weekdays: [local.weekday],
      timezone,
      enabled: true,
      message_template: cleanTitle,
      reminder_type: 'one_off',
      scheduled_at: scheduled.toISOString()
    }),
    headers: { 'Prefer': 'return=representation' }
  });
  const rows = await parseResponse(response, '创建提醒失败');
  return json(res, 201, {
    success: true,
    reminder: { id: rows[0]?.id, title: cleanTitle, scheduledAt: scheduled.toISOString(), timezone }
  });
}

async function getMessages(req, res) {
  const { deviceId, deviceSecret } = req.query || {};
  if (!await authorizeDevice(deviceId, deviceSecret)) {
    return json(res, 401, { success: false, error: '设备验证失败' });
  }
  const response = await supabaseFetch(
    `oc_messages?device_id=eq.${encodeURIComponent(deviceId)}&select=id,content,message_type,created_at,read_at&order=created_at.asc&limit=50`
  );
  const messages = await parseResponse(response, '读取 OC 消息失败');
  return json(res, 200, { success: true, messages });
}

async function markMessagesRead(req, res) {
  const { deviceId, deviceSecret, messageIds } = req.body || {};
  if (!await authorizeDevice(deviceId, deviceSecret)) {
    return json(res, 401, { success: false, error: '设备验证失败' });
  }
  const ids = Array.isArray(messageIds) ? messageIds.filter(id => UUID_RE.test(id)).slice(0, 100) : [];
  if (!ids.length) return json(res, 200, { success: true, count: 0 });
  const encodedIds = ids.join(',');
  await parseResponse(await supabaseFetch(
    `oc_messages?device_id=eq.${encodeURIComponent(deviceId)}&id=in.(${encodeURIComponent(encodedIds)})`,
    {
      method: 'PATCH',
      body: JSON.stringify({ read_at: new Date().toISOString() }),
      headers: { 'Prefer': 'return=minimal' }
    }
  ), '更新消息状态失败');
  return json(res, 200, { success: true, count: ids.length });
}

async function registerFocusAway(req, res) {
  const { deviceId, deviceSecret, awayKey } = req.body || {};
  if (!await authorizeDevice(deviceId, deviceSecret)) {
    return json(res, 401, { success: false, error: '设备验证失败' });
  }
  if (!UUID_RE.test(awayKey || '')) return json(res, 400, { success: false, error: '无效离开事件' });
  const now = new Date();
  const response = await supabaseFetch('focus_away_events?on_conflict=away_key', {
    method: 'POST',
    body: JSON.stringify({
      away_key: awayKey,
      device_id: deviceId,
      left_at: now.toISOString(),
      notify_after: new Date(now.getTime() + 15 * 1000).toISOString(),
      status: 'pending'
    }),
    headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' }
  });
  await parseResponse(response, '记录离开状态失败');
  return json(res, 202, { success: true, notifyAfter: new Date(now.getTime() + 15 * 1000).toISOString() });
}

async function registerFocusReturn(req, res) {
  const { deviceId, deviceSecret, awayKey } = req.body || {};
  if (!await authorizeDevice(deviceId, deviceSecret)) {
    return json(res, 401, { success: false, error: '设备验证失败' });
  }
  if (!UUID_RE.test(awayKey || '')) return json(res, 400, { success: false, error: '无效离开事件' });
  const response = await supabaseFetch(
    `focus_away_events?device_id=eq.${encodeURIComponent(deviceId)}&away_key=eq.${encodeURIComponent(awayKey)}&status=eq.pending`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', returned_at: new Date().toISOString() }),
      headers: { 'Prefer': 'return=minimal' }
    }
  );
  await parseResponse(response, '更新返回状态失败');
  return json(res, 200, { success: true });
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
    'reminder_rules?enabled=eq.true&select=id,device_id,time_local,weekdays,timezone,message_template,reminder_type,scheduled_at'
  ), '读取提醒失败');
  const subscriptionMap = new Map(subscriptions.map(item => [item.device_id, item]));
  const now = new Date();
  let sent = 0;
  let failed = 0;

  for (const rule of rules.slice(0, 100)) {
    const device = subscriptionMap.get(rule.device_id);
    if (!device) continue;
    const isOneOff = rule.reminder_type === 'one_off';
    let local;
    try { local = localMinute(now, rule.timezone || device.timezone); }
    catch { continue; }
    if (isOneOff) {
      const scheduledTime = new Date(rule.scheduled_at).getTime();
      const delay = now.getTime() - scheduledTime;
      if (!Number.isFinite(scheduledTime) || delay < 0 || delay > 15 * 60 * 1000) continue;
    } else if (local.time !== String(rule.time_local).slice(0, 5) || !rule.weekdays.includes(local.weekday)) {
      continue;
    }

    const eventKey = isOneOff ? `${rule.id}:one-off` : `${rule.id}:${local.date}:${local.time}`;
    const claim = await parseResponse(await supabaseFetch('notification_deliveries?on_conflict=event_key', {
      method: 'POST',
      body: JSON.stringify({ event_key: eventKey, reminder_id: rule.id, device_id: rule.device_id, status: 'sending' }),
      headers: { 'Prefer': 'resolution=ignore-duplicates,return=representation' }
    }), '创建发送记录失败');
    if (!claim.length) continue;

    try {
      const messageRows = await parseResponse(await supabaseFetch('oc_messages?on_conflict=event_key', {
        method: 'POST',
        body: JSON.stringify({
          event_key: eventKey,
          device_id: rule.device_id,
          reminder_id: rule.id,
          content: rule.message_template,
          message_type: 'reminder'
        }),
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }
      }), '保存 OC 消息失败');
      const messageId = messageRows[0]?.id;
      await webpush.sendNotification(device.subscription, JSON.stringify({
        title: device.oc_name || '伴柠番茄钟',
        body: rule.message_template,
        icon: '/icons/icon-192.png', badge: '/icons/icon-120.png',
        tag: `oc-reminder-${rule.id}`,
        messageId,
        url: `/?page=chat&source=reminder${messageId ? `&message=${messageId}` : ''}`
      }), { TTL: 300 });
      sent++;
      await supabaseFetch(`notification_deliveries?event_key=eq.${encodeURIComponent(eventKey)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }), headers: { 'Prefer': 'return=minimal' }
      });
      if (isOneOff) {
        await supabaseFetch(`reminder_rules?id=eq.${encodeURIComponent(rule.id)}`, {
          method: 'PATCH', body: JSON.stringify({ enabled: false }), headers: { 'Prefer': 'return=minimal' }
        });
      }
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

  const recentCutoff = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const recentAwayEvents = await parseResponse(await supabaseFetch(
    `focus_away_events?status=eq.sent&notified_at=gte.${encodeURIComponent(recentCutoff)}&select=device_id`
  ), '读取近期离开提醒失败');
  const recentlyNotifiedDevices = new Set(recentAwayEvents.map(item => item.device_id));
  const awayEvents = await parseResponse(await supabaseFetch(
    `focus_away_events?status=eq.pending&notify_after=lte.${encodeURIComponent(now.toISOString())}&select=id,away_key,device_id&order=notify_after.asc&limit=100`
  ), '读取离开状态失败');

  for (const away of awayEvents) {
    const device = subscriptionMap.get(away.device_id);
    if (!device) continue;
    if (recentlyNotifiedDevices.has(away.device_id)) {
      await supabaseFetch(`focus_away_events?id=eq.${encodeURIComponent(away.id)}&status=eq.pending`, {
        method: 'PATCH', body: JSON.stringify({ status: 'suppressed' }), headers: { 'Prefer': 'return=minimal' }
      });
      continue;
    }

    const eventKey = `focus-away:${away.away_key}`;
    const claim = await parseResponse(await supabaseFetch('notification_deliveries?on_conflict=event_key', {
      method: 'POST',
      body: JSON.stringify({ event_key: eventKey, device_id: away.device_id, status: 'sending' }),
      headers: { 'Prefer': 'resolution=ignore-duplicates,return=representation' }
    }), '创建离开提醒发送记录失败');
    if (!claim.length) continue;

    const content = '离开有一会儿了。是临时有事吗？处理完就回来，我还在等你继续。';
    try {
      const messageRows = await parseResponse(await supabaseFetch('oc_messages?on_conflict=event_key', {
        method: 'POST',
        body: JSON.stringify({
          event_key: eventKey,
          device_id: away.device_id,
          content,
          message_type: 'focus_away'
        }),
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' }
      }), '保存离开提醒消息失败');
      const messageId = messageRows[0]?.id;
      await webpush.sendNotification(device.subscription, JSON.stringify({
        title: device.oc_name || '伴柠番茄钟',
        body: content,
        icon: '/icons/icon-192.png', badge: '/icons/icon-120.png',
        tag: `oc-focus-away-${away.away_key}`,
        messageId,
        url: `/?page=focus&source=focus-away${messageId ? `&message=${messageId}` : ''}`
      }), { TTL: 300 });
      sent++;
      recentlyNotifiedDevices.add(away.device_id);
      await supabaseFetch(`focus_away_events?id=eq.${encodeURIComponent(away.id)}&status=eq.pending`, {
        method: 'PATCH', body: JSON.stringify({ status: 'sent', notified_at: new Date().toISOString() }), headers: { 'Prefer': 'return=minimal' }
      });
      await supabaseFetch(`notification_deliveries?event_key=eq.${encodeURIComponent(eventKey)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: new Date().toISOString() }), headers: { 'Prefer': 'return=minimal' }
      });
    } catch (error) {
      failed++;
      await supabaseFetch(`notification_deliveries?event_key=eq.${encodeURIComponent(eventKey)}`, {
        method: 'PATCH', body: JSON.stringify({ status: 'failed', error: String(error.message).slice(0, 300) }), headers: { 'Prefer': 'return=minimal' }
      });
    }
  }
  return json(res, 200, { success: true, sent, failed, checked: rules.length + awayEvents.length });
}

async function handler(req, res) {
  if (!isReady) return json(res, 503, { success: false, error: 'Supabase 尚未配置' });
  try {
    const action = String((req.query && req.query.action) || (req.body && req.body.action) || '');
    if (action === 'dispatch') return dispatch(req, res);
    if (action === 'subscribe' && req.method === 'POST') return subscribe(req, res);
    if (action === 'rules' && req.method === 'GET') return getRules(req, res);
    if (action === 'rules' && req.method === 'POST') return saveRules(req, res);
    if (action === 'one-off' && req.method === 'POST') return createOneOff(req, res);
    if (action === 'messages' && req.method === 'GET') return getMessages(req, res);
    if (action === 'messages-read' && req.method === 'POST') return markMessagesRead(req, res);
    if (action === 'focus-away' && req.method === 'POST') return registerFocusAway(req, res);
    if (action === 'focus-return' && req.method === 'POST') return registerFocusReturn(req, res);
    return json(res, 400, { success: false, error: '未知操作' });
  } catch (error) {
    console.error('Reminder API 错误:', error.message);
    return json(res, 500, { success: false, error: '提醒服务暂时不可用' });
  }
}

module.exports = handler;
