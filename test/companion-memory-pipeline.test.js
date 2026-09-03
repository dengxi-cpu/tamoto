const test = require('node:test');
const assert = require('node:assert/strict');

process.env.VISION_API_URL = 'https://vision.test/chat';
process.env.VISION_API_KEY = 'vision-key';
process.env.VISION_MODEL = 'vision-model';
process.env.DEEPSEEK_API_KEY = 'deepseek-key';

const { runCompanionPipeline, runDialogueMemoryPipeline, runMemoryEventPipeline, consolidateRelationshipMemory } = require('../lib/companion-pipeline');

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

test('visual event flows through Memory LLM and Actor LLM', async () => {
  const responses = [
    { observation: '用户重新拿起手机并滑动屏幕。', visibleFacts: { phone: true, gaze: 'down', hands: 'holding_phone', position: 'center' }, state: 'PHONE', confidence: 0.94 },
    { shouldUpdateStory: true, evidenceEventIds:['promise-event'], storyMemory: { version: 1, sessionGoal: '背50个单词', summary: '用户刚说只看一下，现在又拿起手机。', importantMoments: [], openLoops: [{ id: 'promise-1', content: '用户说只看一下', status: 'open', evidenceEventIds: [] }], characterState: { emotion: 'amused_annoyed', tension: 'medium', attitude: '有点被气笑' }, lastInteraction: null }, currentSituation: '用户再次拿起手机。', behaviorChange: '与刚才的承诺矛盾。', characterState: { emotion: 'amused_annoyed', tension: 'medium', attitude: '有点被气笑' }, responseIntent: '接住刚才的承诺调侃，不说教。', shouldSpeak: true, silentReaction: 'watching' },
    { text: '……这就是你说的看一下？', performance: { emotion: 'amused_annoyed', intensity: 0.35, pace: 'slow', pauseBefore: 600 } }
  ];
  global.fetch = async () => jsonResponse({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] });

  const result = await runCompanionPipeline({
    image: 'data:image/jpeg;base64,AA==', task: '背50个单词', persona: '毒舌但关心用户',
    epoch: 1, turnId: 2, sessionStartedAt: new Date().toISOString(), elapsedSeconds: 440,
    recentObservations: [],
    workingMemory: [{ observedAt: new Date().toISOString(), elapsedSeconds: 430, observation: '用户放下手机开始看书。', changes: [], reaction: '好。' }],
    storyMemory: '用户说只看一下后放下了手机。', relationshipMemory: '用户常说只玩五分钟。',
    conversationHistory: [{ role: 'user', content: '我就看一下。' }], policyState: {}
  });

  assert.equal(result.decision.shouldSpeak, true);
  assert.equal(result.decision.speechMode, 'actor');
  assert.equal(result.decision.decisionId, '1-2-memory');
  assert.deepEqual(result.decision.evidenceEventIds, ['promise-event']);
  assert.ok(result.decision.validUntil > Date.now());
  assert.equal(result.decision.policyState.lastAnySpokenAt, null);
  assert.equal(result.memory.characterState.emotion, 'amused_annoyed');
  assert.equal(result.performance.pauseBefore, 600);
  assert.deepEqual(result.messages, ['……这就是你说的看一下？']);
});

test('Memory LLM can choose silence without calling Actor LLM', async () => {
  let calls = 0;
  const responses = [
    { observation: '用户持续低头书写。', visibleFacts: { phone: false, gaze: 'down', hands: 'writing', position: 'center' }, state: 'WRITING', confidence: 0.96 },
    { shouldUpdateStory: false, storyMemory: {}, currentSituation: '仍在书写。', behaviorChange: '无明显变化。', characterState: { emotion: 'calm', tension: 'low', attitude: '安静陪伴' }, responseIntent: '用户正在专注，不打扰。', shouldSpeak: false, silentReaction: 'watching' }
  ];
  global.fetch = async () => {
    calls += 1;
    return jsonResponse({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] });
  };

  const result = await runCompanionPipeline({
    image: 'data:image/jpeg;base64,AA==', task: '写作业', persona: '温柔陪伴者', epoch: 1, turnId: 3,
    sessionStartedAt: new Date().toISOString(), elapsedSeconds: 120, recentObservations: [], workingMemory: [], policyState: {}
  });

  assert.equal(calls, 2);
  assert.equal(result.decision.shouldSpeak, false);
  assert.equal(result.decision.silentReaction, 'watching');
  assert.equal(result.memory.shouldUpdateStory, false);
  assert.deepEqual(result.messages, []);
  assert.equal(result.performance, null);
});

