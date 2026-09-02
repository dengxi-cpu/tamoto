const test = require('node:test');
const assert = require('node:assert/strict');
const { decodePipelineTrace, visualPipelineTrace, memoryEventTrace, dialogueTrace } = require('../lib/companion-trace');

test('visual trace lists VLM through TTS without embedding image payload', () => {
  const encoded = visualPipelineTrace({
    image:'data:image/jpeg;base64,abcdef', task:'写报告', persona:'严格搭子', elapsedSeconds:60,
    workingMemory:[{ id:'e1', observation:'用户坐在桌前' }], storyMemory:{ summary:'开始写作' },
    relationshipMemory:{ preferences:[] }, conversationHistory:[], policyState:{}, roleContext:{ voiceType:'voice-a' }
  }, {
    observation:{ scene:'用户正在打字', state:'COMPUTER_WORK', confidence:.9 },
    memory:{ shouldSpeak:false, responseIntent:'继续观察', evidenceEventIds:['e1'] },
    decision:{ decisionId:'1-2-memory', shouldSpeak:false }, messages:[], performance:null,
    timings:{ visionMs:100, memoryMs:200, reactionMs:0 }
  });
  const trace = decodePipelineTrace(encoded);
  assert.deepEqual(trace.stages.map(stage=>stage.id), ['vlm','working_memory','memory_llm','actor_llm','tts']);
  assert.equal(trace.stages[0].input.image.payload, '[omitted from trace; see captured image]');
  assert.doesNotMatch(encoded, /abcdef/);
});

test('session and dialogue traces expose memory, actor and TTS stages', () => {
  const eventTrace = decodePipelineTrace(memoryEventTrace({ eventType:'completion', eventDescription:'完成专注' }, { memory:{ shouldSpeak:true }, messages:['做完了，辛苦啦。'] }));
  assert.deepEqual(eventTrace.stages.map(stage=>stage.id), ['working_memory','memory_llm','actor_llm','tts']);
  const chatTrace = decodePipelineTrace(dialogueTrace({ text:'我有点累' }, { memory:{ shouldSpeak:true }, messages:['再坚持一下。'] }));
  assert.deepEqual(chatTrace.stages.map(stage=>stage.id), ['user_input','working_memory','memory_llm','actor_llm','tts']);
});

test('invalid and legacy log text remains backward compatible', () => {
  assert.equal(decodePipelineTrace('普通旧日志'), null);
  assert.equal(decodePipelineTrace('__COMPANION_PIPELINE_TRACE_V1__{bad'), null);
});
