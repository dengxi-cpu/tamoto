// Web Push MVP：公开 VAPID 公钥，并向指定订阅发送一条占位通知。
const webpush = require('web-push');

const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';
const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

function isConfigured() {
  return Boolean(publicKey && privateKey);
}

function configureWebPush() {
  if (isConfigured()) webpush.setVapidDetails(subject, publicKey, privateKey);
}

async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ success: true, configured: isConfigured(), publicKey });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!isConfigured()) {
    return res.status(503).json({ success: false, error: 'Web Push 尚未配置 VAPID 密钥' });
  }

  const subscription = req.body && req.body.subscription;
  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ success: false, error: '无效的推送订阅' });
  }

  const payload = JSON.stringify({
    title: '小艾',
    body: '【占位消息】该开始今天的专注啦，我在番茄钟里等你。',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-120.png',
    tag: 'oc-study-reminder',
    url: '/?page=focus&source=notification'
  });

  try {
    configureWebPush();
    await webpush.sendNotification(subscription, payload, { TTL: 60 });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Web Push 发送失败:', error.statusCode || '', error.message);
    return res.status(error.statusCode === 404 || error.statusCode === 410 ? 410 : 502).json({
      success: false,
      expired: error.statusCode === 404 || error.statusCode === 410,
      error: '通知发送失败'
    });
  }
}

module.exports = handler;
