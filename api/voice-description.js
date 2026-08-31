const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

function json(res, status, body) {
  return res.status(status).json(body);
}

function clean(value, max = 1200) {
  return String(value || '').trim().slice(0, max);
}

async function askDeepSeek(apiKey, messages, maxTokens = 320) {
  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0.35,
      max_tokens: maxTokens,
      stream: false,
      messages
    })
  });
  if (!response.ok) {
    const detail = await response.text();
    console.error('Voice description AI failed:', response.status, detail.slice(0, 500));
    const error = new Error(response.status === 429 ? '请求太多，稍后再试' : 'AI 暂时无法处理声音描述');
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }
  const payload = await response.json();
  return clean(payload?.choices?.[0]?.message?.content, 1600).replace(/^['“”"]+|['“”"]+$/g, '');
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return json(res, 503, { success: false, error: 'DeepSeek 尚未配置' });

  const action = clean(req.body?.action, 20);
  const description = clean(req.body?.description, 800);
  if (!description) return json(res, 400, { success: false, error: '先写下你希望 TA 的声音' });

  try {
    if (action === 'improve') {
      const improved = await askDeepSeek(apiKey, [
        {
          role: 'system',
          content: '你是中文 AI 陪伴产品的音色设计师。将用户对声音的简短想法润色成 60–120 个汉字的具体描述，适当补充年龄感、声线、音色、语速、情绪、距离感和普通话口音。必须保留原意，明确为中国大陆母语级普通话、不带外国口音。只输出一段中文，不写标题、列表、引号或解释。'
        },
        { role: 'user', content: description }
      ]);
      if (!improved) return json(res, 502, { success: false, error: 'AI 没有返回有效描述' });
      return json(res, 200, { success: true, description: improved });
    }

    if (action === 'translate') {
      const translated = await askDeepSeek(apiKey, [
        {
          role: 'system',
          content: 'Translate the Chinese voice-design brief into a precise English prompt for ElevenLabs Voice Design. Preserve every requested trait. Explicitly state: native Mandarin Chinese speaker from mainland China, standard Putonghua pronunciation, authentic mainland Chinese cadence and prosody, and absolutely no foreign accent. Do not add an English-speaking, American, British, narrator, broadcaster, theatrical, or dubbed quality. Output only one English paragraph, 70–140 words, with no heading, quotes, list, or explanation.'
        },
        { role: 'user', content: description }
      ], 360);
      if (!translated) return json(res, 502, { success: false, error: 'AI 没有返回有效翻译' });
      return json(res, 200, { success: true, description: translated });
    }

    return json(res, 400, { success: false, error: '未知操作' });
  } catch (error) {
    return json(res, error.status || 500, { success: false, error: error.message || 'AI 处理失败' });
  }
}

module.exports = { default: handler, handler };
