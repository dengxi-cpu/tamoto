const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';
const PREVIEW_TEXT = '准备好了吗？今天也一起专注吧。我就在这里陪你。不着急，慢慢把手上的事情做好就行。偶尔分心也没关系，发现以后再回来。记得喝点水，肩膀放松一点。如果觉得累了，我们就停下来休息一会儿。你不需要向谁证明什么，只要按照自己的节奏往前走。等你完成手上的事情，再抬头看看我，我会一直在这里等你。';

function json(res, status, body) {
  return res.status(status).json(body);
}

function clean(value, max = 1000) {
  return String(value || '').trim().slice(0, max);
}

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 把中文声音设定翻译成 ElevenLabs Voice Design 需要的英文描述
async function translateVoiceBrief(description) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    const error = new Error('DeepSeek 尚未配置');
    error.status = 503;
    throw error;
  }
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.35,
      max_tokens: 360,
      stream: false,
      messages: [
        {
          role: 'system',
          content: 'Translate the Chinese voice-design brief into a precise English prompt for ElevenLabs Voice Design. Preserve every requested trait. Explicitly state: native Mandarin Chinese speaker from mainland China, standard Putonghua pronunciation, authentic mainland Chinese cadence and prosody, and absolutely no foreign accent. Do not add an English-speaking, American, British, narrator, broadcaster, theatrical, or dubbed quality. Output only one English paragraph, 70–140 words, with no heading, quotes, list, or explanation.'
        },
        { role: 'user', content: description }
      ]
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Voice brief translate failed:', response.status, detail.slice(0, 500));
    const error = new Error(response.status === 429 ? '请求太多，稍后再试' : 'AI 暂时无法翻译声音描述');
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const payload = await response.json();
  return clean(payload?.choices?.[0]?.message?.content, 1600).replace(/^['“”"]+|['“”"]+$/g, '');
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
    if (action === 'translate') {
      const description = clean(req.body?.description, 800);
      if (!description) return json(res, 400, { success: false, error: '先写下你希望 TA 的声音' });
      const translated = await translateVoiceBrief(description);
      if (!translated) return json(res, 502, { success: false, error: 'AI 没有返回有效翻译' });
      return json(res, 200, { success: true, description: translated });
    }

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
          guidance_scale: 4,
          quality: 0.9
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
          labels: { language: 'zh', locale: 'zh-CN', accent: 'standard_putonghua', use_case: 'conversational' }
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
