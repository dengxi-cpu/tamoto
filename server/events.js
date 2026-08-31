const { isReady, supabaseFetch } = require('../api/_supabase.js');

const EVENT_NAMES = new Set(['focus_page_view','focus_start_attempt','focus_start_blocked','focus_session_start','focus_pause','focus_resume','focus_session_end','focus_away','focus_return','ai_decision','ai_speech_started','ai_speech_ended','user_interaction','camera_toggle','client_error','network_status','beta_action']);
const MAX_BATCH = 50;

function text(value, max = 120) { return typeof value === 'string' ? value.slice(0, max) : null; }
function number(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function cleanProps(props) {
  if (!props || typeof props !== 'object' || Array.isArray(props)) return {};
  const out = {};
  Object.entries(props).slice(0, 40).forEach(([key, value]) => {
    if (typeof value === 'string') out[key.slice(0, 60)] = value.slice(0, 120);
    else if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) out[key.slice(0, 60)] = value;
  });
  return out;
}
function toRow(item) {
  if (!item || !EVENT_NAMES.has(item.event) || !text(item.event_id, 80)) return null;
  const parsedTs = Date.parse(item.client_ts);
  return {
    event_id: text(item.event_id, 80), event: item.event, client_ts: Number.isFinite(parsedTs) ? new Date(parsedTs).toISOString() : new Date().toISOString(),
    focus_session_id: text(item.focus_session_id, 80), device_id: text(item.device_id, 80),
    user_id: /^[0-9a-f-]{36}$/i.test(item.user_id || '') ? item.user_id : null,
    ui: item.ui === 'beta' ? 'beta' : 'classic', mode: item.mode === 'timer' ? 'timer' : 'pomodoro',
    elapsed: Math.max(0, Math.round(number(item.elapsed) || 0)), policy_version: text(item.policy_version, 40),
    schema_version: Math.max(1, Math.round(number(item.schema_version) || 1)), sequence_no: Math.max(0, Math.round(number(item.sequence_no) || 0)),
    props: cleanProps(item.props)
  };
}

async function handler(req, res) {
  if (!isReady) return res.status(503).json({ success: false, error: 'Supabase 尚未配置' });
  try {
    if (req.method === 'POST') {
      const input = Array.isArray(req.body?.events) ? req.body.events.slice(0, MAX_BATCH) : [];
      const rows = input.map(toRow).filter(Boolean);
      if (!rows.length) return res.status(400).json({ success: false, error: '没有有效事件' });
      const response = await supabaseFetch('events?on_conflict=event_id', {
        method: 'POST', body: JSON.stringify(rows), headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }
      });
      if (!response.ok) throw new Error(`写入事件失败: ${response.status} ${await response.text()}`);
      return res.status(200).json({ success: true, accepted: rows.length });
    }
    if (req.method === 'GET') {
      const expected = process.env.EVENTS_DASHBOARD_KEY || '';
      const supplied = req.headers['x-dashboard-key'] || req.query?.key || '';
      if (expected && supplied !== expected) return res.status(401).json({ success: false, error: '工作台访问密码不正确' });
      const days = Math.min(90, Math.max(1, Number(req.query?.days) || 7));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const response = await supabaseFetch(`events?select=event,event_id,client_ts,received_at,focus_session_id,device_id,ui,mode,elapsed,policy_version,props&client_ts=gte.${encodeURIComponent(since)}&order=client_ts.desc&limit=5000`);
      if (!response.ok) throw new Error(`读取事件失败: ${response.status} ${await response.text()}`);
      return res.status(200).json({ success: true, data: await response.json(), days });
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Events error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { default: handler, handler };
