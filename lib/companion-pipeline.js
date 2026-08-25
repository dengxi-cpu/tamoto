const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

// 测试期高频策略：参数集中在门控层，正式内测前可统一回调。
const SPEECH_POLICY = {
  firstPhoneThresholdSeconds: 0,
  earnedBreakPhoneThresholdSeconds: 0,
  globalCooldownMs: 20 * 1000,
  repeatPhoneCooldownMs: 60 * 1000
};

const FOCUS_SUPPORT_RULE = '陪伴目标是帮助用户继续当前任务。可以体谅疲惫，但绝不能主动建议趴下、休息、暂停、放弃、晚点再做或改天再说；遇到疲惫时，用“放慢一点、先做一点、我陪你继续”这类轻柔但向前的表达。';
const PRODUCTIVE_STATES = new Set(['STUDYING', 'READING', 'WRITING', 'COMPUTER_WORK']);

class CompanionPipelineError extends Error {
  constructor(stage, message, statusCode = 500, detail = '') {
    super(message);
    this.name = 'CompanionPipelineError';
    this.stage = stage;
    this.statusCode = statusCode;
    this.detail = detail;
  }
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Model did not return JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function cleanOneSentence(text) {
  const cleaned = String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^[“”"'「」『』\s]+|[“”"'「」『』\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) throw new Error('Reaction model returned empty text');
  return cleaned.slice(0, 100);
}

function cleanSpokenMessages(text, sentenceCount) {
  const cleaned = String(text || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^[“”"'「」『』\s]+|[“”"'「」『』\s]+$/g, '')
    .replace(/(?:^|\n)\s*(?:[-*]|\d+[.、])\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) throw new Error('Speech model returned empty text');
  // 逗号也代表一条独立的微信式短句。不要在这里硬截字，避免语义被砍断。
  const parts = cleaned
    .replace(/[，,；;]+/g, '。')
    .split(/[。！？!?\n]+/)
    .map(part => part.trim().replace(/[，,；;。！？!?]+$/g, ''))
    .filter(Boolean);
  return parts.slice(0, 6).map(part => `${part}。`);
}

function randomSpeechCount() {
  return Math.random() < 0.5 ? 2 : 3;
}

async function deepSeek(messages, { temperature = 0.2, maxTokens = 120 } = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new CompanionPipelineError('reaction', '反应生成模型尚未配置', 503);
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: DEEPSEEK_MODEL, messages, temperature, max_tokens: maxTokens, stream: false })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new CompanionPipelineError('reaction', 'AI 决策生成失败', response.status === 429 ? 429 : 502, detail.slice(0, 300));
  }
  return (await response.json())?.choices?.[0]?.message?.content || '';
}

async function classifyScene(scene, uncertain) {
  if (uncertain) return 'UNKNOWN';
  const content = await deepSeek([
    { role: 'system', content: '根据客观画面描述提取一个轻量事件标签。只输出 JSON：{"state":"STUDYING|READING|WRITING|COMPUTER_WORK|PHONE|RESTING|ABSENT|DRINKING|STRETCHING|OTHER"}。READING=明确阅读纸质材料；WRITING=明确手写；COMPUTER_WORK=操作电脑工作或学习；STUDYING=认真学习但无法细分；PHONE仅限明确看或操作手机；RESTING=趴桌或明显休息；ABSENT=画面无人；DRINKING=喝水；STRETCHING=伸展活动。不要解释。' },
    { role: 'user', content: scene }
  ], { temperature: 0, maxTokens: 30 });
  try {
    const state = String(extractJson(content).state || '').toUpperCase();
    return ['STUDYING', 'READING', 'WRITING', 'COMPUTER_WORK', 'PHONE', 'RESTING', 'ABSENT', 'DRINKING', 'STRETCHING', 'OTHER'].includes(state) ? state : 'OTHER';
  } catch (_) {
    return 'OTHER';
  }
}

function evaluateSpeechPolicy({ state, policyState = {}, nowMs = Date.now() }) {
  const previous = { ...policyState };
  const next = {
    currentState: state,
    stateStartedAt: Number(previous.stateStartedAt) || nowMs,
    phoneStartedAt: Number(previous.phoneStartedAt) || null,
    focusStreakStartedAt: Number(previous.focusStreakStartedAt) || null,
    earnedBreakUntil: Number(previous.earnedBreakUntil) || null,
    lastAnySpokenAt: Number(previous.lastAnySpokenAt) || null,
    lastVisualSpokenAt: Number(previous.lastVisualSpokenAt) || null,
    phoneEventSpokenAt: Number(previous.phoneEventSpokenAt) || null,
    focusEncouragedAt: Number(previous.focusEncouragedAt) || null,
    absenceEventSpokenAt: Number(previous.absenceEventSpokenAt) || null,
    restEventSpokenAt: Number(previous.restEventSpokenAt) || null,
    lightEventSpokenAt: Number(previous.lightEventSpokenAt) || null,
    consecutiveNonPhone: Number(previous.consecutiveNonPhone) || 0
  };
  const previousState = previous.currentState || 'UNKNOWN';
  if (state !== previousState) next.stateStartedAt = nowMs;

  const productive = PRODUCTIVE_STATES.has(state);
  const previouslyProductive = PRODUCTIVE_STATES.has(previousState);
  if (productive) {
    next.focusStreakStartedAt = previouslyProductive && previous.focusStreakStartedAt
      ? Number(previous.focusStreakStartedAt) : nowMs;
  } else if (previouslyProductive && previous.focusStreakStartedAt) {
    const focusedMs = nowMs - Number(previous.focusStreakStartedAt);
    if (state === 'PHONE' && focusedMs >= 25 * 60 * 1000) next.earnedBreakUntil = nowMs + 3 * 60 * 1000;
    next.focusStreakStartedAt = null;
  }

  if (state !== 'ABSENT') next.absenceEventSpokenAt = null;
  if (state !== 'RESTING') next.restEventSpokenAt = null;

  if (state === 'PHONE') {
    next.consecutiveNonPhone = 0;
    if (!previous.phoneStartedAt || previousState !== 'PHONE') {
      next.phoneStartedAt = nowMs;
      next.phoneEventSpokenAt = null;
    }
  } else if (previous.phoneStartedAt) {
    next.consecutiveNonPhone = (Number(previous.consecutiveNonPhone) || 0) + 1;
    if (next.consecutiveNonPhone >= 2) {
      next.phoneStartedAt = null;
      next.phoneEventSpokenAt = null;
      next.earnedBreakUntil = null;
      next.consecutiveNonPhone = 0;
    }
  }

  let shouldSpeak = false;
  let reason = `${state} 默认沉默`;
  if (state === 'UNKNOWN') reason = '画面不确定，保持沉默';
  if (productive) reason = '用户正在认真学习，首次鼓励后不再打扰';
  if (state === 'PHONE') {
    const phoneSeconds = Math.max(0, Math.floor((nowMs - next.phoneStartedAt) / 1000));
    const firstPhoneReminder = !next.phoneEventSpokenAt;
    const thresholdSeconds = next.earnedBreakUntil && nowMs < next.earnedBreakUntil
      ? SPEECH_POLICY.earnedBreakPhoneThresholdSeconds
      : SPEECH_POLICY.firstPhoneThresholdSeconds;
    const globalCooldown = next.lastAnySpokenAt && nowMs - next.lastAnySpokenAt < SPEECH_POLICY.globalCooldownMs;
    const repeatCooldown = next.phoneEventSpokenAt && nowMs - next.phoneEventSpokenAt < SPEECH_POLICY.repeatPhoneCooldownMs;
    if (phoneSeconds < thresholdSeconds) reason = `连续玩手机${phoneSeconds}秒，未达到${thresholdSeconds}秒阈值`;
    else if (globalCooldown && !firstPhoneReminder) reason = '距离上次发言不足20秒';
    else if (repeatCooldown) reason = '同一次玩手机事件仍在1分钟冷却期';
    else {
      shouldSpeak = true;
      reason = `连续玩手机${phoneSeconds}秒，达到${thresholdSeconds}秒提醒阈值`;
      next.lastAnySpokenAt = nowMs;
      next.lastVisualSpokenAt = nowMs;
      next.phoneEventSpokenAt = nowMs;
    }
  } else if (productive && previousState === 'ABSENT') {
    shouldSpeak = true;
    reason = '用户离开后回到画面，回应一次';
    next.lastAnySpokenAt = nowMs;
    next.lastVisualSpokenAt = nowMs;
    next.focusEncouragedAt = next.focusEncouragedAt || nowMs;
  } else if (productive && !next.focusEncouragedAt) {
    shouldSpeak = true;
    reason = '首次识别到认真状态，鼓励一次';
    next.lastAnySpokenAt = nowMs;
    next.lastVisualSpokenAt = nowMs;
    next.focusEncouragedAt = nowMs;
  } else if (state === 'ABSENT' && !next.absenceEventSpokenAt) {
    shouldSpeak = true;
    reason = '用户刚刚离开画面，作出一次有趣反应';
    next.lastAnySpokenAt = nowMs;
    next.lastVisualSpokenAt = nowMs;
    next.absenceEventSpokenAt = nowMs;
  } else if (state === 'RESTING' && !next.restEventSpokenAt) {
    shouldSpeak = true;
    reason = '用户刚刚趴桌或明显休息，轻柔拉回任务';
    next.lastAnySpokenAt = nowMs;
    next.lastVisualSpokenAt = nowMs;
    next.restEventSpokenAt = nowMs;
  } else if (['DRINKING', 'STRETCHING'].includes(state) && state !== previousState
    && (!next.lightEventSpokenAt || nowMs - next.lightEventSpokenAt >= 90 * 1000)) {
    shouldSpeak = true;
    reason = state === 'DRINKING' ? '用户正在喝水，自然回应一次' : '用户正在伸展，自然回应一次';
    next.lastAnySpokenAt = nowMs;
    next.lastVisualSpokenAt = nowMs;
    next.lightEventSpokenAt = nowMs;
  }
  return { shouldSpeak, reason, state, policyState: next };
}

async function describeScene(image) {
  const apiUrl = process.env.VISION_API_URL;
  const apiKey = process.env.VISION_API_KEY;
  const model = process.env.VISION_MODEL;
  if (!apiUrl || !apiKey || !model) {
    throw new CompanionPipelineError('vision', '视觉模型尚未配置', 503);
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 160,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: '客观描述画面中用户此刻正在做什么。重点描述姿势、视线、手部动作，以及是否在写字、阅读、使用电脑、看手机、休息或离开。不要做 STUDYING/PHONE 等标签分类，不推测心理和动机。看不清或画面无人时如实说明。只输出 JSON：{"scene":"一到两句客观描述","uncertain":false}。'
          },
          { type: 'image_url', image_url: { url: image } }
        ]
      }]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Companion vision failed:', response.status, detail.slice(0, 500));
    throw new CompanionPipelineError('vision', '视觉描述生成失败', 502, detail.slice(0, 300));
  }

  const payload = await response.json();
  try {
    const parsed = extractJson(payload?.choices?.[0]?.message?.content);
    const scene = String(parsed.scene || '').trim();
    if (!scene) throw new Error('Empty scene');
    return { scene: scene.slice(0, 300), uncertain: Boolean(parsed.uncertain) };
  } catch (error) {
    console.error('Companion vision parse failed:', error);
    throw new CompanionPipelineError('vision', '视觉描述格式异常', 502);
  }
}