test('unchanged observation preserves structured Story Memory and open loops', async () => {
  const existingStory = {
    version: 1, sessionGoal: '写作业', summary: '用户答应写完这一页。', importantMoments: [],
    openLoops: [{ id: 'loop-1', content: '写完这一页', status: 'open', evidenceEventIds: ['event-1'] }],
    characterState: { emotion: 'calm', tension: 'low', attitude: '安静陪伴' }, lastInteraction: null
  };
  const responses = [
    { observation: '用户仍在写字。', visibleFacts: { phone: false }, state: 'WRITING', confidence: 0.95 },
    { shouldUpdateStory: false, storyMemory: { summary: '不应覆盖旧记忆' }, currentSituation: '用户仍在写字。', behaviorChange: '无明显变化。', characterState: { emotion: 'calm', tension: 'low', attitude: '安静陪伴' }, responseIntent: '继续沉默。', shouldSpeak: false, silentReaction: 'watching' }
  ];
  global.fetch = async () => jsonResponse({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] });
  const result = await runCompanionPipeline({
    image: 'data:image/jpeg;base64,AA==', task: '写作业', persona: '安静陪伴者', epoch: 1, turnId: 4,
    sessionStartedAt: new Date().toISOString(), elapsedSeconds: 180, recentObservations: [], workingMemory: [], storyMemory: existingStory, policyState: {}
  });
  assert.equal(result.memory.storyMemory.summary, existingStory.summary);
  assert.equal(result.memory.storyMemory.openLoops[0].status, 'open');
});

test('session story is consolidated into durable relationship memory', async () => {
  global.fetch = async () => jsonResponse({ choices: [{ message: { content: JSON.stringify({
    relationshipMemory: {
      version:1, preferences:[],
      behaviorPatterns:[{ id:'phone-five-minutes', content:'用户容易用“只看五分钟”延长手机时间。', evidenceCount:2, confidence:0.8, firstSeenAt:'', lastValidatedAt:'', sourceSessions:['s1','s2'] }],
      effectiveCompanionStrategies:[{ id:'light-teasing', content:'轻松调侃比重复说教更有效。', evidenceCount:2, confidence:0.8, firstSeenAt:'', lastValidatedAt:'', sourceSessions:['s1','s2'] }],
      dislikedBehaviors:[], achievements:[], relationshipFacts:[]
    },
    added: ['手机使用习惯', '有效提醒方式'], discardedReason: '丢弃单帧和时间戳'
  }) } }] });

  const memory = await consolidateRelationshipMemory({
    relationshipMemory: '- 用户不喜欢频繁打扰。',
    storyMemory: '用户说只看五分钟，之后仍继续看手机；轻松调侃后放下。',
    workingMemory: [], conversationHistory: [], task: '背单词'
  });

  assert.match(memory.behaviorPatterns[0].content, /五分钟/);
  assert.match(memory.effectiveCompanionStrategies[0].content, /调侃/);
});

test('single low-confidence observation is not promoted to a behavior pattern', async () => {
  global.fetch = async () => jsonResponse({ choices:[{ message:{ content:JSON.stringify({
    relationshipMemory:{ version:1, preferences:[], behaviorPatterns:[{ id:'one-off', content:'用户总是会分心', evidenceCount:1, confidence:0.6, firstSeenAt:'', lastValidatedAt:'', sourceSessions:['s1'] }], effectiveCompanionStrategies:[], dislikedBehaviors:[], achievements:[], relationshipFacts:[] },
    added:[], discardedReason:'证据不足'
  }) } }] });
  const memory = await consolidateRelationshipMemory({ storyMemory:{ version:1, summary:'用户本轮拿过一次手机。' }, workingMemory:[], conversationHistory:[], task:'学习' });
  assert.deepEqual(memory.behaviorPatterns, []);
});

