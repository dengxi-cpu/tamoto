const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('beta focus runtime has no scheduled encouragement loop', () => {
  const source = fs.readFileSync(path.join(root, 'frontend/js/focus-companion.js'), 'utf8');
  assert.doesNotMatch(source, /setInterval\([^)]*(encour|praise|presence)/i);
  assert.doesNotMatch(source, /ambientCount/);
});

test('manual companion scenarios only retain opening, completion, and visual checks', () => {
  const source = fs.readFileSync(path.join(root, 'role-reaction-test.html'), 'utf8');
  assert.doesNotMatch(source, /type:'(?:praise|activity|presence)'/);
  assert.match(source, /type:'opening'/);
  assert.match(source, /eventType:'completion'/);
});

test('dashboard no longer labels retired mid-session speech categories', () => {
  const source = fs.readFileSync(path.join(root, 'frontend/js/events-dashboard.js'), 'utf8');
  assert.doesNotMatch(source, /encourage:'鼓励'|praise:'表扬'|presence:'陪伴'|activity:'同步活动'/);
  assert.match(source, /completion:'结束鼓励与结束语'/);
});
