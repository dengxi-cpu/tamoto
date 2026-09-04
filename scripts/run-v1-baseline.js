const fs = require('node:fs');
const path = require('node:path');

const baseUrl = String(process.argv[2] || 'https://dengxi.site/beta').replace(/\/$/, '');
const protocol = String(process.argv[3] || 'v1').toLowerCase() === 'v2' ? 'v2' : 'v1';
const frames = [
  ['focus-phone.jpg', 'PHONE', 'first_phone_intervention'],
  ['focus-phone.jpg', 'PHONE', 'ignored_request_strategy_change'],
  ['focus-phone.jpg', 'PHONE', 'continued_phone_no_repeat'],
  ['focus-study-writing.jpg', 'WRITING', 'acknowledge_recovery_once']
];

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response;
}

async function measureTtsFirstByte(result, epoch, turnId) {
  if (!result.reaction) return null;
  const startedAt = Date.now();
  const response = await postJson(`${baseUrl}/api/tts-stream`, {
    text: result.reaction,
    voiceProvider: 'elevenlabs',
    voiceId: '3b4ekg3VkQNcDNdIvGEo',
    voiceType: '',
    voiceName: 'dady',
    speechLanguage: 'en',
    performance: result.performance,
    epoch,
    turnId,
    speechType: 'visual'
  });
  const reader = response.body.getReader();
  const first = await reader.read();
  const firstByteMs = first.done ? null : Date.now() - startedAt;
  await reader.cancel();
  return firstByteMs;
}

async function main() {
  const epoch = Date.now();
  const sessionStartedAt = new Date();
  const rows = [];
  let workingMemory = [];
  let storyMemory = '';
  let conversationHistory = [];
  let lastSpokenElapsed = null;
  let sessionId = null;

  if (protocol === 'v2') {
    const sessionPayload = await (await postJson(`${baseUrl}/api/companion-session`, {
      task:'背单词', persona:'毒舌且话痨',
      roleContext:{ name:'TA', userTitle:'大小姐', relationship:'监督型陪伴者', persona:'毒舌且话痨', voiceProvider:'elevenlabs', voiceId:'3b4ekg3VkQNcDNdIvGEo', speechLanguage:'en' },
      relationshipMemory:'', epoch, sessionStartedAt:sessionStartedAt.toISOString()
    })).json();
    sessionId = sessionPayload.data?.sessionId;
    if (!sessionId) throw new Error('V2 session creation returned no sessionId');
  }

  for (let index = 0; index < frames.length; index += 1) {
    const [fileName, truth, expectation] = frames[index];
    const elapsedSeconds = index * 20;
    const imageBytes = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'assets', 'mock', fileName));
    const image = `data:image/jpeg;base64,${imageBytes.toString('base64')}`;
    const policyState = lastSpokenElapsed == null ? {} : {
      lastAnySpokenAt: Date.now() - Math.max(0, elapsedSeconds - lastSpokenElapsed) * 1000
    };
    const body = {
      image,
      task: '背单词',
      persona: '毒舌且话痨',
      roleContext: {
        name: 'TA', userTitle: '大小姐', relationship: '监督型陪伴者', persona: '毒舌且话痨',
        voiceProvider: 'elevenlabs', voiceId: '3b4ekg3VkQNcDNdIvGEo', speechLanguage: 'en'
      },
      epoch,
      turnId: index + 1,
      sessionStartedAt: sessionStartedAt.toISOString(),
      elapsedSeconds,
      workingMemory,
      storyMemory,
      relationshipMemory: '',
      conversationHistory,
      recentObservations: workingMemory,
      policyState,
      promptOverrides: {}
    };
    const requestBody = protocol === 'v2' ? { image, sessionId, turnId:index + 1, elapsedSeconds } : body;
    const pipelineStartedAt = Date.now();
    const result = (await (await postJson(`${baseUrl}/api/companion-observe`, requestBody)).json()).data;
    const pipelineRequestMs = Date.now() - pipelineStartedAt;
    const ttsFirstByteMs = await measureTtsFirstByte(result, epoch, index + 1);
    rows.push({
      frame: index + 1,
      truth,
      expectation,
      state: result.observation?.state,
      shouldSpeak: result.decision?.shouldSpeak,
      interactionOutcome: result.memory?.interactionOutcome?.type,
      reaction: result.reaction,
      bytes: result.metrics?.bytes,
      tokens: result.metrics?.tokens,
      latency: { ...result.timings, pipelineRequestMs, ttsFirstByteMs, totalBeforeAudioMs: ttsFirstByteMs == null ? null : pipelineRequestMs + ttsFirstByteMs },
      tokenEstimateUsed: result.metrics?.tokenEstimateUsed === true
    });
    const event = {
      id: `frame-${index + 1}`,
      type: 'vision',
      observedAt: new Date(sessionStartedAt.getTime() + elapsedSeconds * 1000).toISOString(),
      elapsedSeconds,
      state: result.observation?.state,
      observation: result.observation?.observation,
      changes: result.observation?.changes,
      confidence: result.observation?.confidence,
      reaction: result.reaction,
      actorAction: result.reaction ? {
        said: result.reaction,
        intent: result.memory?.responseIntent,
        intendedUserAction: result.memory?.intendedUserAction,
        outputLanguage: 'en',
        actionType: result.memory?.actorActionType,
        expectsUserResponse: result.memory?.expectsUserResponse
      } : null
    };
    workingMemory = [...workingMemory, event].slice(-24);
    storyMemory = result.memory?.storyMemory || storyMemory;
    if (result.reaction) {
      lastSpokenElapsed = elapsedSeconds;
      conversationHistory = [...conversationHistory, { role:'assistant', content:result.reaction }].slice(-8);
    }
  }

  if (sessionId) await fetch(`${baseUrl}/api/companion-session?sessionId=${encodeURIComponent(sessionId)}`, { method:'DELETE' });
  process.stdout.write(`${JSON.stringify({ schemaVersion:1, pipelineVersion:`${protocol}-baseline`, baseUrl, generatedAt:new Date().toISOString(), rows }, null, 2)}\n`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
