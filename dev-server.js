// dev-server.js（仅用于本地开发，避免被 Vercel 自动识别为生产 Express 入口）
// 本地测试服务器 - 模拟 Vercel Serverless Functions 环境

require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env.push.local', override: false });

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 启用 CORS
app.use(cors());

// 解析 JSON 请求体
app.use(express.json({ limit: '4mb' }));

// 静态文件服务（index.html 在根目录）
app.use(express.static(__dirname));

// 与线上保持一致：本地 /beta 也由单页应用入口承载。
app.get(['/beta', '/beta/'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// API 路由代理 - 与 Vercel Serverless 保持一致
// ============================================

const apiModules = {
  chat: require('./api/chat.js'),
  auth: require('./server/auth.js'),
  sync: require('./server/sync.js'),
  push: require('./api/push.js'),
  reminders: require('./api/reminders.js'),
  speech: require('./api/speech.js'),
  companionObserve: require('./api/companion-observe.js'),
  visionHealth: require('./api/vision-health.js'),
  ttsStream: require('./api/tts-stream.js'),
  companionLogs: require('./api/companion-logs.js'),
  elevenlabsVoices: require('./api/elevenlabs-voices.js'),
  voiceDescription: require('./api/voice-description.js'),
  personaImprove: require('./api/persona-improve.js'),
  events: require('./server/events.js'),
};

// 通用代理：把 Express req/res 包装成 Vercel 风格的 handler(req, res)
function proxyApi(handler) {
  return async (req, res) => {
    // 让 Vercel 风格的 handler 直接处理，它接收标准的 (req, res)
    try {
      await handler(req, res);
    } catch (error) {
      console.error('API 调用错误:', error);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  };
}

app.post('/api/chat', proxyApi(apiModules.chat.handler));
app.post('/api/auth', proxyApi(apiModules.auth));
app.all('/api/sync', proxyApi(apiModules.sync));
app.all('/api/push', proxyApi(apiModules.push));
app.all('/api/reminders', proxyApi(apiModules.reminders));
app.post('/api/speech', proxyApi(apiModules.speech.handler));
app.post('/api/companion-observe', proxyApi(apiModules.companionObserve.handler));
app.get('/api/vision-health', proxyApi(apiModules.visionHealth.handler));
app.post('/api/tts-stream', proxyApi(apiModules.ttsStream.handler));
app.all('/api/companion-logs', proxyApi(apiModules.companionLogs.handler));
app.post('/api/elevenlabs-voices', proxyApi(apiModules.elevenlabsVoices.handler));
app.post('/api/voice-description', proxyApi(apiModules.voiceDescription.handler));
app.post('/api/persona-improve', proxyApi(apiModules.personaImprove.handler));
app.all('/api/events', proxyApi(apiModules.events.handler));

app.listen(PORT, () => {
  console.log(`🚀 伴柠番茄钟已启动: http://localhost:${PORT}`);
});
