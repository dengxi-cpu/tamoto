const test = require('node:test');
const assert = require('node:assert/strict');
const { getModePolicy } = require('../frontend/js/companion-mode-policy');

test('quiet generates start and end content without autoplay or camera', () => {
  assert.deepEqual(getModePolicy('quiet'), {
    mode:'quiet', generateOpening:true, generateCompletion:true,
    autoPlayVoice:false, cameraRequired:false, realtimeVision:false
  });
});

test('occasional adds autoplay but no realtime camera behavior', () => {
  const policy = getModePolicy('occasional');
  assert.equal(policy.generateOpening, true);
  assert.equal(policy.generateCompletion, true);
  assert.equal(policy.autoPlayVoice, true);
  assert.equal(policy.realtimeVision, false);
});

test('strict adds mandatory camera and realtime vision', () => {
  const policy = getModePolicy('strict');
  assert.equal(policy.autoPlayVoice, true);
  assert.equal(policy.cameraRequired, true);
  assert.equal(policy.realtimeVision, true);
});
