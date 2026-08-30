const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const PREVIEW_TEXT = '准备好了吗？今天也一起专注吧。我就在这里陪你。不着急，慢慢把手上的事情做好就行。偶尔分心也没关系，发现以后再回来。记得喝点水，肩膀放松一点。如果觉得累了，我们就停下来休息一会儿。你不需要向谁证明什么，只要按照自己的节奏往前走。等你完成手上的事情，再抬头看看我，我会一直在这里等你。';

function json(res, status, body) {
  return res.status(status).json(body);
}

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

async function elevenFetch(path, options = {}) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    const error = new Error('ElevenLabs 尚未配置，请先添加服务端 ELEVENLABS_API_KEY');
    error.status = 503;
    throw error;
  }
  const response = await fetch(`${ELEVENLABS_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey.trim(),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    let message = `ElevenLabs 请求失败（${response.status}）`;
    if (response.status === 403 && detail.includes('feature_not_available')) {
      message = '当前 ElevenLabs 套餐不支持通过 API 创建声音，请升级套餐后再使用“自己捏声音”';
    }
    const error = new Error(message);
    error.status = response.status >= 500 ? 502 : response.status;
    error.detail = detail.slice(0, 500);
    throw error;
  }
  return response;
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });
  const action = clean(req.body?.action, 30);
  try {
    if (action === 'design') {
      const voiceDescription = clean(req.body?.voiceDescription);
      if (voiceDescription.length < 20) return json(res, 400, { success: false, error: '请再具体描述一点 TA 的声音' });
      const response = await elevenFetch('/text-to-voice/design?output_format=mp3_44100_128', {
        method: 'POST',
        body: JSON.stringify({
          voice_description: voiceDescription,
          text: PREVIEW_TEXT,
          model_id: 'eleven_multilingual_ttv_v2',
          auto_generate_text: false,
          guidance_scale: 5
        })
      });
      const payload = await response.json();
      const previews = (payload.previews || []).slice(0, 3).map((item, index) => ({
        id: item.generated_voice_id,
        name: `声音 ${String(index + 1).padStart(2, '0')}`,
        audio: `data:${item.media_type || 'audio/mpeg'};base64,${item.audio_base_64}`
      }));
      return json(res, 200, { success: true, previews, text: payload.text || PREVIEW_TEXT });
    }

    if (action === 'create') {
      const generatedVoiceId = clean(req.body?.generatedVoiceId, 120);
      const voiceDescription = clean(req.body?.voiceDescription);
      const voiceName = clean(req.body?.voiceName, 80) || 'TA 的声音';
      if (!generatedVoiceId || voiceDescription.length < 20) return json(res, 400, { success: false, error: '声音候选信息不完整' });
      const response = await elevenFetch('/text-to-voice', {
        method: 'POST',
        body: JSON.stringify({
          voice_name: voiceName,
          voice_description: voiceDescription,
          generated_voice_id: generatedVoiceId,
          labels: { language: 'zh', use_case: 'conversational' }
        })
      });
      const voice = await response.json();
      return json(res, 200, { success: true, voice: { id: voice.voice_id, name: voice.name || voiceName } });
    }

    return json(res, 400, { success: false, error: '未知操作' });
  } catch (error) {
    console.error('ElevenLabs voice operation failed:', error.message, error.detail || '');
    return json(res, error.status || 500, { success: false, error: error.message });
  }
}

module.exports = { default: handler, handler };
