const fs = require('fs');
const path = require('path');

let betaHtml = '';

function serveBeta(req, res) {
  if (!betaHtml) {
    betaHtml = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8')
      .replace(
        '<link id="appManifest" rel="manifest" href="./manifest.webmanifest">',
        '<link id="appManifest" rel="manifest" href="./manifest-beta.webmanifest">'
      )
      .replace('frontend/js/focus-companion.js?v=45', 'frontend/js/focus-companion.js?v=46');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  if (req.method === 'HEAD') return res.status(200).end();
  return res.status(200).send(betaHtml);
}

function handler(req, res) {
  if (req.query?.serve === 'beta' && (req.method === 'GET' || req.method === 'HEAD')) {
    return serveBeta(req, res);
  }
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  let providerHost = '';
  try {
    providerHost = new URL(process.env.VISION_API_URL || '').host;
  } catch (_) {}

  return res.status(200).json({
    success: true,
    data: {
      configured: Boolean(process.env.VISION_API_URL && process.env.VISION_API_KEY && process.env.VISION_MODEL),
      apiUrlConfigured: Boolean(process.env.VISION_API_URL),
      apiKeyConfigured: Boolean(process.env.VISION_API_KEY),
      modelConfigured: Boolean(process.env.VISION_MODEL),
      reactionConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      ttsKeyConfigured: Boolean(process.env.TTS_API_KEY || process.env.SPEECH_API_KEY),
      ttsVoiceConfigured: Boolean(process.env.TTS_VOICE_TYPE),
      ttsResourceId: process.env.TTS_RESOURCE_ID || 'seed-tts-2.0',
      providerHost,
      model: process.env.VISION_MODEL || '',
      captureStored: false,
      checkedAt: new Date().toISOString()
    }
  });
}

module.exports = { default: handler, handler };
