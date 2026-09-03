const TRACE_PREFIX = '__COMPANION_PIPELINE_TRACE_V1__';

function imageDescriptor(image) {
  const value = String(image || '');
  const match = value.match(/^data:([^;,]+);base64,(.*)$/s);
  return match ? { mimeType: match[1], encodedBytes: match[2].length, payload: '[omitted from trace; see captured image]' } : null;
}

function encodePipelineTrace(summary, stages) {
  return TRACE_PREFIX + JSON.stringify({ version: 1, summary: String(summary || ''), stages });
}

function visualPipelineTrace(request, data) {
  const observation = data?.observation || {};
  const memory = data?.memory || {};
  const decision = data?.decision || {};
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const workingMemory = Array.isArray(request.workingMemory) ? request.workingMemory : [];
  return encodePipelineTrace(observation.scene || observation.observation || '', [
    {
      id: 'vlm', label: 'VLM 视觉编码', status: 'completed', durationMs: data?.timings?.visionMs,
      input: { image: imageDescriptor(request.image), task: request.task },
      output: observation
    },
    {
      id: 'working_memory', label: 'Working Memory', status: 'completed',
      input: { previousEvents: workingMemory, maxEvents: 24, ttlSeconds: 180 },
      output: { acceptedObservation: observation, eventCountBeforeAppend: workingMemory.length }
    },
    {
      id: 'memory_llm', label: 'Memory LLM', status: memory.degraded ? 'degraded' : 'completed', durationMs: data?.timings?.memoryMs,
      input: {
        observation, workingMemory, storyMemory: request.storyMemory || null,
        relationshipMemory: request.relationshipMemory || null,
        conversationHistory: request.conversationHistory || [], policyState: request.policyState || {},
        task: request.task, elapsedSeconds: request.elapsedSeconds
      },
      output: { memory, decision }
    },
    {
      id: 'actor_llm', label: 'Actor LLM', status: decision.shouldSpeak ? (data?.actorDegraded ? 'degraded' : messages.length ? 'completed' : 'degraded') : 'skipped', durationMs: data?.timings?.reactionMs,
      input: { persona: request.persona, task: request.task, memoryDecision: memory, relationshipMemory: request.relationshipMemory || null },
      output: { messages, performance: data?.performance || null, reaction: data?.reaction || '', fallbackUsed: data?.actorDegraded === true, error: data?.actorError || null }
    },
    {
      id: 'tts', label: 'TTS 输出', status: decision.shouldSpeak && messages.length ? 'pending' : 'skipped',
      input: { text: messages.join('\n'), performance: data?.performance || null, voice: request.roleContext || null },
      output: { status: decision.shouldSpeak && messages.length ? 'pending' : 'skipped', bytes: 0 }
    }
  ]);
}

function memoryEventTrace(request, data) {
  const memory = data?.memory || {};
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  return encodePipelineTrace(request.eventDescription || request.eventType || '', [
    {
      id: 'working_memory', label: 'Working Memory', status: 'completed',
      input: { events: request.workingMemory || [], event: { type: request.eventType, description: request.eventDescription } },
      output: { eventAccepted: true }
    },
    {
      id: 'memory_llm', label: 'Memory LLM', status: memory.degraded ? 'degraded' : 'completed',
      input: { eventType: request.eventType, eventDescription: request.eventDescription, workingMemory: request.workingMemory || [], storyMemory: request.storyMemory || null, relationshipMemory: request.relationshipMemory || null },
      output: memory
    },
    {
      id: 'actor_llm', label: 'Actor LLM', status: messages.length ? 'completed' : 'skipped',
      input: { persona: request.persona, task: request.task, memoryDecision: memory },
      output: { messages, performance: data?.performance || null }
    },
    {
      id: 'tts', label: 'TTS 输出', status: messages.length ? 'pending' : 'skipped',
      input: { text: messages.join('\n'), performance: data?.performance || null, voice: request.roleContext || null },
      output: { status: messages.length ? 'pending' : 'skipped', bytes: 0 }
    }
  ]);
}

function dialogueTrace(request, data) {
  const memory = data?.memory || {};
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  return encodePipelineTrace(`用户说：${request.text || ''}`, [
    { id: 'user_input', label: '用户输入', status: 'completed', input: { text: request.text }, output: { normalizedText: request.text } },
    { id: 'working_memory', label: 'Working Memory', status: 'completed', input: { events: request.workingMemory || [] }, output: { dialogueAdded: request.text } },
    { id: 'memory_llm', label: 'Memory LLM', status: memory.degraded ? 'degraded' : 'completed', input: { text: request.text, scene: request.scene || '', history: request.history || [], workingMemory: request.workingMemory || [], storyMemory: request.storyMemory || null, relationshipMemory: request.relationshipMemory || null }, output: memory },
    { id: 'actor_llm', label: 'Actor LLM', status: messages.length ? 'completed' : 'degraded', input: { persona: request.persona, task: request.task, memoryDecision: memory }, output: { messages, performance: data?.performance || null } },
    { id: 'tts', label: 'TTS 输出', status: messages.length ? 'pending' : 'skipped', input: { text: messages.join('\n'), performance: data?.performance || null, voice: request.roleContext || null }, output: { status: messages.length ? 'pending' : 'skipped', bytes: 0 } }
  ]);
}

function decodePipelineTrace(value) {
  if (typeof value !== 'string' || !value.startsWith(TRACE_PREFIX)) return null;
  try { return JSON.parse(value.slice(TRACE_PREFIX.length)); } catch (_) { return null; }
}

module.exports = { TRACE_PREFIX, encodePipelineTrace, decodePipelineTrace, visualPipelineTrace, memoryEventTrace, dialogueTrace };
