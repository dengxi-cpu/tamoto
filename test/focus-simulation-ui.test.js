const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'pipeline-batch-test.js'), 'utf8');
const companionSource = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'focus-companion.js'), 'utf8');

test('independent frame generation rebuilds context from completed rows above it', () => {
  assert.match(source, /function contextBefore\(index\)/);
  assert.match(source, /if\(previous\.result\)appendContext\(context,previous,previous\.result,i\*interval\(\)\)/);
  assert.match(source, /runFrame\(item,index,context\)/);
  assert.doesNotMatch(source, /runFrame\(item,rows\.indexOf\(item\),null\)/);
});

test('batch baseline captures bytes, model tokens, latency, and TTS first byte', () => {
  assert.match(source, /function collectMetrics\(\)/);
  assert.match(source, /imageAverage/);
  assert.match(source, /memoryInputAverage/);
  assert.match(source, /actorInputAverage/);
  assert.match(source, /ttsFirstByteAverage/);
  assert.match(source, /totalBeforeAudioAverage/);
  assert.match(source, /pipelineVersion:'v1-baseline'/);
  assert.match(source, /function exportBaseline\(\)/);
});

test('default regression sequence includes distraction, ignored request, and recovery expectations', () => {
  assert.match(source, /首次发现玩手机，拉回当前任务/);
  assert.match(source, /识别上一轮提醒被忽略并改变表达策略/);
  assert.match(source, /继续承接被忽略的互动，不复述旧句/);
  assert.match(source, /识别用户执行要求，只做一次克制确认/);
});

test('beta runtime uses compact session observations and retains a V1 fallback', () => {
  assert.match(companionSource, /isBetaSessionRuntime\(\)/);
  assert.match(companionSource, /\/api\/companion-session/);
  assert.match(companionSource, /\{ image, sessionId:state\.serverSessionId, turnId, elapsedSeconds \}/);
  assert.match(companionSource, /V2 observation failed; retrying once with V1/);
  assert.match(companionSource, /window\.APP_BASE === '\/beta'/);
});
