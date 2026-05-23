// api/chat.js
// Vercel Serverless Function - AI 聊天 API
// 处理与 OC 的实时对话

async function handler(req, res) {
    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed. Please use POST.'
        });
    }

    try {
        const {
            apiKey,
            apiUrl,
            apiModel,
            aiService = 'openai',
            systemPrompt,  // ✅ 改为接收前端生成的完整 System Prompt
            message,
            chatHistory = [],
            ignoreHistory = false  // ✅ 是否忽略历史记录
        } = req.body;

        // 参数验证
        if (!apiKey) {
            return res.status(400).json({
                success: false,
                error: 'API密钥不能为空'
            });
        }

        if (!apiUrl) {
            return res.status(400).json({
                success: false,
                error: 'API URL不能为空'
            });
        }

        if (!systemPrompt) {
            return res.status(400).json({
                success: false,
                error: 'System Prompt不能为空'
            });
        }

        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                error: '消息内容不能为空'
            });
        }

        // 🔍 调试：打印接收到的 System Prompt（可在Vercel日志中查看）
        console.log('=== AI聊天 - 接收前端生成的 System Prompt ===');
        console.log('System Prompt (前300字符):', systemPrompt.substring(0, 300) + '...');
        console.log('用户消息:', message);
        console.log('聊天历史条数:', chatHistory.length);
        console.log('忽略历史:', ignoreHistory);
        console.log('=== 系统提示词结束 ===\n');

        // ✅ 如果设置了忽略历史，则不发送历史记录给AI
        let conversationHistory;
        if (ignoreHistory) {
            console.log('✅ 忽略历史模式：不发送历史记录给AI');
            conversationHistory = buildConversationHistory([], message);
        } else {
            conversationHistory = buildConversationHistory(chatHistory, message);
        }

        // 调用 LLM API
        const llmResponse = await callChatLLMAPI(
            apiKey,
            apiUrl,
            apiModel,
            aiService,
            systemPrompt,  // ✅ 直接使用前端传来的完整 System Prompt
            conversationHistory
        );

        // 提取回复内容
        const reply = extractReply(llmResponse);

        // ✅ 暂时返回空的建议动作（前端可以根据状态生成）
        const suggestedActions = [];

        // 返回成功响应
        return res.status(200).json({
            success: true,
            data: {
                reply: reply,
                suggestedActions: suggestedActions
            }
        });

    } catch (error) {
        console.error('聊天API错误:', error);

        // 返回错误响应
        return res.status(500).json({
            success: false,
            error: error.message || '聊天失败，请稍后重试'
        });
    }
}

// ============================================
// 辅助函数
// ============================================

/**
 * 构建对话历史
 * @param {array} chatHistory - 聊天历史
 * @param {string} currentMessage - 当前消息
 * @returns {array} 对话历史数组
 */
function buildConversationHistory(chatHistory, currentMessage) {
    const messages = [];
    const maxHistoryLength = 20; // 最多保留最近20条历史

    // 限制历史长度
    const recentHistory = chatHistory.slice(-maxHistoryLength);

    // 添加历史消息
    recentHistory.forEach((msg, index) => {
        if (msg.role === 'user') {
            messages.push({
                role: 'user',
                content: msg.content
            });
        } else if (msg.role === 'assistant') {
            messages.push({
                role: 'assistant',
                content: msg.content
            });
        }
    });

    // 添加当前消息
    messages.push({
        role: 'user',
        content: currentMessage
    });

    return messages;
}

/**
 * 调用 LLM API
 * @param {string} apiKey - API密钥
 * @param {string} apiUrl - API地址
 * @param {string} model - 模型名称
 * @param {string} service - AI服务类型
 * @param {string} systemPrompt - 系统提示词
 * @param {array} messages - 对话历史
 * @returns {object} API响应
 */
async function callChatLLMAPI(apiKey, apiUrl, model, service, systemPrompt, messages) {
    const requestBody = {
        model: model,
        messages: [
            {
                role: 'system',
                content: systemPrompt
            },
            ...messages
        ],
        temperature: 0.8,
        max_tokens: 150,
        stream: false
    };

    // 🔍 调试日志
    console.log('📤 调用 LLM API:');
    console.log('  URL:', apiUrl);
    console.log('  Model:', model);
    console.log('  Service:', service);

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ LLM API 错误响应:');
        console.error('  Status:', response.status, response.statusText);
        console.error('  Response:', errorText);

        let errorData;
        try {
            errorData = JSON.parse(errorText);
        } catch (e) {
            errorData = { raw: errorText };
        }

        throw new Error(errorData.error?.message || errorData.message || `API请求失败: ${response.status} - ${errorText.substring(0, 200)}`);
    }

    return await response.json();
}

/**
 * 从API响应中提取回复内容
 * @param {object} llmResponse - LLM API响应
 * @returns {string} 回复内容
 */
function extractReply(llmResponse) {
    if (llmResponse.choices && llmResponse.choices.length > 0) {
        return llmResponse.choices[0].message.content.trim();
    }
    return '抱歉，我暂时无法回复。';
}

/**
 * 格式化时长
 * @param {number} seconds - 秒数
 * @returns {string} 格式化后的时长
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
}

// 导出函数 - 同时支持 CommonJS 和 ES Module
module.exports = {
    default: handler,  // ✅ 添加 default 导出
    handler,
    buildConversationHistory,
    formatDuration
};

// Vercel 部署时使用 (确保 default 存在)
if (typeof exports !== 'undefined') {
    exports.default = handler;
}
