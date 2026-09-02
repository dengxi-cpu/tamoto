(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.companionMemoryCommand = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function normalize(text) {
    return String(text || '').trim().replace(/[，。！？!?,.\s]/g, '');
  }

  function parseMemoryCommand(text) {
    const value = normalize(text);
    if (!value) return null;
    if (/^(别记(住)?这个|不要记(住)?这个|忘掉刚才(的内容|那件事)?|忘记刚才(的内容|那件事)?)$/.test(value)) {
      return { type: 'forget_recent' };
    }
    return null;
  }

  return { parseMemoryCommand };
});
