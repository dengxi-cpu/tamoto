const { assemblePersonaPrompt } = require('../lib/companion-prompt');
const { createSession, getSession, deleteSession, SESSION_TTL_MS } = require('../lib/companion-session-store');

function cleanObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const task = String(req.body?.task || '保持专注').trim().slice(0, 200);
      const roleContext = cleanObject(req.body?.roleContext);
      const persona = assemblePersonaPrompt(roleContext, req.body?.persona);
      const now = Date.now();
      const session = await createSession({
        task,
        persona,
        roleContext,
        voiceConfig: cleanObject(req.body?.voiceConfig || roleContext),
        outputLanguage: String(roleContext.speechLanguage || req.body?.outputLanguage).toLowerCase() === 'en' ? 'en' : 'zh',
        epoch: Number.isSafeInteger(req.body?.epoch) ? req.body.epoch : now,
        sessionStartedAt: Number.isFinite(Date.parse(req.body?.sessionStartedAt)) ? new Date(req.body.sessionStartedAt).toISOString() : new Date(now).toISOString(),
        recentObservations: [],
        workingMemory: [],
        storyMemory: req.body?.storyMemory || '',
        relationshipMemory: req.body?.relationshipMemory || '',
        conversationHistory: [],
        lastObservation: null,
        interactionState: {},
        lastAIAction: null,
        policyState: {}
      });
      return res.status(201).json({ success:true, data:{ sessionId:session.sessionId, stateVersion:session.stateVersion, expiresInSeconds:Math.floor(SESSION_TTL_MS/1000) } });
    }
    const sessionId = String(req.body?.sessionId || req.query?.sessionId || '');
    if (!sessionId) return res.status(400).json({ success:false, error:'缺少 sessionId' });
    if (req.method === 'GET') {
      const session = await getSession(sessionId);
      if (!session) return res.status(404).json({ success:false, error:'Session 不存在或已过期' });
      return res.status(200).json({ success:true, data:{ sessionId, stateVersion:session.stateVersion, expiresAt:session.expiresAt } });
    }
    if (req.method === 'DELETE') {
      await deleteSession(sessionId);
      return res.status(200).json({ success:true });
    }
    return res.status(405).json({ success:false, error:'Method not allowed' });
  } catch (error) {
    console.error('Companion session error:', error);
    return res.status(500).json({ success:false, error:error.message || 'Session 操作失败' });
  }
}

module.exports = { default:handler, handler };
