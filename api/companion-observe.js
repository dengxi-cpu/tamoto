const { CompanionPipelineError, generateReaction, generateAmbient, generateSessionOpening, generateBodyDoublePlan, consolidateRelationshipMemory, runDialogueMemoryPipeline, runMemoryEventPipeline, runCompanionPipeline, getCompanionSystemPrompts } = require('../lib/companion-pipeline');
const { assemblePersonaPrompt } = require('../lib/companion-prompt');
const { upsertCompanionLog } = require('./companion-logs');
const { visualPipelineTrace, memoryEventTrace, dialogueTrace } = require('../lib/companion-trace');

function json(res, status, body) {
  return res.status(status).json(body);
}

function sanitizeStoryMemory(value) {
  if (typeof value === 'string') return value.slice(0, 3000);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return ''; }
}

function sanitizeRelationshipMemory(value) {
  if (typeof value === 'string') return value.slice(0, 6000);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return ''; }
}

function memoryDebugText(data) {
  const memory = data?.memory || {};
  const decision = data?.decision || {};
  const evidence = Array.isArray(decision.evidenceEventIds)
    ? decision.evidenceEventIds.join(', ')
    : Array.isArray(memory.evidenceEventIds) ? memory.evidenceEventIds.join(', ') : '';
  return [
    '[Memory LLM]',
    `decisionId: ${decision.decisionId || 'n/a'}`,
    `shouldSpeak: ${Boolean(decision.shouldSpeak ?? memory.shouldSpeak)}`,
    `intent: ${memory.responseIntent || decision.reason || 'n/a'}`,
    `evidence: ${evidence || 'none'}`,
    `validUntil: ${decision.validUntil || 'n/a'}`
  ].join('\n');
}

function dataUrlPayloadBytes(value) {
  const comma = String(value || '').indexOf(',');
  if (comma < 0) return 0;
  const payloadLength = String(value).length - comma - 1;
  const padding = String(value).endsWith('==') ? 2 : String(value).endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor(payloadLength * 3 / 4) - padding);
}