test('fulfilled promise can close an open loop', async () => {
  const responses = [
    { observation:'用户已经放下手机并重新开始书写。', visibleFacts:{ phone:false, gaze:'down', hands:'writing', position:'center' }, state:'WRITING', confidence:0.95 },
    { shouldUpdateStory:true, evidenceEventIds:['promise-1','vision-put-down'], storyMemory:{ version:1, sessionGoal:'写作业', summary:'用户答应放下手机后重新开始书写。', importantMoments:[], openLoops:[{ id:'put-phone-down', content:'用户答应放下手机', status:'resolved', evidenceEventIds:['promise-1','vision-put-down'] }], characterState:{ emotion:'relieved', tension:'low', attitude:'安静陪伴' }, lastInteraction:{ type:'vision', summary:'用户重新书写', elapsedSeconds:330 } }, currentSituation:'用户已经重新书写。', behaviorChange:'此前未完成的承诺已经兑现。', characterState:{ emotion:'relieved', tension:'low', attitude:'不打扰用户' }, responseIntent:'承诺已兑现且用户正在专注，保持沉默。', shouldSpeak:false, silentReaction:'watching' }
  ];
  global.fetch = async () => jsonResponse({ choices:[{ message:{ content:JSON.stringify(responses.shift()) } }] });
  const result = await runCompanionPipeline({
    image:'data:image/jpeg;base64,AA==', task:'写作业', persona:'陪伴者', epoch:4, turnId:2,
    sessionStartedAt:new Date().toISOString(), elapsedSeconds:330, recentObservations:[], workingMemory:[],
    storyMemory:{ version:1, sessionGoal:'写作业', summary:'用户答应放下手机。', importantMoments:[], openLoops:[{ id:'put-phone-down', content:'用户答应放下手机', status:'open', evidenceEventIds:['promise-1'] }], characterState:{}, lastInteraction:null }, policyState:{}
  });
  assert.equal(result.memory.storyMemory.openLoops[0].status, 'resolved');
  assert.equal(result.decision.shouldSpeak, false);
});

test('user dialogue uses Memory LLM before Actor LLM', async () => {
  const responses = [
    { shouldUpdateStory: true, storyMemory: { version: 1, sessionGoal: '背单词', summary: '用户刚承诺只看一下。', importantMoments: [], openLoops: [], characterState: {}, lastInteraction: { type: 'user_speech', summary: '用户说只看一下', elapsedSeconds: 300 } }, currentSituation: '用户主动解释。', behaviorChange: '用户回应了刚才的提醒。', characterState: { emotion: 'amused', tension: 'low', attitude: '不完全相信但觉得好笑' }, responseIntent: '承接用户的话轻轻调侃。', shouldSpeak: true, silentReaction: 'listening' },
    { text: '行，我看着你呢。', performance: { emotion: 'amused', intensity: 0.25, pace: 'slow', pauseBefore: 250 } }
  ];
  global.fetch = async () => jsonResponse({ choices: [{ message: { content: JSON.stringify(responses.shift()) } }] });
  const result = await runDialogueMemoryPipeline({
    text: '我就看一下', task: '背单词', persona: '嘴硬但关心用户', elapsedSeconds: 300,
    history: [], workingMemory: [], storyMemory: '', relationshipMemory: '用户常说只玩五分钟。'
  });
  assert.equal(result.memory.shouldSpeak, true);
  assert.deepEqual(result.messages, ['行，我看着你呢。']);
  assert.equal(result.performance.pauseBefore, 250);
});

test('invalid Memory LLM output retries then safely degrades to silence', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) return jsonResponse({ choices: [{ message: { content: JSON.stringify({ observation: '用户正在写字。', visibleFacts: { phone: false }, state: 'WRITING', confidence: 0.9 }) } }] });
    return jsonResponse({ choices: [{ message: { content: '{"shouldSpeak":"yes"}' } }] });
  };
  const result = await runCompanionPipeline({
    image: 'data:image/jpeg;base64,AA==', task: '写作业', persona: '安静陪伴者', epoch: 2, turnId: 1,
    sessionStartedAt: new Date().toISOString(), elapsedSeconds: 60, recentObservations: [], workingMemory: [], storyMemory: '用户正在写作业。', policyState: {}
  });
  assert.equal(calls, 3);
  assert.equal(result.memory.degraded, true);
  assert.equal(result.decision.shouldSpeak, false);
  assert.deepEqual(result.messages, []);
});

