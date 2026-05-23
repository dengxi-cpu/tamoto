// server.js
// 本地测试服务器 - 模拟 Vercel Serverless Functions 环境

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// 启用 CORS
app.use(cors());

// 解析 JSON 请求体
app.use(express.json());

// 静态文件服务（index.html 在根目录）
app.use(express.static(__dirname));

// ============================================
// API 路由代理 - 与 Vercel Serverless 保持一致
// ============================================

const apiModules = {
  chat: require('./api/chat.js'),
  auth: require('./api/auth.js'),
  sync: require('./api/sync.js'),
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
app.post('/api/auth', proxyApi(apiModules.auth.handler));
app.all('/api/sync', proxyApi(apiModules.sync.handler));

app.listen(PORT, () => {
  console.log(`🚀 伴柠番茄钟已启动: http://localhost:${PORT}`);
});
