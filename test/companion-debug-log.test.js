const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryDebugText } = require('../api/companion-observe');

test('Memory LLM debug log contains decision evidence and expiry', () => {
  const output = memoryDebugText({
    decision: {
      decisionId: '2-7-memory', shouldSpeak: true,
      reason: '回应用户重新投入任务',
      evidenceEventIds: ['2-5-vision', '2-6-user_speech'],
      validUntil: '2026-09-02T10:00:15.000Z'
    },
    memory: { responseIntent: '肯定用户回到任务' }
  });
  assert.match(output, /decisionId: 2-7-memory/);
  assert.match(output, /shouldSpeak: true/);
  assert.match(output, /evidence: 2-5-vision, 2-6-user_speech/);
  assert.match(output, /validUntil: 2026-09-02T10:00:15.000Z/);
  assert.match(output, /intent: 肯定用户回到任务/);
});