async function handler(req, res) {
  if (req.method === 'GET') return json(res, 200, { success:true, data:{ prompts:getCompanionSystemPrompts() } });
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });
  const persona = assemblePersonaPrompt(req.body?.roleContext, req.body?.persona);
  const outputLanguage = String(req.body?.roleContext?.speechLanguage || '').toLowerCase() === 'en' ? 'en' : 'zh';

  if (req.body?.mode === 'memory_consolidation') {
    try {
      const relationshipMemory = await consolidateRelationshipMemory({
        relationshipMemory: sanitizeRelationshipMemory(req.body?.relationshipMemory),
        storyMemory: sanitizeStoryMemory(req.body?.storyMemory),
        workingMemory: Array.isArray(req.body?.workingMemory) ? req.body.workingMemory.slice(-24) : [],
        conversationHistory: Array.isArray(req.body?.conversationHistory) ? req.body.conversationHistory.slice(-12) : [],
        task: String(req.body?.task || '').slice(0, 200)
      });
      return json(res, 200, { success: true, data: { relationshipMemory } });
    } catch (error) {
      console.error('Memory consolidation failed:', error);
      return json(res, error.statusCode || 500, { success: false, error: error.message || '长期记忆整理失败' });
    }
  }

  if (req.body?.mode === 'memory_event') {
    try {
      const eventType = ['pause', 'resume', 'completion', 'stage_tap'].includes(req.body?.eventType) ? req.body.eventType : '';
      if (!eventType) return json(res, 400, { success: false, error: '无效的会话事件' });
      const data = await runMemoryEventPipeline({
        eventType,
        eventDescription: String(req.body?.eventDescription || '').slice(0, 300),
        task: String(req.body?.task || '保持专注').slice(0, 200), persona,
        elapsedSeconds: Math.max(0, Number(req.body?.elapsedSeconds) || 0),
        workingMemory: Array.isArray(req.body?.workingMemory) ? req.body.workingMemory.slice(-24) : [],
        storyMemory: sanitizeStoryMemory(req.body?.storyMemory),
        relationshipMemory: sanitizeRelationshipMemory(req.body?.relationshipMemory),
        conversationHistory: Array.isArray(req.body?.conversationHistory) ? req.body.conversationHistory.slice(-8) : []
      });
      await upsertCompanionLog({
        source: 'ambient',
        epoch: req.body?.epoch,
        turnId: req.body?.turnId,
        task: String(req.body?.task || '').slice(0, 200),
        persona,
        scene: memoryEventTrace({
          ...req.body, eventType, persona,
          workingMemory: Array.isArray(req.body?.workingMemory) ? req.body.workingMemory.slice(-24) : [],
          storyMemory: sanitizeStoryMemory(req.body?.storyMemory),
          relationshipMemory: sanitizeRelationshipMemory(req.body?.relationshipMemory)
        }, data),
        reaction: data.reaction,
        status: 'success',
        ttsStatus: data.memory?.shouldSpeak ? 'generated' : 'skipped'
      }).catch(error => console.error('Memory event log write failed:', error));
      return json(res, 200, { success: true, data });
    } catch (error) {
      console.error('Memory event failed:', error);
      return json(res, error.statusCode || 500, { success: false, error: error.message || '会话事件处理失败' });
    }
  }

  if (req.body?.mode === 'body_double_plan') {
    try {
      const activity = String(req.body?.activity || '').trim().slice(0, 100);
      if (!activity) return json(res, 400, { success: false, error: '请先填写 TA 要做什么' });
      const todos = await generateBodyDoublePlan({ activity, durationMinutes: req.body?.durationMinutes, persona });
      return json(res, 200, { success: true, data: { activity, todos } });
    } catch (error) {
      console.error('Body double plan generation failed:', error);
      return json(res, 500, { success: false, error: 'TA 的计划生成失败' });
    }
  }

  if (req.body?.mode === 'session_opening') {
    try {
      const task = String(req.body?.task || '').trim().slice(0, 200);
      if (!task) return json(res, 400, { success: false, error: '本次任务不能为空' });
      const messages = await generateSessionOpening({ task, persona });
      await upsertCompanionLog({
        source: 'session_opening', epoch: req.body?.epoch, turnId: req.body?.turnId,
        task, persona, scene: `[见面输入] 用户本次任务：${task}`,
        reaction: messages.join('\n'), status: 'success', ttsStatus: 'pending'
      }).catch(error => console.error('Session opening log write failed:', error));
      return json(res, 200, { success: true, data: { messages, reaction: messages.join('\n') } });
    } catch (error) {
      console.error('Session opening generation failed:', error);
      return json(res, error.statusCode || 500, { success: false, error: error.message || '见面回应生成失败' });
    }
  }

  if (req.body?.mode === 'reaction_test') {
    try {
      const startedAt = Date.now();
      const scene = String(req.body?.scene || '').trim().slice(0, 300);
      const task = String(req.body?.task || '保持专注').trim().slice(0, 200);
      const elapsedSeconds = Math.max(0, Math.min(24 * 60 * 60, Number(req.body?.elapsedSeconds) || 0));
      const triggerReason = String(req.body?.triggerReason || '批量测试场景').trim().slice(0, 300);
      if (!scene) return json(res, 400, { success: false, error: '测试场景不能为空' });
      const messages = await generateReaction({
        scene,
        task,
        persona,
        sessionStartedAt: new Date(Date.now() - elapsedSeconds * 1000).toISOString(),
        elapsedSeconds,
        recentObservations: Array.isArray(req.body?.recentObservations) ? req.body.recentObservations.slice(-1) : [],
        triggerReason
      });
      return json(res, 200, {
        success: true,
        data: { messages, reaction: messages.join('\n'), persona, elapsedSeconds, durationMs: Date.now() - startedAt }
      });
    } catch (error) {
      console.error('Companion reaction test failed:', error);
      return json(res, error.statusCode || 500, { success: false, error: error.message || '批量反应生成失败' });
    }
  }

  if (req.body?.mode === 'ambient') {
    try {
      const type = ['opening', 'opening_event'].includes(req.body?.type) ? req.body.type : 'opening';
      const messages = await generateAmbient({
        type,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        elapsedSeconds: Math.max(0, Number(req.body?.elapsedSeconds) || 0),
        activity: String(req.body?.activity || '').slice(0, 50),
        scene: String(req.body?.scene || '').slice(0, 300),
        state: String(req.body?.state || 'UNKNOWN').slice(0, 20)
      });
      await upsertCompanionLog({
        source: 'ambient', epoch: req.body?.epoch, turnId: req.body?.turnId,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        scene: `[氛围输入] 类型=${type}；已专注=${Math.floor((Number(req.body?.elapsedSeconds) || 0) / 60)}分钟；角色活动=${String(req.body?.activity || '无')}；画面=${String(req.body?.scene || '无')}`,
        reaction: messages.join('\n'), status: 'success', ttsStatus: 'pending'
      }).catch(error => console.error('Ambient log write failed:', error));
      return json(res, 200, { success: true, data: { type, messages, reaction: messages.join('\n') } });
    } catch (error) {
      console.error('Companion ambient error:', error);
      await upsertCompanionLog({
        source: 'ambient', epoch: req.body?.epoch, turnId: req.body?.turnId,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        scene: `[开场输入失败] 类型=${String(req.body?.type || 'opening')}；已专注=${Math.floor((Number(req.body?.elapsedSeconds) || 0) / 60)}分钟`,
        status: 'failed', error: error.message, ttsStatus: 'skipped'
      }).catch(logError => console.error('Ambient failure log write failed:', logError));
      return json(res, error.statusCode || 500, { success: false, error: error.message || '氛围语音生成失败' });
    }
  }

  if (req.body?.mode === 'dialogue') {
    try {
      const text = String(req.body?.text || '').trim().slice(0, 500);
      if (!text) return json(res, 400, { success: false, error: '对话文字不能为空' });
      const data = await runDialogueMemoryPipeline({
        text,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        elapsedSeconds: Math.max(0, Number(req.body?.elapsedSeconds) || 0),
        scene: String(req.body?.scene || '').slice(0, 300),
        history: Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [],
        workingMemory: Array.isArray(req.body?.workingMemory) ? req.body.workingMemory.slice(-24) : [],
        storyMemory: sanitizeStoryMemory(req.body?.storyMemory),
        relationshipMemory: sanitizeRelationshipMemory(req.body?.relationshipMemory)
      });
      await upsertCompanionLog({
        source: 'dialogue', epoch: req.body?.epoch, turnId: req.body?.turnId,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        scene: dialogueTrace({
          ...req.body, text, persona,
          workingMemory: Array.isArray(req.body?.workingMemory) ? req.body.workingMemory.slice(-24) : [],
          storyMemory: sanitizeStoryMemory(req.body?.storyMemory),
          relationshipMemory: sanitizeRelationshipMemory(req.body?.relationshipMemory)
        }, data),
        reaction: data.reaction, status: 'success', ttsStatus: 'generated'
      }).catch(error => console.error('Dialogue log write failed:', error));
      return json(res, 200, { success: true, data });
    } catch (error) {
      console.error('Companion dialogue error:', error);
      await upsertCompanionLog({
        source: 'dialogue', epoch: req.body?.epoch, turnId: req.body?.turnId,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        scene: `[对话输入失败] 用户说：${String(req.body?.text || '').slice(0, 500)}`,
        status: 'failed', error: error.message, ttsStatus: 'skipped'
      }).catch(logError => console.error('Dialogue failure log write failed:', logError));
      return json(res, error.statusCode || 500, { success: false, error: error.message || '对话生成失败' });
    }
  }

  const image = req.body?.image;
  if (typeof image !== 'string' || !/^data:image\/jpeg;base64,/.test(image)) {
    return json(res, 400, { success: false, error: '无效的 JPEG 图片', stage: 'input' });
  }
  if (image.length > 2_000_000) {
    return json(res, 413, { success: false, error: '图片过大', stage: 'input' });
  }

  const epoch = Number.isSafeInteger(req.body?.epoch) ? req.body.epoch : 1;
  const turnId = Number.isSafeInteger(req.body?.turnId) ? req.body.turnId : 1;
  const task = String(req.body?.task || '保持专注').trim().slice(0, 200);
  const sessionStartedAt = Number.isFinite(Date.parse(req.body?.sessionStartedAt))
    ? new Date(req.body.sessionStartedAt).toISOString()
    : new Date().toISOString();
  const elapsedSeconds = Math.max(0, Math.min(24 * 60 * 60, Number(req.body?.elapsedSeconds) || 0));
  const recentObservations = Array.isArray(req.body?.recentObservations)
    ? req.body.recentObservations.slice(-24).map(item => ({
        elapsedSeconds: Math.max(0, Number(item?.elapsedSeconds) || 0),
        state: String(item?.state || 'UNKNOWN').slice(0, 20),
        scene: String(item?.scene || '').slice(0, 300),
        reaction: String(item?.reaction || '').slice(0, 100)
      }))
    : [];
  const workingMemory = Array.isArray(req.body?.workingMemory)
    ? req.body.workingMemory.slice(-24).map(item => ({
        id: String(item?.id || '').slice(0, 80),
        type: ['vision', 'user_speech', 'ai_speech', 'session'].includes(item?.type) ? item.type : 'vision',
        observedAt: String(item?.observedAt || '').slice(0, 40),
        elapsedSeconds: Math.max(0, Number(item?.elapsedSeconds) || 0),
        state: String(item?.state || 'UNKNOWN').slice(0, 30),
        observation: String(item?.observation || item?.scene || '').slice(0, 300),
        changes: Array.isArray(item?.changes) ? item.changes.slice(0, 4).map(change => String(change).slice(0, 200)) : [],
        confidence: Math.max(0, Math.min(1, Number(item?.confidence) || 0)),
        reaction: String(item?.reaction || '').slice(0, 200),
        actorAction: item?.actorAction && typeof item.actorAction === 'object' ? {
          said: String(item.actorAction.said || item.reaction || '').slice(0, 200),
          intent: String(item.actorAction.intent || '').slice(0, 300),
          intendedUserAction: String(item.actorAction.intendedUserAction || '').slice(0, 300),
          outputLanguage: String(item.actorAction.outputLanguage || '').slice(0, 20),
          actionType: String(item.actorAction.actionType || '').slice(0, 30),
          expectsUserResponse: item.actorAction.expectsUserResponse !== false
        } : null
      })) : recentObservations;
  const storyMemory = sanitizeStoryMemory(req.body?.storyMemory);
  const relationshipMemory = sanitizeRelationshipMemory(req.body?.relationshipMemory);
  const conversationHistory = Array.isArray(req.body?.conversationHistory)
    ? req.body.conversationHistory.slice(-8).map(item => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: String(item?.content || '').slice(0, 300) })) : [];
  const policyState = req.body?.policyState && typeof req.body.policyState === 'object'
    ? req.body.policyState : {};
  const contextSummary = `专注开始：${sessionStartedAt}\n已专注：${Math.floor(elapsedSeconds / 60)}分${Math.floor(elapsedSeconds % 60)}秒`;

  try {
    const data = await runCompanionPipeline({
      image, task, persona, epoch, turnId,
      sessionStartedAt, elapsedSeconds, recentObservations, workingMemory,
      storyMemory, relationshipMemory, conversationHistory, policyState,
      outputLanguage,
      promptOverrides: req.body?.promptOverrides && typeof req.body.promptOverrides === 'object'
        ? req.body.promptOverrides : {}
    });
    data.metrics = data.metrics || { schemaVersion:1, tokens:{} };
    data.metrics.bytes = {
      image: dataUrlPayloadBytes(image),
      request: Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8'),
      response: 0
    };
    let responseBytes = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      responseBytes = Buffer.byteLength(JSON.stringify({ success:true, data }), 'utf8');
      data.metrics.bytes.response = responseBytes;
    }
    await upsertCompanionLog({
      epoch, turnId, image, task, persona: `${persona}\n${contextSummary}`,
      scene: visualPipelineTrace({
        image, task, persona, roleContext: req.body?.roleContext,
        elapsedSeconds, workingMemory, storyMemory, relationshipMemory,
        conversationHistory, policyState
      }, data),
      reaction: data.reaction,
      visionMs: data.timings?.visionMs,
      reactionMs: data.timings?.reactionMs,
      totalMs: data.timings?.totalMs,
      status: 'success',
      ttsStatus: data.decision?.shouldSpeak ? 'pending' : 'skipped'
    }).catch(error => console.error('Companion log write failed:', error));
    return json(res, 200, { success: true, data });
  } catch (error) {
    console.error('Companion observe error:', error);
    await upsertCompanionLog({
      epoch, turnId, image, task, persona,
      status: 'failed', error: error.message, ttsStatus: 'skipped'
    }).catch(logError => console.error('Companion failure log write failed:', logError));
    if (error instanceof CompanionPipelineError) {
      return json(res, error.statusCode, {
        success: false,
        error: error.message,
        stage: error.stage,
        epoch,
        turnId
      });
    }
    return json(res, 500, { success: false, error: '陪伴管线运行失败', stage: 'unknown', epoch, turnId });
  }
}

module.exports = { default: handler, handler, memoryDebugText };
