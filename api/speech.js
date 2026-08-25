const { randomUUID } = require('crypto');

const DEFAULT_API_URL = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash';
const DEFAULT_RESOURCE_ID = 'volc.bigasr.auc_turbo';
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

function json(res, status, body) {
  return res.status(status).json(body);
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });

  const apiKey = process.env.SPEECH_API_KEY;
  const apiUrl = process.env.SPEECH_API_URL || DEFAULT_API_URL;
  const resourceId = process.env.SPEECH_RESOURCE_ID || DEFAULT_RESOURCE_ID;
  if (!apiKey) return json(res, 503, { success: false, error: '语音识别接口尚未配置' });

  const audio = req.body?.audio;
  if (typeof audio !== 'string' || !audio.length) {
    return json(res, 400, { success: false, error: '没有收到录音' });
  }

  const base64Audio = audio.includes(',') ? audio.slice(audio.indexOf(',') + 1) : audio;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64Audio)) {
    return json(res, 400, { success: false, error: '录音格式无效' });
  }
  if (Buffer.byteLength(base64Audio, 'base64') > MAX_AUDIO_BYTES) {
    return json(res, 413, { success: false, error: '录音过长，请缩短后重试' });
  }

  const requestId = randomUUID();
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey.trim(),
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': requestId,
        'X-Api-Sequence': '-1'
      },
      body: JSON.stringify({
        user: { uid: 'tamoto-web-user' },
        audio: { data: base64Audio },
        request: { model_name: 'bigmodel' }
      })
    });

    const payload = await response.json().catch(() => ({}));
    const providerCode = response.headers.get('x-api-status-code');
    const providerMessage = response.headers.get('x-api-message');
    if (!response.ok || (providerCode && providerCode !== '20000000')) {
      console.error('Speech provider failed:', response.status, providerCode, providerMessage, JSON.stringify(payload).slice(0, 500));
      return json(res, 502, { success: false, error: providerMessage || '语音识别请求失败' });
    }

    const text = String(payload?.result?.text || '').trim();
    return json(res, 200, { success: true, data: { text } });
  } catch (error) {
    console.error('Speech API error:', error);
    return json(res, 500, { success: false, error: '语音识别服务暂时不可用' });
  }
}

module.exports = { default: handler, handler };