async function generateReaction({ scene, task, persona, sessionStartedAt, elapsedSeconds, recentObservations = [], triggerReason = '' }) {
  const sentenceCount = randomSpeechCount();

  const systemPrompt = [
    '你是正在通过视频陪伴用户专注的角色。',
    `角色人设：${persona || '毒舌但关心用户的陪伴者'}`,
    '根据摄像头刚刚看到的客观画面，自然地对用户说话。需要称呼时遵循角色人设中指定的称呼，不要每句都称呼。',
    FOCUS_SUPPORT_RULE,
    '你必须结合本轮专注已经持续的时间和最近观察理解上下文：长时间认真后短暂休息应体谅或轻松提醒；刚开始不久就分心可以更直接。不要把单帧画面孤立判断。',
    `要求：只输出${sentenceCount}句连续的口语短句，每句不超过15个汉字；短一点、自然一点，像真人微信语音；不要重复意思；不要输出引号、动作、旁白、标签、编号或分析；只能评论画面描述明确提供的事实，不得把不确定对象具体化。`
  ].join('\n');
  const elapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const history = recentObservations.length
    ? recentObservations.map(item => `- 专注第${Math.floor((Number(item.elapsedSeconds) || 0) / 60)}分钟：${item.scene}`).join('\n')
    : '暂无，这是本次专注的第一次观察。';
  const userMessage = [
    `当前任务：${task || '保持专注'}`,
    `本次专注开始时间：${sessionStartedAt}`,
    `目前已专注：${Math.floor(elapsed / 60)}分${Math.floor(elapsed % 60)}秒`,
    `本次触发原因：${triggerReason || '视觉状态变化'}`,
    `最近观察：\n${history}`,
    `最新画面：${scene}`
  ].join('\n');

  try {
    return cleanSpokenMessages(await deepSeek([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], { temperature: 0.85, maxTokens: 150 }), sentenceCount);
  } catch (error) {
    console.error('Companion reaction parse failed:', error);
    throw new CompanionPipelineError('reaction', 'AI 没有生成有效反应', 502);
  }
}

