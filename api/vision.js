const ALLOWED_STATUSES = new Set(['STUDYING', 'PHONE', 'ABSENT', 'RESTING']);

function json(res, status, body) {
  return res.status(status).json(body);
}

function extractJson(text) {
  const cleaned = String(text || '').replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Vision model did not return JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { success: false, error: 'Method not allowed' });

  const apiUrl = process.env.VISION_API_URL;
  const apiKey = process.env.VISION_API_KEY;
  const model = process.env.VISION_MODEL;
  if (!apiUrl || !apiKey || !model) {
    return json(res, 503, { success: false, error: '视觉模型待配置' });
  }

  const image = req.body?.image;
  if (typeof image !== 'string' || !/^data:image\/jpeg;base64,/.test(image)) {
    return json(res, 400, { success: false, error: '无效的 JPEG 图片' });
  }
  if (image.length > 2_000_000) {
    return json(res, 413, { success: false, error: '图片过大' });
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: '只判断画面中用户当前状态。必须返回 JSON：{"status":"STUDYING|PHONE|ABSENT|RESTING","confidence":0到1}。STUDYING=正常学习或工作；PHONE=正在看手机；ABSENT=画面中无人；RESTING=趴桌或明显休息。看不清时降低 confidence，不要输出其他文字。'
            },
            { type: 'image_url', image_url: { url: image } }
          ]
        }]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Vision provider failed:', response.status, detail.slice(0, 400));
      let providerError = {};
      try {
        const parsedDetail = JSON.parse(detail);
        providerError = {
          code: parsedDetail?.error?.code || '',
          message: parsedDetail?.error?.message || ''
        };
      } catch (_) {}
      return json(res, 502, {
        success: false,
        error: '视觉模型请求失败',
        provider: { status: response.status, ...providerError }
      });
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = extractJson(content);
    if (!ALLOWED_STATUSES.has(parsed.status)) throw new Error('Invalid vision status');
    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
    return json(res, 200, { success: true, data: { status: parsed.status, confidence } });
  } catch (error) {
    console.error('Vision API error:', error);
    return json(res, 500, { success: false, error: '视觉分析失败' });
  }
}

module.exports = { default: handler, handler };