test('completion event is directed by Memory LLM and spoken by Actor LLM', async () => {
  const responses = [
    { shouldUpdateStory:true, storyMemory:{ version:1, sessionGoal:'写作业', summary:'用户完成了本轮任务。', importantMoments:[{ id:'done-1', summary:'完成任务', elapsedSeconds:1500 }], openLoops:[], characterState:{}, lastInteraction:{ type:'session', summary:'完成专注', elapsedSeconds:1500 } }, currentSituation:'用户完成专注。', behaviorChange:'任务从进行中变为完成。', characterState:{ emotion:'proud', tension:'low', attitude:'为用户感到高兴' }, responseIntent:'引用本轮坚持完成的事实具体表扬并自然收尾。', shouldSpeak:false, silentReaction:'silent' },
    { text:'这次真坚持下来了。', performance:{ emotion:'proud', intensity:0.4, pace:'slow', pauseBefore:300 } }
  ];
  global.fetch = async () => jsonResponse({ choices:[{ message:{ content:JSON.stringify(responses.shift()) } }] });
  const result = await runMemoryEventPipeline({ eventType:'completion', eventDescription:'用户完成了本次专注。', task:'写作业', persona:'温柔陪伴者', elapsedSeconds:1500 });
  assert.deepEqual(result.messages, ['这次真坚持下来了。']);
  assert.equal(result.memory.storyMemory.importantMoments[0].summary, '完成任务');
});

test('later visual reaction can reference an unresolved earlier promise', async () => {
  const promiseStory = {
    version:1, sessionGoal:'背单词', summary:'用户说只看一下手机。', importantMoments:[],
    openLoops:[{ id:'phone-promise', content:'用户说只看一下手机', status:'open', evidenceEventIds:['speech-1'] }],
    characterState:{ emotion:'calm', tension:'low', attitude:'先观察' },
    lastInteraction:{ type:'user_speech', summary:'用户说只看一下', elapsedSeconds:300 }
  };
  const responses = [
    { observation:'用户再次拿起手机并滑动屏幕。', visibleFacts:{ phone:true, gaze:'down', hands:'holding_phone', position:'center' }, state:'PHONE', confidence:0.95 },
    { shouldUpdateStory:true, evidenceEventIds:['speech-1','vision-2'], storyMemory:{ ...promiseStory, summary:'用户承诺只看一下后又拿起手机。', openLoops:[{ id:'phone-promise', content:'用户说只看一下手机', status:'open', evidenceEventIds:['speech-1','vision-2'] }] }, currentSituation:'用户再次拿起手机。', behaviorChange:'此前承诺尚未兑现。', characterState:{ emotion:'amused_annoyed', tension:'medium', attitude:'被气笑但不说教' }, responseIntent:'直接承接用户刚才“只看一下”的承诺进行调侃。', shouldSpeak:true, silentReaction:'watching' },
    { text:'你的“一下”还没结束？', performance:{ emotion:'amused_annoyed', intensity:0.35, pace:'slow', pauseBefore:400 } }
  ];
  global.fetch = async () => jsonResponse({ choices:[{ message:{ content:JSON.stringify(responses.shift()) } }] });
  const result = await runCompanionPipeline({
    image:'data:image/jpeg;base64,AA==', task:'背单词', persona:'毒舌青梅', epoch:3, turnId:8,
    sessionStartedAt:new Date().toISOString(), elapsedSeconds:320,
    recentObservations:[], workingMemory:[{ id:'speech-1', type:'user_speech', observedAt:new Date().toISOString(), elapsedSeconds:300, observation:'用户说：我就看一下', changes:[], confidence:1, reaction:'' }],
    storyMemory:promiseStory, relationshipMemory:'用户常说只玩五分钟。', conversationHistory:[{ role:'user', content:'我就看一下' }], policyState:{}
  });
  assert.match(result.reaction, /一下/);
  assert.deepEqual(result.decision.evidenceEventIds, ['speech-1','vision-2']);
  assert.equal(result.memory.storyMemory.openLoops[0].status, 'open');
});