async function generateAmbient({ type, task, persona, elapsedSeconds, activity, scene, state }) {
  const sentenceCount = randomSpeechCount();
  const instruction = type === 'opening'
    ? '专注刚刚开始，请建立陪伴感，明确告诉用户你已经在这里陪着，不评价表现。'
    : type === 'opening_event'
      ? `这是开场后的第一次状态互动。最近画面：${scene || '暂未开启摄像头'}；状态：${state || 'UNKNOWN'}。自然回应当前情况；如果没有画面，就提醒用户开始当前任务。语气轻，不要像告警。`
      : type === 'praise'
    ? '用户已持续认真专注，请给一句有依据、不过度热情的夸奖。'
    : type === 'activity'
      ? `角色刚刚在${activity || '看书'}，自然地交代一下，同时不要要求用户回应。`
      : type === 'encourage'
        ? '用户已经进入学习状态，轻轻鼓励继续学，不要催促，不要要求回应。'
      : '长时间安静陪伴后，用一句话让用户知道你还在，不要打断其思路。';
  return cleanSpokenMessages(await deepSeek([
    { role: 'system', content: `你是${persona || '安静陪伴用户的角色'}。需要称呼时遵循人设中指定的称呼，不要每句都称呼。${FOCUS_SUPPORT_RULE}只输出${sentenceCount}句连续的自然口语短句，每句不超过15个汉字；像真人随口说话，意思自然推进，不要重复；不要引号、动作、旁白、编号或Markdown。` },
    { role: 'user', content: `当前任务：${task || '专注'}\n已专注${Math.floor((Number(elapsedSeconds) || 0) / 60)}分钟。${instruction}` }
  ], { temperature: 0.9, maxTokens: 140 }), sentenceCount);
}

