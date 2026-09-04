const { randomUUID } = require('node:crypto');
const { isReady, supabaseFetch } = require('../api/_supabase');

const SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const memorySessions = new Map();
const useMemory = process.env.COMPANION_SESSION_STORE === 'memory' || !isReady;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    sessionId: row.session_id,
    state: row.state || {},
    stateVersion: Number(row.state_version) || 1,
    lastTurnId: Number(row.last_turn_id) || null,
    lastTurnResponse: row.last_turn_response || null,
    expiresAt: row.expires_at
  };
}

async function createSession(state) {
  const now = Date.now();
  const row = {
    session_id: `sess_${randomUUID()}`,
    state,
    state_version: 1,
    last_turn_id: null,
    last_turn_response: null,
    created_at: new Date(now).toISOString(),
    updated_at: new Date(now).toISOString(),
    expires_at: new Date(now + SESSION_TTL_MS).toISOString()
  };
  if (useMemory) {
    memorySessions.set(row.session_id, clone(row));
    return normalizeRow(row);
  }
  const response = await supabaseFetch('companion_sessions', {
    method: 'POST', body: JSON.stringify(row), headers: { Prefer:'return=representation' }
  });
  if (!response.ok) throw new Error(`创建陪伴 Session 失败: ${response.status} ${await response.text()}`);
  return normalizeRow((await response.json())[0]);
}

async function getSession(sessionId) {
  if (!/^sess_[0-9a-f-]{36}$/i.test(String(sessionId || ''))) return null;
  let row;
  if (useMemory) row = memorySessions.get(sessionId);
  else {
    const response = await supabaseFetch(`companion_sessions?session_id=eq.${encodeURIComponent(sessionId)}&select=*&limit=1`);
    if (!response.ok) throw new Error(`读取陪伴 Session 失败: ${response.status} ${await response.text()}`);
    row = (await response.json())[0];
  }
  if (!row || Date.parse(row.expires_at) <= Date.now()) return null;
  return normalizeRow(clone(row));
}

async function commitSession(sessionId, expectedVersion, state, turnId, turnResponse) {
  const patch = {
    state,
    state_version: expectedVersion + 1,
    last_turn_id: turnId,
    last_turn_response: turnResponse,
    updated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  };
  if (useMemory) {
    const current = memorySessions.get(sessionId);
    if (!current || Number(current.state_version) !== expectedVersion) return null;
    const next = { ...current, ...clone(patch) };
    memorySessions.set(sessionId, next);
    return normalizeRow(next);
  }
  const response = await supabaseFetch(`companion_sessions?session_id=eq.${encodeURIComponent(sessionId)}&state_version=eq.${expectedVersion}`, {
    method:'PATCH', body:JSON.stringify(patch), headers:{ Prefer:'return=representation' }
  });
  if (!response.ok) throw new Error(`更新陪伴 Session 失败: ${response.status} ${await response.text()}`);
  return normalizeRow((await response.json())[0]);
}

async function deleteSession(sessionId) {
  if (useMemory) return memorySessions.delete(sessionId);
  const response = await supabaseFetch(`companion_sessions?session_id=eq.${encodeURIComponent(sessionId)}`, { method:'DELETE' });
  if (!response.ok) throw new Error(`结束陪伴 Session 失败: ${response.status} ${await response.text()}`);
  return true;
}

module.exports = { createSession, getSession, commitSession, deleteSession, SESSION_TTL_MS };
