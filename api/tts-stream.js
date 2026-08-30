const { randomUUID } = require('crypto');
const { updateTtsLog } = require('./companion-logs');

const DEFAULT_TTS_API_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse';
const DEFAULT_TTS_RESOURCE_ID = 'seed-tts-2.0';
const DEFAULT_SAMPLE_RATE = 24000;
const BUILT_IN_VOICES = [
  'zh_male_ruyayichen_saturn_bigtts',
  'zh_male_m191_uranus_bigtts',
  'zh_male_taocheng_uranus_bigtts',
  'zh_male_liufei_uranus_bigtts',
  'zh_male_fanjuanqingnian_uranus_bigtts',
  'zh_male_yizhipiannan_uranus_bigtts'
];

function json(res, status, body) {
  return res.status(status).json(body);
}

function parseEventData(block) {
  const lines = block.split(/\r?\n/);
  const data = lines
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trim())
    .join('');
  const raw = data || lines.map(line => line.trim()).filter(Boolean).join('');
  if (!raw || raw === '[DONE]') return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });

  const voiceProvider = String(req.body?.voiceProvider || '').trim().toLowerCase();
  const requestedVoiceId = String(req.body?.voiceId || '').trim();
  const apiKey = process.env.TTS_API_KEY || process.env.SPEECH_API_KEY;
  const apiUrl = process.env.TTS_API_URL || DEFAULT_TTS_API_URL;
  const resourceId = process.env.TTS_RESOURCE_ID || DEFAULT_TTS_RESOURCE_ID;
  const defaultSpeaker = process.env.TTS_VOICE_TYPE;
  const allowedSpeakers = new Set([defaultSpeaker, ...BUILT_IN_VOICES, ...(process.env.TTS_ALLOWED_VOICE_TYPES || '').split(',')].map(item => String(item || '').trim()).filter(Boolean));
  const requestedSpeaker = String(req.body?.voiceType || '').trim();
  const speaker = requestedSpeaker && allowedSpeakers.has(requestedSpeaker) ? requestedSpeaker : defaultSpeaker;
  if (voiceProvider !== 'elevenlabs' && (!apiKey || !speaker)) {
    return json(res, 503, {
      success: false,
      error: !apiKey ? 'TTS API Key 尚未配置' : 'TTS 音色尚未配置'
    });
  }

  const text = String(req.body?.text || '').trim();
  if (!text) return json(res, 400, { success: false, error: '播报文字不能为空' });
  if (text.length > 300) return json(res, 413, { success: false, error: '播报文字过长' });

  const epoch = Number.isSafeInteger(req.body?.epoch) ? req.body.epoch : 1;
  const turnId = Number.isSafeInteger(req.body?.turnId) ? req.body.turnId : 1;
  const requestId = randomUUID();
  const speechType = String(req.body?.speechType || 'visual');
  const logSource = speechType === 'dialogue'
    ? 'dialogue'
    : speechType === 'visual'
      ? 'pomodoro'
      : speechType === 'session_opening'
        ? 'session_opening'
        : 'ambient';
  await updateTtsLog({ epoch, turnId, source: logSource, status: 'streaming', bytes: 0 });

  try {
    if (voiceProvider === 'elevenlabs') {
      const elevenKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenKey) return json(res, 503, { success: false, error: 'ElevenLabs 尚未配置' });
      if (!/^[A-Za-z0-9_-]{8,120}$/.test(requestedVoiceId)) return json(res, 400, { success: false, error: 'ElevenLabs voice_id 无效' });
      const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(requestedVoiceId)}?output_format=mp3_44100_128`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'xi-api-key': elevenKey.trim() },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.58, similarity_boost: 0.78, style: 0.18, use_speaker_boost: true }
        })
      });
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text();
        console.error('ElevenLabs TTS failed:', upstream.status, detail.slice(0, 500));
        await updateTtsLog({ epoch, turnId, source: logSource, status: 'failed', bytes: 0, error: `ElevenLabs ${upstream.status}` });
        return json(res, 502, { success: false, error: 'TA 的声音暂时无法播放' });
      }
      const audio = Buffer.from(await upstream.arrayBuffer());
      res.status(200);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Audio-Format', 'mp3');
      res.setHeader('X-Companion-Epoch', String(epoch));
      res.setHeader('X-Companion-Turn-Id', String(turnId));
      await updateTtsLog({ epoch, turnId, source: logSource, status: 'completed', bytes: audio.length });
      return res.end(audio);
    }

    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': apiKey.trim(),
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': requestId
      },
      body: JSON.stringify({
        user: { uid: 'tamoto-web-user' },
        req_params: {
          text,
          speaker,
          sample_rate: DEFAULT_SAMPLE_RATE,
          audio_params: {
            format: 'pcm',
            speech_rate: 0,
            loudness_rate: 0
          },
          additions: JSON.stringify({
            post_process: { pitch: 0 },
            disable_markdown_filter: true,
            enable_latex_tn: false,
            latex_parser: 'v2'
          })
        }
      })
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text();
      console.error('TTS provider failed:', upstream.status, detail.slice(0, 500));
      return json(res, 502, { success: false, error: 'TTS 服务请求失败', providerStatus: upstream.status });
    }

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';
    let audioBytes = 0;
    let providerFailure = null;

    const beginAudioResponse = () => {
      if (res.headersSent) return;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Audio-Format', 'pcm_s16le');
      res.setHeader('X-Audio-Sample-Rate', String(DEFAULT_SAMPLE_RATE));
      res.setHeader('X-Companion-Epoch', String(epoch));
      res.setHeader('X-Companion-Turn-Id', String(turnId));
      res.flushHeaders?.();
    };

    while (true) {
      const { value, done } = await reader.read();
      pending += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = pending.split(/\r?\n\r?\n/);
      pending = blocks.pop() || '';

      for (const block of blocks) {
        const event = parseEventData(block);
        if (!event) continue;
        if (event.data && (event.code === 0 || event.code === 20000000 || event.code == null)) {
          const audio = Buffer.from(event.data, 'base64');
          audioBytes += audio.length;
          beginAudioResponse();
          res.write(audio);
        } else if (event.code && event.code !== 20000000) {
          providerFailure = { code: event.code, message: event.message || 'TTS provider error' };
          console.error('TTS stream event failed:', event.code, event.message || '');
        }
      }
      if (done) break;
    }

    if (pending.trim()) {
      const event = parseEventData(pending);
      if (event?.data) {
        const audio = Buffer.from(event.data, 'base64');
        audioBytes += audio.length;
        beginAudioResponse();
        res.write(audio);
      }
    }
    if (!audioBytes) {
      console.error('TTS stream completed without audio:', requestId);
      if (!res.headersSent) {
        await updateTtsLog({ epoch, turnId, source: logSource, status: 'failed', bytes: 0, error: providerFailure?.message || 'TTS 没有返回音频' });
        return json(res, 502, {
          success: false,
          error: providerFailure?.message || 'TTS 没有返回音频',
          providerCode: providerFailure?.code || ''
        });
      }
    }
    await updateTtsLog({ epoch, turnId, source: logSource, status: 'completed', bytes: audioBytes });
    return res.end();
  } catch (error) {
    console.error('TTS stream error:', error);
    await updateTtsLog({ epoch, turnId, source: logSource, status: 'failed', bytes: 0, error: error.message });
    if (!res.headersSent) return json(res, 500, { success: false, error: 'TTS 流式播报失败' });
    return res.end();
  }
}

module.exports = { default: handler, handler };
