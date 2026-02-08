// api/generate.js
// Vercel Serverless Function - AI 语录生成 API
// 支持生成：问候语、鼓励语、督促语(三个级别)

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
            prompt,
            quantity = 5,
            userTitle = '大小姐',
            characterDescription,
            type = 'encourage', // 新增：'greeting' | 'encourage' | 'remind'
            remindLevel = 'normal', // 新增：'normal' | 'annoyed' | 'angry'（仅当 type=remind 时使用）
            referenceStyle // 可选：参考风格
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

        if (!characterDescription && !prompt) {
            return res.status(400).json({
                success: false,
                error: '角色描述或prompt不能为空'
            });
        }

        // 构建系统提示词
        const systemPrompt = buildSystemPrompt(type, characterDescription || prompt, userTitle, remindLevel, referenceStyle, quantity);

        // 调用 LLM API
        const llmResponse = await callLLMAPI(apiKey, apiUrl, apiModel, aiService, systemPrompt, quantity);

        // 解析生成的语录
        const phrases = parseGeneratedPhrases(llmResponse, quantity);

        // 返回成功响应
        return res.status(200).json({
            success: true,
            data: {
                results: phrases,
                type: type,
                quantity: phrases.length,
                model: apiModel
            }
        });

    } catch (error) {
        console.error('语录生成错误:', error);

        // 返回错误响应
        return res.status(500).json({
            success: false,
            error: error.message || '生成失败，请稍后重试'
        });
    }
}

// ============================================
// Prompt 构建函数
// ============================================

/**
 * 构建系统提示词
 * @param {string} type - 语录类型
 * @param {string} description - 角色描述
 * @param {string} userTitle - 用户称呼
 * @param {string} remindLevel - 督促级别（仅督促语使用）
 * @param {string} referenceStyle - 参考风格
 * @param {number} quantity - 生成数量
 * @returns {string} 完整的系统提示词
 */
function buildSystemPrompt(type, description, userTitle, remindLevel, referenceStyle, quantity) {
    // 基础人设部分
    let systemPrompt = `你是用户创造的原创角色（OC）。
【角色描述】
${description}

【用户信息】
用户称呼：${userTitle}

【要求】
- 称呼用户为"${userTitle}"
- 完全符合上述角色性格和说话风格
- 每句话要简短（15-35字）
- 可以适当使用颜文字或emoji，但要符合人设
- ${quantity}条语录之间要有变化，不要重复
`;

    // 根据类型添加特定要求
    switch (type) {
        case 'greeting':
            systemPrompt += buildGreetingPrompt(quantity);
            break;

        case 'encourage':
            systemPrompt += buildEncouragePrompt(referenceStyle, quantity);
            break;

        case 'remind':
            systemPrompt += buildRemindPrompt(remindLevel, referenceStyle, quantity);
            break;

        default:
            // 默认为鼓励语
            systemPrompt += buildEncouragePrompt(referenceStyle, quantity);
    }

    return systemPrompt;
}

/**
 * 构建问候语 Prompt
 */
function buildGreetingPrompt(quantity) {
    return `
【任务】
生成 ${quantity} 条问候语。

【使用场景】
- 用户刚打开番茄钟应用
- 用户开始使用番茄钟
- 用户从其他页面回到专注页面

【语气要求】
- 友好、欢迎、温暖
- 符合角色性格
- 可以带有期待感，期待用户开始专注

【输出格式】
请直接输出 ${quantity} 条问候语，每条一行，不要添加编号或其他标记：
问候语1
问候语2
问候语3
...
`;
}

/**
 * 构建鼓励语 Prompt
 */
function buildEncouragePrompt(referenceStyle, quantity) {
    let prompt = `
【任务】
生成 ${quantity} 条鼓励语。

【使用场景】
- 用户正在进行番茄钟专注
- 用户可能感到疲惫或想要放弃
- 用户正在坚持完成当前任务

【语气要求】
- 温暖、支持、理解
- 认可用户的努力
- 给予积极的心理暗示
`;

    // 如果有参考风格，添加风格说明
    if (referenceStyle) {
        prompt += `\n【参考风格】${getReferenceStyleDescription(referenceStyle)}`;
    }

    prompt += `
【输出格式】
请直接输出 ${quantity} 条鼓励语，每条一行，不要添加编号或其他标记：
鼓励语1
鼓励语2
鼓励语3
...
`;

    return prompt;
}

/**
 * 构建督促语 Prompt
 */
function buildRemindPrompt(remindLevel, referenceStyle, quantity) {
    let prompt = `
【任务】
生成 ${quantity} 条督促语。

【使用场景】
- 用户在番茄钟期间点击 OC 头像
- 用户可能分心或想要放弃
- 需要提醒用户回到专注状态

【督促级别】${getRemindLevelDescription(remindLevel)}
`;

    // 如果有参考风格，添加风格说明
    if (referenceStyle) {
        prompt += `\n【参考风格】${getReferenceStyleDescription(referenceStyle)}`;
    }

    prompt += `
【输出格式】
请直接输出 ${quantity} 条督促语，每条一行，不要添加编号或其他标记：
督促语1
督促语2
督促语3
...
`;

    return prompt;
}

/**
 * 获取督促级别描述
 */
