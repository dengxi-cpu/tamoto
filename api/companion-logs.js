const { isReady, supabaseFetch } = require('./_supabase.js');

const RETENTION_HOURS = 24;
const MAX_ROWS = 100;

function eventKey(epoch, turnId, source = 'pomodoro') {
  return `${source}:${Number(epoch) || 1}:${Number(turnId) || 1}`;
}

async function upsertCompanionLog(data) {
  if (!isReady) throw new Error('Supabase 尚未配置');
  const now = new Date().toISOString();
  const row = {
    event_key: eventKey(data.epoch, data.turnId, data.source || 'pomodoro'),
    source: data.source || 'pomodoro',
    session_epoch: Number(data.epoch) || 1,
    turn_id: Number(data.turnId) || 1,
    captured_image: data.image || null,
    task: data.task || null,
    persona: data.persona || null,
    scene: data.scene || null,
    reaction: data.reaction || null,
    vision_ms: Number.isFinite(data.visionMs) ? data.visionMs : null,
    reaction_ms: Number.isFinite(data.reactionMs) ? data.reactionMs : null,
    total_ms: Number.isFinite(data.totalMs) ? data.totalMs : null,
    request_ms: Number.isFinite(data.requestMs) ? data.requestMs : null,
    tts_status: data.ttsStatus || 'pending',
    tts_bytes: Number(data.ttsBytes) || 0,
    status: data.status || 'success',
    error: data.error || null,
    updated_at: now
  };
  const response = await supabaseFetch('companion_logs?on_conflict=event_key', {
    method: 'POST',
    body: JSON.stringify(row),
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
  });
  if (!response.ok) throw new Error(`保存感知日志失败: ${response.status} ${await response.text()}`);
  return row.event_key;
}

async function updateTtsLog({ epoch, turnId, source = 'pomodoro', status, bytes, error }) {
  if (!isReady) return;
  const response = await supabaseFetch(`companion_logs?event_key=eq.${encodeURIComponent(eventKey(epoch, turnId, source))}`, {
    method: 'PATCH',
    body: JSON.stringify({
      tts_status: status,
      tts_bytes: Number(bytes) || 0,
      ...(error ? { error: String(error).slice(0, 500) } : {}),
      updated_at: new Date().toISOString()
    }),
    headers: { Prefer: 'return=minimal' }
  });
  if (!response.ok) console.error('更新 TTS 日志失败:', response.status, await response.text());
}

async function cleanupLogs() {
  const cutoff = new Date(Date.now() - RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  await supabaseFetch(`companion_logs?created_at=lt.${encodeURIComponent(cutoff)}`, { method: 'DELETE' });
}

async function handler(req, res) {
  if (!isReady) return res.status(503).json({ success: false, error: 'Supabase 尚未配置' });
  try {
    if (req.method === 'GET') {
      await cleanupLogs();
      const summary = req.query?.summary === 'true';
      const select = summary
        ? 'source,session_epoch,turn_id,tts_status,tts_bytes,status,created_at'
        : '*';
      const response = await supabaseFetch(`companion_logs?select=${select}&order=created_at.desc&limit=${MAX_ROWS}`);
      if (!response.ok) throw new Error(`读取日志失败: ${response.status} ${await response.text()}`);
      return res.status(200).json({ success: true, data: await response.json() });
    }
    if (req.method === 'DELETE') {
      const response = await supabaseFetch('companion_logs?created_at=not.is.null', { method: 'DELETE' });
      if (!response.ok) throw new Error(`清空日志失败: ${response.status} ${await response.text()}`);
      return res.status(200).json({ success: true });
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Companion logs error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { default: handler, handler, upsertCompanionLog, updateTtsLog };
