(function () {
  'use strict';

  const QUEUE_KEY = 'tamoto_events_v2';
  const SESSION_KEY = 'tamoto_focus_session_v2';
  const DEVICE_KEY = 'tamotoPushDeviceId';
  const MAX_QUEUE = 500;
  const BATCH_SIZE = 25;
  const FLUSH_INTERVAL_MS = 30000;
  const POLICY_VERSION = localStorage.getItem('bn_policy_v') || 'baseline-v1';
  const ALLOWED_PROPS = new Set([
    'reason','block_reason','planned_minutes','task_kind','status_name','oc_name','completed','total_elapsed',
    'pause_count','away_seconds','ai_speech_count','ai_speech_completed','ai_speech_cancelled','user_interaction_count',
    'camera_used','camera_on_seconds','distraction_count','gift_received','source','speech_type','speech_id','text_len',
    'tts_bytes','duration_ms','outcome','cancelled_by','interaction_type','after_speech_id','after_speech_ms',
    'enabled','permission','engine','decision','reason_code','state','should_speak','latency_ms','vision_ms',
    'reaction_ms','total_ms','mode','ui','result','message_length','reply_ok','reply_length','error_area','error_code',
    'bgm_mode','meeting_step','body_double_action','hold_ms','away_count'
  ]);

  let queue = readJson(QUEUE_KEY, []);
  let session = readJson(SESSION_KEY, null);
  let flushing = false;
  let lastSpeech = null;
  let cameraStartedAt = null;

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function deviceId() {
    let value = localStorage.getItem(DEVICE_KEY);
    if (!value) {
      value = uuid();
      localStorage.setItem(DEVICE_KEY, value);
    }
    return value;
  }

  function currentUi() {
    return window.APP_BASE === '/beta' || new URLSearchParams(location.search).get('mode') === 'beta' ? 'beta' : 'classic';
  }

  function publicContext() {
    const mode = typeof currentMode !== 'undefined' ? currentMode : null;
    const elapsed = session ? Math.max(0, Math.floor((Date.now() - session.started_at - session.paused_ms - (session.pause_started_at ? Date.now() - session.pause_started_at : 0)) / 1000)) : 0;
    return { mode, elapsed };
  }

  function cleanProps(props) {
    const clean = {};
    Object.entries(props || {}).forEach(([key, value]) => {
      if (!ALLOWED_PROPS.has(key) || value == null) return;
      if (typeof value === 'string') clean[key] = value.slice(0, 120);
      else if (typeof value === 'number' && Number.isFinite(value)) clean[key] = value;
      else if (typeof value === 'boolean') clean[key] = value;
    });
    return clean;
  }

  function persist() {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE))); } catch (_) {}
    try {
      if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  function track(event, props = {}) {
    const context = publicContext();
    queue.push({
      event_id: uuid(), event, client_ts: new Date().toISOString(), sequence_no: session ? ++session.sequence_no : 0,
      focus_session_id: session?.id || null, device_id: deviceId(), user_id: window.syncManager?.userId || null,
      ui: currentUi(), mode: context.mode, elapsed: context.elapsed, policy_version: POLICY_VERSION,
      schema_version: 1, props: cleanProps(props)
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    persist();
    if (queue.length >= 10) flush();
  }

  function sessionStart(meta = {}) {
    if (session && !session.ended) sessionEnd('replaced', false);
    session = {
      id: uuid(), started_at: Date.now(), paused_ms: 0, pause_started_at: null, sequence_no: 0, pause_count: 0,
      ai_speech_count: 0, ai_speech_completed: 0, ai_speech_cancelled: 0, user_interaction_count: 0,
      camera_used: false, camera_on_seconds: 0, distraction_count: 0, planned_minutes: Number(meta.planned_minutes) || 0
    };
    persist();
    track('focus_session_start', meta);
    return session.id;
  }

  function sessionPause(paused) {
    if (!session) return;
    if (paused && !session.pause_started_at) {
      session.pause_started_at = Date.now(); session.pause_count += 1; track('focus_pause');
    } else if (!paused && session.pause_started_at) {
      session.paused_ms += Date.now() - session.pause_started_at; session.pause_started_at = null; track('focus_resume');
    }
    persist();
  }

  function sessionEnd(reason, completed, extra = {}) {
    if (!session || session.ended) return;
    if (cameraStartedAt) cameraToggle(false, 'allow');
    if (session.pause_started_at) session.paused_ms += Date.now() - session.pause_started_at;
    const totalElapsed = Math.max(0, Math.floor((Date.now() - session.started_at - session.paused_ms) / 1000));
    session.ended = true;
    track('focus_session_end', {
      reason, completed: Boolean(completed), planned_minutes: session.planned_minutes, total_elapsed: totalElapsed,
      pause_count: session.pause_count, ai_speech_count: session.ai_speech_count,
      ai_speech_completed: session.ai_speech_completed, ai_speech_cancelled: session.ai_speech_cancelled,
      user_interaction_count: session.user_interaction_count, camera_used: session.camera_used,
      camera_on_seconds: session.camera_on_seconds, distraction_count: session.distraction_count, ...extra
    });
    session = null; lastSpeech = null; persist(); flush(true);
  }

  function speechStarted(meta = {}) {
    if (!session) return null;
    const speechId = meta.speech_id || `${session.id}-${session.sequence_no + 1}`;
    lastSpeech = { id: speechId, started_at: Date.now(), ended_at: null };
    session.ai_speech_count += 1;
    track('ai_speech_started', { ...meta, speech_id: speechId });
    return speechId;
  }

  function speechEnded(speechId, outcome, meta = {}) {
    if (!session || !speechId) return;
    if (outcome === 'completed') session.ai_speech_completed += 1;
    else session.ai_speech_cancelled += 1;
    if (lastSpeech?.id === speechId) lastSpeech.ended_at = Date.now();
    track('ai_speech_ended', { ...meta, speech_id: speechId, outcome });
  }

  function interaction(type, meta = {}) {
    if (session) session.user_interaction_count += 1;
    const after = lastSpeech?.ended_at && Date.now() - lastSpeech.ended_at <= 30000
      ? { after_speech_id: lastSpeech.id, after_speech_ms: Date.now() - lastSpeech.ended_at } : {};
    track('user_interaction', { interaction_type: type, ...after, ...meta });
  }

  function cameraToggle(enabled, permission) {
    if (enabled) {
      cameraStartedAt = Date.now();
      if (session) session.camera_used = true;
    } else if (cameraStartedAt) {
      if (session) session.camera_on_seconds += Math.floor((Date.now() - cameraStartedAt) / 1000);
      cameraStartedAt = null;
    }
    track('camera_toggle', { enabled, permission });
  }

  async function flush(useBeacon = false) {
    if (flushing || !queue.length || !navigator.onLine) return;
    const batch = queue.slice(0, BATCH_SIZE);
    const body = JSON.stringify({ events: batch });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon((window.APP_BASE || '') + '/api/events', new Blob([body], { type: 'application/json' }));
      return;
    }
    flushing = true;
    try {
      const response = await fetch((window.APP_BASE || '') + '/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const sent = new Set(batch.map(item => item.event_id));
      queue = queue.filter(item => !sent.has(item.event_id));
      persist();
      if (queue.length) window.setTimeout(flush, 100);
    } catch (error) { console.warn('埋点稍后重试:', error.message); }
    finally { flushing = false; }
  }

  window.track = Object.assign(track, {
    flush, sessionStart, sessionPause, sessionEnd, speechStarted, speechEnded, interaction, cameraToggle,
    increment(name) { if (session && Object.hasOwn(session, name)) { session[name] += 1; persist(); } },
    getSessionId: () => session?.id || null
  });
  window.addEventListener('online', () => { track('network_status', { result: 'online' }); flush(); });
  window.addEventListener('offline', () => track('network_status', { result: 'offline' }));
  window.addEventListener('pagehide', () => flush(true));
  window.setInterval(flush, FLUSH_INTERVAL_MS);
  track('focus_page_view');
  flush();
})();
