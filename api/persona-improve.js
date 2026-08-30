const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

function json(res, status, body) {
  return res.status(status).json(body);
}

function clean(value, max) {
  return String(value || '').trim().slice(0, max);
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return json(res, 503, { success: false, error: 'DeepSeek 尚未配置' });

  const name = clean(req.body?.name, 20) || 'TA';
  const userTitle = clean(req.body?.userTitle, 20) || '你';
  const relationship = clean(req.body?.relationship, 20) || '陪伴伙伴';
  const persona = clean(req.body?.persona, 1500);
  const source = persona || `${name}安静温柔，会自然关注${userTitle}的状态，在分心太久时轻声提醒。`;

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0.72,
        max_tokens: 320,
        stream: false,
        messages: [
          {
            role: 'system',
            content: '你是 AI 陪伴角色的人设编辑。把用户提供的人设扩写成一段自然、具体、可直接保存的中文角色设定。保留原意，不擅自改变关系；补充说话习惯、陪伴方式、情绪边界和专注提醒方式。控制在 100–220 个汉字，不写标题、列表、引号、解释或免责声明，不使用空泛营销词。'
          },
          {
            role: 'user',
            content: `角色名：${name}\nTA 对用户的称呼：${userTitle}\n双方关系：${relationship}\n现有人设：${source}`
          }
        ]
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('Persona improve failed:', response.status, detail.slice(0, 500));
      return json(res, response.status === 429 ? 429 : 502, { success: false, error: response.status === 429 ? 'AI 请求较多，请稍后再试' : 'AI 暂时无法完善人设' });
    }
    const payload = await response.json();
    const improved = clean(payload?.choices?.[0]?.message?.content, 3000).replace(/^['“”"]+|['“”"]+$/g, '');
    if (!improved) return json(res, 502, { success: false, error: 'AI 没有返回有效人设' });
    return json(res, 200, { success: true, persona: improved });
  } catch (error) {
    console.error('Persona improve error:', error);
    return json(res, 500, { success: false, error: 'AI 完善失败，请稍后再试' });
  }
}

module.exports = { default: handler, handler };
