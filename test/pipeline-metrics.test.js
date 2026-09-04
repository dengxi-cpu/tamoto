const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pipeline = fs.readFileSync(path.join(__dirname, '..', 'lib', 'companion-pipeline.js'), 'utf8');
const observe = fs.readFileSync(path.join(__dirname, '..', 'api', 'companion-observe.js'), 'utf8');

test('pipeline records provider usage without adding metrics to model prompts', () => {
  assert.match(pipeline, /function recordModelUsage\(/);
  assert.match(pipeline, /payload\?\.usage/);
  assert.match(pipeline, /tokenEstimateUsed/);
  assert.match(pipeline, /modelCalls/);
  assert.doesNotMatch(pipeline, /`[^`]*metrics[^`]*`/i);
});

test('observe response reports image, request, and response byte baselines', () => {
  assert.match(observe, /function dataUrlPayloadBytes\(/);
  assert.match(observe, /Buffer\.byteLength\(JSON\.stringify\(req\.body/);
  assert.match(observe, /data\.metrics\.bytes\.response/);
});
