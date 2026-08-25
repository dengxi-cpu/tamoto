const { CompanionPipelineError, generateReaction, generateAmbient, generateDialogue, generateSessionOpening, generateBodyDoublePlan, runCompanionPipeline } = require('../lib/companion-pipeline');
const { assemblePersonaPrompt } = require('../lib/companion-prompt');
const { upsertCompanionLog } = require('./companion-logs');

function json(res, status, body) {
  return res.status(status).json(body);
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });
  const persona = assemblePersonaPrompt(req.body?.roleContext, req.body?.persona);

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
      const type = ['opening', 'opening_event', 'presence', 'praise', 'activity', 'encourage'].includes(req.body?.type) ? req.body.type : 'presence';
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
        scene: `[氛围输入失败] 类型=${String(req.body?.type || 'presence')}；已专注=${Math.floor((Number(req.body?.elapsedSeconds) || 0) / 60)}分钟`,
        status: 'failed', error: error.message, ttsStatus: 'skipped'
      }).catch(logError => console.error('Ambient failure log write failed:', logError));
      return json(res, error.statusCode || 500, { success: false, error: error.message || '氛围语音生成失败' });
    }
  }

  if (req.body?.mode === 'dialogue') {
    try {
      const text = String(req.body?.text || '').trim().slice(0, 500);
      if (!text) return json(res, 400, { success: false, error: '对话文字不能为空' });
      const messages = await generateDialogue({
        text,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        elapsedSeconds: Math.max(0, Number(req.body?.elapsedSeconds) || 0),
        scene: String(req.body?.scene || '').slice(0, 300),
        history: Array.isArray(req.body?.history) ? req.body.history.slice(-6) : []
      });
      await upsertCompanionLog({
        source: 'dialogue', epoch: req.body?.epoch, turnId: req.body?.turnId,
        task: String(req.body?.task || '保持专注').slice(0, 200),
        persona,
        scene: `[对话输入] 用户说：${text}\n最近画面：${String(req.body?.scene || '无').slice(0, 300)}\n最近对话：${JSON.stringify(Array.isArray(req.body?.history) ? req.body.history.slice(-6) : [])}`,
        reaction: messages.join('\n'), status: 'success', ttsStatus: 'pending'
      }).catch(error => console.error('Dialogue log write failed:', error));
      return json(res, 200, { success: true, data: { messages, reaction: messages.join('\n') } });
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
    ? req.body.recentObservations.slice(-1).map(item => ({
        elapsedSeconds: Math.max(0, Number(item?.elapsedSeconds) || 0),
        scene: String(item?.scene || '').slice(0, 300),
        reaction: String(item?.reaction || '').slice(0, 100)
      }))
    : [];
  const policyState = req.body?.policyState && typeof req.body.policyState === 'object'
    ? req.body.policyState : {};
  const contextSummary = `专注开始：${sessionStartedAt}\n已专注：${Math.floor(elapsedSeconds / 60)}分${Math.floor(elapsedSeconds % 60)}秒`;

  try {
    const data = await runCompanionPipeline({
      image, task, persona, epoch, turnId,
      sessionStartedAt, elapsedSeconds, recentObservations, policyState
    });
    await upsertCompanionLog({
      epoch, turnId, image, task, persona: `${persona}\n${contextSummary}`,
      scene: `${data.observation?.scene || ''}\n[${data.decision?.state || 'UNKNOWN'}] ${data.decision?.reason || ''}`,
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

module.exports = { default: handler, handler };