test('interaction memory sends the last actor request and later evidence to Memory LLM', async () => {
  const requestBodies = [];
  const responses = [
    { observation:'用户仍手持手机注视屏幕。', visibleFacts:{ phone:true }, state:'PHONE', confidence:0.98 },
    { shouldUpdateStory:false, storyMemory:{}, behaviorTransition:{ from:'PHONE', to:'PHONE', meaning:'用户未响应上一句' }, interactionOutcome:{ type:'ignored_previous_request', evidence:'提醒后仍看手机', confidence:0.96 }, characterShift:{ from:'克制提醒', to:'更严肃', reason:'要求未被响应' }, characterState:{ emotion:'firm', tension:'medium', attitude:'更严肃' }, expressionStrategy:{ approach:'追问', structure:'一句短问句', pressureLever:'指出上一句没有被执行', variationFromLast:'从命令切换为追问' }, intendedUserAction:'停止看手机并拿起笔', responseIntent:'承接被忽视的上一句，用更短的追问', avoidRepetition:['手机放下'], shouldSpeak:true, silentReaction:'watching' },
    { text:'还在看？', performance:{ emotion:'firm', intensity:0.55, pace:'slow', pauseBefore:300 } }
  ];
  global.fetch = async (_url, options = {}) => {
    if (options.body) requestBodies.push(JSON.parse(options.body));
    return jsonResponse({ choices:[{ message:{ content:JSON.stringify(responses.shift()) } }] });
  };
  const result = await runCompanionPipeline({
    image:'data:image/jpeg;base64,AA==', task:'写作业', persona:'严格但关心用户', epoch:8, turnId:2,
    sessionStartedAt:new Date().toISOString(), elapsedSeconds:20, recentObservations:[], policyState:{},
    workingMemory:[{ id:'frame-1', type:'vision', elapsedSeconds:0, state:'PHONE', observation:'用户看手机', reaction:'手机先放下。', actorAction:{ said:'手机先放下。', intent:'拉回任务', intendedUserAction:'停止看手机并拿起笔', outputLanguage:'zh' } }]
  });
  const memoryInput = requestBodies[1].messages.find(message => message.role === 'user').content;
  assert.match(memoryInput, /上一轮待判断互动/);
  assert.match(memoryInput, /手机先放下/);
  assert.match(memoryInput, /停止看手机并拿起笔/);
  assert.equal(result.memory.interactionOutcome.type, 'ignored_previous_request');
  assert.deepEqual(result.memory.avoidRepetition, ['手机放下']);
  assert.deepEqual(result.messages, ['还在看？']);
  assert.equal(result.memory.expressionStrategy.approach, '追问');
});

test('invalid Actor output retries then speaks through fallback instead of swallowing a PHONE intervention', async () => {
  let calls = 0;
  const responses = [
    { observation:'用户重新拿起手机并注视屏幕。', visibleFacts:{ phone:true, gaze:'on phone screen' }, state:'PHONE', confidence:1 },
    { shouldUpdateStory:true, evidenceEventIds:['vision-120'], storyMemory:{}, behaviorTransition:{ from:'WRITING', to:'PHONE', meaning:'刚恢复后再次分心' }, interactionOutcome:{ type:'ignored_previous_request', evidence:'用户再次拿起手机', confidence:1 }, characterShift:{ from:'克制认可', to:'认真拉回', reason:'刚恢复又分心' }, characterState:{ emotion:'firm', tension:'medium', attitude:'认真拉回' }, expressionStrategy:{ approach:'共同经历', structure:'先点出刚才恢复，再给一个最小动作', pressureLever:'刚刚共同完成的恢复', variationFromLast:'不重复放下手机命令，改为承接刚才' }, intendedUserAction:'放下手机并继续背单词', responseIntent:'承接刚恢复又分心的共同经历', avoidRepetition:['手机放下'], shouldSpeak:true, silentReaction:'watching' },
    'not json',
    '{"text":""}'
  ];
  global.fetch = async () => {
    calls += 1;
    const next = responses.shift();
    return jsonResponse({ choices:[{ message:{ content:typeof next === 'string' ? next : JSON.stringify(next) } }] });
  };
  const result = await runCompanionPipeline({
    image:'data:image/jpeg;base64,AA==', task:'背单词', persona:'毒舌且话痨', epoch:11, turnId:7,
    sessionStartedAt:new Date().toISOString(), elapsedSeconds:120, recentObservations:[], policyState:{}, outputLanguage:'en',
    workingMemory:[{ id:'frame-6', type:'vision', elapsedSeconds:100, state:'WRITING', observation:'用户在写字', reaction:'', actorAction:null }]
  });
  assert.equal(calls, 4);
  assert.equal(result.decision.shouldSpeak, true);
  assert.equal(result.decision.speechMode, 'actor');
  assert.equal(result.actorDegraded, true);
  assert.match(result.reaction, /Screen down/);
  assert.ok(result.messages.length > 0);
});

