const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMemoryCommand } = require('../frontend/js/companion-memory-command');

test('recognizes explicit recent-memory deletion commands', () => {
  for (const text of ['别记这个', '不要记住这个。', '忘掉刚才', '忘记刚才那件事！']) {
    assert.deepEqual(parseMemoryCommand(text), { type: 'forget_recent' });
  }
});

test('does not treat ordinary memory discussion as a destructive command', () => {
  for (const text of ['你还记得刚才吗', '我的记忆不太好', '别记错了', '忘掉烦恼']) {
    assert.equal(parseMemoryCommand(text), null);
  }
});