function getRemindLevelDescription(level) {
    const levelDescriptions = {
        normal: `
- 级别：正常提醒
- 语气：温和、关心、轻柔
- 内容：温柔地提醒用户正在专注，询问是否需要帮助
- 态度：理解用户可能需要休息，但鼓励继续完成当前番茄钟
`,

        annoyed: `
- 级别：烦恼提醒
- 语气：略带不满、嘟嘴、小脾气
- 内容：表达对用户分心的不满，觉得用户不够专注
- 态度：有点小生气，但还是会关心用户
- 可以使用"哼"、"真是的"等语气词
`,

        angry: `
- 级别：生气提醒
- 语气：严肃、生气、强势
- 内容：明确表达不满，要求用户回到专注状态
- 态度：非常生气，可能有点严厉
- 可以使用"快点"、"专心点"等强硬语气
- 但仍然要符合人设，不要过度攻击性
`
    };

    return levelDescriptions[level] || levelDescriptions.normal;
}

/**
 * 获取参考风格描述
 */
function getReferenceStyleDescription(style) {
    const styleDescriptions = {
        gentle: '温柔守护型 - 温柔体贴，像守护者一样支持用户，语气柔和',
        tsundere: '傲娇毒舌型 - 嘴上不饶人，但内心关心，有时会害羞',
        cheerful: '开朗活泼型 - 元气满满，充满活力，用积极向上的语气',
        cool: '淡漠冷静型 - 话少冷静，理性分析，但偶尔流露关心',
        mature: '成熟稳重型 - 像大姐姐/大哥哥，成熟稳重，给人安全感',
        sarcastic: '腹黑型 - 表面温柔，偶尔会捉弄用户，有点小腹黑',
        shy: '害羞内向型 - 害羞内向，说话小心，偶尔会结巴',
        doting: '溺爱宠溺型 - 宠溺用户，像宠孩子一样，温柔包容'
    };

    return styleDescriptions[style] || '';
}

/**
 * 获取数量（用于 Prompt 构建）
 */
function getQuantity() {
    return this.quantity || 5;
}

// ============================================
// LLM API 调用函数
// ============================================

/**
 * 调用 LLM API
 * @param {string} apiKey - API密钥
 * @param {string} apiUrl - API地址
 * @param {string} model - 模型名称
 * @param {string} aiService - AI服务类型
 * @param {string} systemPrompt - 系统提示词
 * @param {number} quantity - 生成数量
 * @returns {string} LLM 响应文本
 */
async function callLLMAPI(apiKey, apiUrl, model, aiService, systemPrompt, quantity) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
    };

    // 构建请求体
    let requestBody;

    // 根据不同的服务类型构建请求
    if (aiService === 'gemini') {
        // Gemini API 格式
        requestBody = {
            contents: [{
                parts: [{
                    text: systemPrompt
                }]
            }],
            generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 2048,
                candidateCount: 1
            }
        };

        // Gemini 的 URL 格式不同
        const url = `${apiUrl}?key=${apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API Error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;

    } else {
        // OpenAI / DeepSeek / 豆包（兼容 OpenAI 格式）
        requestBody = {
            model: model || 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `请生成 ${quantity} 条语录，直接输出，不要编号。`
                }
            ],
            temperature: 0.8,
            max_tokens: 2048
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`LLM API Error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    }
}

// ============================================
// 响应解析函数
// ============================================

/**
 * 解析生成的语录
 * @param {string} responseText - LLM 响应文本
 * @param {number} quantity - 期望的数量
 * @returns {string[]} 解析后的语录数组
 */
function parseGeneratedPhrases(responseText, quantity) {
    if (!responseText || typeof responseText !== 'string') {
        return [];
    }

    // 清理响应文本
    let cleanedText = responseText.trim();

    // 移除可能的 markdown 格式
    cleanedText = cleanedText.replace(/```[\w]*\n?/g, '');

    // 移除编号
    cleanedText = cleanedText.replace(/^\d+[\.\、\)]\s*/gm, '');

    // 移除引号（如果整行都被引号包裹）
    cleanedText = cleanedText.replace(/^["'«»""''„""〝〞〟＇＂]/gm, '');

    // 按行分割
    let phrases = cleanedText
        .split(/\n+/)
        .map(line => line.trim())
        .filter(line => line.length > 0); // 移除空行

    // 如果数量不足，尝试按其他分隔符分割
    if (phrases.length < quantity) {
        // 尝试按句号、分号等分割
        const alternativePhrases = cleanedText
            .split(/[。；;！!]+/)
            .map(line => line.trim())
            .filter(line => line.length > 5); // 至少要有一定长度

        if (alternativePhrases.length > phrases.length) {
            phrases = alternativePhrases;
        }
    }

    // 去重
    const uniquePhrases = [...new Set(phrases)];

    // 截取指定数量
    return uniquePhrases.slice(0, quantity);
}

// 导出 handler 和辅助函数 - 同时支持 CommonJS 和 ES Module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        default: handler,  // ✅ 确保导出 default
        handler,
        buildSystemPrompt,
        buildGreetingPrompt,
        buildEncouragePrompt,
        buildRemindPrompt,
        parseGeneratedPhrases
    };
}

// Vercel 部署时使用
if (typeof exports !== 'undefined') {
    exports.default = handler;
}
