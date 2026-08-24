// Vercel Serverless Function - AI chat API
// Provider credentials and model are server-owned and never accepted from clients.

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method not allowed. Please use POST.' });
    }

    try {
        const { systemPrompt, message, chatHistory = [], ignoreHistory = false } = req.body || {};

        if (!process.env.DEEPSEEK_API_KEY) {
            console.error('DEEPSEEK_API_KEY is not configured');
            return res.status(503).json({ success: false, error: 'AI 服务暂未配置，请稍后再试' });
        }
        if (!systemPrompt) {
            return res.status(400).json({ success: false, error: 'System Prompt 不能为空' });
        }
        if (!message || message.trim() === '') {
            return res.status(400).json({ success: false, error: '消息内容不能为空' });
        }

        const conversationHistory = buildConversationHistory(ignoreHistory ? [] : chatHistory, message);
        const llmResponse = await callChatLLMAPI(
            process.env.DEEPSEEK_API_KEY,
            systemPrompt,
            conversationHistory
        );

        return res.status(200).json({
            success: true,
            data: { reply: extractReply(llmResponse), suggestedActions: [] }
        });
    } catch (error) {
        console.error('Chat API error:', error);
        return res.status(error.statusCode || 500).json({
            success: false,
            error: error.publicMessage || '聊天失败，请稍后重试'
        });
    }
}

function buildConversationHistory(chatHistory, currentMessage) {
    const recentHistory = Array.isArray(chatHistory) ? chatHistory.slice(-20) : [];
    const messages = recentHistory
        .filter(msg => msg && (msg.role === 'user' || msg.role === 'assistant'))
        .map(msg => ({ role: msg.role, content: String(msg.content || '') }));

    messages.push({ role: 'user', content: currentMessage });
    return messages;
}

async function callChatLLMAPI(apiKey, systemPrompt, messages) {
    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: DEEPSEEK_MODEL,
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
            temperature: 0.8,
            max_tokens: 150,
            stream: false
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API request failed:', response.status, errorText.slice(0, 500));
        const error = new Error(`DeepSeek request failed: ${response.status}`);
        error.statusCode = response.status === 429 ? 429 : 502;
        error.publicMessage = response.status === 429
            ? 'AI 请求较多，请稍后再试'
            : 'AI 服务暂时不可用，请稍后再试';
        throw error;
    }

    return response.json();
}

function extractReply(llmResponse) {
    const content = llmResponse?.choices?.[0]?.message?.content;
    return typeof content === 'string' && content.trim() ? content.trim() : '抱歉，我暂时无法回复。';
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}小时${minutes}分钟` : `${minutes}分钟`;
}

module.exports = { default: handler, handler, buildConversationHistory, formatDuration };

if (typeof exports !== 'undefined') {
    exports.default = handler;
}