async function generateDialogue({ text, task, persona, elapsedSeconds, scene, history = [] }) {
  const sentenceCount = randomSpeechCount();
  const recent = history.slice(-6).map(item => `${item.role === 'assistant' ? 'TA' : '用户'}：${String(item.content || '').slice(0, 200)}`).join('\n');
  const content = await deepSeek([
    {
      role: 'system',
      content: [
        `你是正在视频陪伴用户专注的角色。人设：${persona || '毒舌但关心用户的陪伴者'}`,
        FOCUS_SUPPORT_RULE,
        `用户刚刚主动对你说话，请直接自然回应。需要称呼时遵循人设中指定的称呼，不要每句都称呼。只输出${sentenceCount}句适合语音播放的口语短句，每句不超过15个汉字；短一点、自然一点，像真人微信语音；句子之间自然承接，不要重复；不要引号、动作、旁白、编号、列表或Markdown；不要凭空声称看到了画面没有提供的事实。`
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `当前任务：${task || '保持专注'}`,
        `已专注：${Math.floor((Number(elapsedSeconds) || 0) / 60)}分钟`,
        `最近画面：${scene || '暂无可靠画面'}`,
        recent ? `最近对话：\n${recent}` : '最近对话：暂无',
        `用户刚说：${String(text || '').slice(0, 500)}`
      ].join('\n')
    }
  ], { temperature: 0.8, maxTokens: 120 });
  return cleanSpokenMessages(content, sentenceCount);
}

async function generateSessionOpening({ task, persona }) {
  const content = await deepSeek([
    {
      role: 'system',
      content: [
        `你是即将陪用户开始一次专注的角色。人设：${persona || '温柔陪伴用户的学习搭子'}`,
        FOCUS_SUPPORT_RULE,
        '用户刚刚告诉你本次任务。结合角色名字、关系、人设、称呼和任务，只回复一句自然口语。',
        '不超过15个汉字，不要动作、旁白、引号、编号或Markdown；不要重复询问任务；表达“知道了，我会陪你开始”的感觉，但不要机械复述固定模板。'
      ].join('\n')
    },
    { role: 'user', content: `本次任务：${String(task || '保持专注').slice(0, 200)}` }
  ], { temperature: 0.85, maxTokens: 60 });
  return cleanSpokenMessages(content, 1);
}

async function runCompanionPipeline({ image, task, persona, epoch, turnId, sessionStartedAt, elapsedSeconds, recentObservations, policyState }) {
  const startedAt = Date.now();
  const visionStartedAt = Date.now();
  const observation = await describeScene(image);
  const visionMs = Date.now() - visionStartedAt;
  const state = await classifyScene(observation.scene, observation.uncertain);
  const decision = evaluateSpeechPolicy({ state, policyState });
  const reactionStartedAt = Date.now();
  const messages = decision.shouldSpeak ? await generateReaction({
    scene: observation.scene, task, persona,
    sessionStartedAt, elapsedSeconds, recentObservations,
    triggerReason: decision.reason
  }) : [];
  const reaction = messages.join('\n');
  const reactionMs = Date.now() - reactionStartedAt;

  return {
    epoch,
    turnId,
    observation: {
      observedAt: new Date().toISOString(),
      ttlMs: 120000,
      ...observation
    },
    decision,
    reaction,
    messages,
    context: {
      sessionStartedAt,
      elapsedSeconds,
      recentObservationCount: recentObservations?.length || 0
    },
    timings: {
      visionMs,
      reactionMs,
      totalMs: Date.now() - startedAt
    }
  };
}

module.exports = {
  CompanionPipelineError,
  describeScene,
  generateReaction,
  generateAmbient,
  generateDialogue,
  generateSessionOpening,
  classifyScene,
  evaluateSpeechPolicy,
  runCompanionPipeline
};
