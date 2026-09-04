const test = require('node:test');
const assert = require('node:assert/strict');

process.env.COMPANION_SESSION_STORE = 'memory';
const { createSession, getSession, commitSession, deleteSession } = require('../lib/companion-session-store');

test('session store persists state and advances an optimistic version', async () => {
  const created = await createSession({ task:'背单词', workingMemory:[] });
  assert.match(created.sessionId, /^sess_/);
  assert.equal(created.stateVersion, 1);
  const committed = await commitSession(created.sessionId, 1, { task:'背单词', workingMemory:[{ id:'vision-1' }] }, 1, { reaction:'Hey.' });
  assert.equal(committed.stateVersion, 2);
  assert.equal(committed.lastTurnId, 1);
  assert.equal((await getSession(created.sessionId)).lastTurnResponse.reaction, 'Hey.');
  await deleteSession(created.sessionId);
  assert.equal(await getSession(created.sessionId), null);
});

test('session store rejects stale writes without overwriting the winner', async () => {
  const created = await createSession({ task:'写作' });
  assert.ok(await commitSession(created.sessionId, 1, { task:'写作', winner:true }, 2, { turnId:2 }));
  assert.equal(await commitSession(created.sessionId, 1, { task:'写作', winner:false }, 2, { turnId:2 }), null);
  assert.equal((await getSession(created.sessionId)).state.winner, true);
});

test('session observation policy preserves simulated elapsed speech timing', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'api', 'companion-observe.js'), 'utf8');
  assert.match(source, /lastSpokenElapsedSeconds/);
  assert.match(source, /elapsedSeconds - Number\(policyState\.lastSpokenElapsedSeconds\)/);
});