test('followed request can be acknowledged once while stable focus stays silent', async () => {
  const responses = [
    { observation:'用户放下手机重新持笔书写。', visibleFacts:{ phone:false, hands:'writing' }, state:'WRITING', confidence:0.96 },
    { shouldUpdateStory:true, evidenceEventIds:['frame-1','vision-20'], storyMemory:{ version:1, sessionGoal:'写作业', summary:'用户听从提醒恢复书写。', importantMoments:[], openLoops:[{ id:'return', content:'放下手机回到任务', status:'resolved', evidenceEventIds:['frame-1','vision-20'] }], characterState:{ emotion:'relieved', tension:'low', attitude:'克制认可' }, lastInteraction:{ type:'vision', summary:'用户恢复书写', elapsedSeconds:20 } }, behaviorTransition:{ from:'PHONE', to:'WRITING', meaning:'用户回应了上一轮要求' }, interactionOutcome:{ type:'followed_previous_request', evidence:'手机消失并重新持笔', confidence:0.95 }, characterShift:{ from:'严肃督促', to:'克制认可', reason:'用户执行了要求' }, characterState:{ emotion:'relieved', tension:'low', attitude:'克制认可' }, intendedUserAction:'继续当前任务', responseIntent:'只简短确认一次，然后不再打扰', avoidRepetition:['手机放下'], shouldSpeak:true, silentReaction:'watching' },
    { text:'嗯，继续。', performance:{ emotion:'relieved', intensity:0.25, pace:'slow', pauseBefore:100 } }
  ];
  global.fetch = async () => jsonResponse({ choices:[{ message:{ content:JSON.stringify(responses.shift()) } }] });
  const result = await runCompanionPipeline({
    image:'data:image/jpeg;base64,AA==', task:'写作业', persona:'严格但关心用户', epoch:9, turnId:2,
    sessionStartedAt:new Date().toISOString(), elapsedSeconds:20, recentObservations:[], policyState:{},
    workingMemory:[{ id:'frame-1', type:'vision', elapsedSeconds:0, state:'PHONE', observation:'用户看手机', reaction:'手机放下。', actorAction:{ said:'手机放下。', intendedUserAction:'停止看手机并恢复书写', outputLanguage:'zh' } }]
  });
  assert.equal(result.memory.interactionOutcome.type, 'followed_previous_request');
  assert.equal(result.memory.storyMemory.openLoops[0].status, 'resolved');
  assert.equal(result.decision.shouldSpeak, true);
  assert.deepEqual(result.messages, ['嗯，继续。']);
});

test('Actor receives current output language as a hard session constraint', async () => {
  const requestBodies = [];
  const responses = [
    { observation:'用户正在看手机。', visibleFacts:{ phone:true }, state:'PHONE', confidence:1 },
    { shouldUpdateStory:false, storyMemory:{}, behaviorTransition:{}, interactionOutcome:{ type:'no_pending_request', evidence:'首次发现', confidence:1 }, characterShift:{}, characterState:{ emotion:'firm', tension:'low', attitude:'提醒' }, intendedUserAction:'put the phone down', responseIntent:'brief English reminder', avoidRepetition:[], shouldSpeak:true, silentReaction:'watching' },
    { text:'Eyes back here.', performance:{} }
  ];
  global.fetch = async (_url, options = {}) => { if (options.body) requestBodies.push(JSON.parse(options.body)); return jsonResponse({ choices:[{ message:{ content:JSON.stringify(responses.shift()) } }] }); };
  await runCompanionPipeline({ image:'data:image/jpeg;base64,AA==', task:'study', persona:'strict companion', epoch:10, turnId:1, elapsedSeconds:0, recentObservations:[], workingMemory:[], policyState:{}, outputLanguage:'en' });
  const actorInput = requestBodies[2].messages.find(message => message.role === 'user').content;
  assert.match(actorInput, /outputLanguage：en-US/);
  assert.deepEqual(requestBodies[1].response_format, { type:'json_object' });
  assert.deepEqual(requestBodies[2].response_format, { type:'json_object' });
  assert.equal(requestBodies[1].max_tokens, 420);
  assert.equal(requestBodies[2].max_tokens, 150);
});
