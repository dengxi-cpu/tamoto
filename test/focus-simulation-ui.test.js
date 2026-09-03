const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'pipeline-batch-test.js'), 'utf8');

test('independent frame generation rebuilds context from completed rows above it', () => {
  assert.match(source, /function contextBefore\(index\)/);
  assert.match(source, /if\(previous\.result\)appendContext\(context,previous,previous\.result,i\*interval\(\)\)/);
  assert.match(source, /runFrame\(item,index,context\)/);
  assert.doesNotMatch(source, /runFrame\(item,rows\.indexOf\(item\),null\)/);
});
