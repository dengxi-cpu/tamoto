// frontend/js/api.js
// API调用模块 - 处理所有与后端API的通信

// ============================================
// 多API配置管理系统
// ============================================

const API_PROFILES_STORAGE_KEY = 'apiProfiles';
const ACTIVE_API_PROFILE_ID_KEY = 'activeApiProfileId';

// 默认支持的AI服务和模型
const AI_SERVICES = {
    'openai': {
        name: 'OpenAI',
        defaultUrl: 'https://api.openai.com/v1/chat/completions',
        models: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o']
    },
    'deepseek': {
        name: 'DeepSeek',
        defaultUrl: 'https://api.deepseek.com/v1/chat/completions',
        models: ['deepseek-chat', 'deepseek-coder']
    },
    'doubao': {
        name: '豆包',
        defaultUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        models: ['doubao-pro-4k', 'doubao-pro-32k', 'doubao-lite-4k']
    },
    'gemini': {
        name: 'Gemini',
        defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent',
        models: ['gemini-pro', 'gemini-pro-vision']
    }
};

/**
 * 初始化API配置系统
 * 自动从旧版本迁移配置
 */
function initAPIProfiles() {
    let profiles = getAPIProfiles();

    // 如果没有配置，尝试从旧版本迁移
    if (profiles.length === 0) {
        const oldApiKey = localStorage.getItem('apiKey');
        const oldAiService = localStorage.getItem('aiService') || 'openai';
        const oldApiUrl = localStorage.getItem('apiUrl') || '';
        const oldApiModel = localStorage.getItem('apiModel') || 'gpt-3.5-turbo';

        // 如果有旧配置，迁移到新结构
        if (oldApiKey) {
            const defaultProfile = {
                id: generateProfileId(),
                name: '默认配置',
                aiService: oldAiService,
                apiModel: oldApiModel,
                apiUrl: oldApiUrl,
                apiKey: oldApiKey,
                isActive: true,
                isExpanded: false,
                createdAt: Date.now()
            };

            profiles = [defaultProfile];
            saveAPIProfiles(profiles);
            setActiveAPIProfileId(defaultProfile.id);

            console.log('✅ 已从旧版本迁移API配置');
        }
    }

    // 确保有激活的配置
    const activeId = getActiveAPIProfileId();
    if (!activeId && profiles.length > 0) {
        setActiveAPIProfileId(profiles[0].id);
    }

    return profiles;
}

/**
 * 生成唯一的配置ID
 */
function generateProfileId() {
    return 'api_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * 获取所有API配置
 */
function getAPIProfiles() {
    try {
        const profilesJson = localStorage.getItem(API_PROFILES_STORAGE_KEY);
        return profilesJson ? JSON.parse(profilesJson) : [];
    } catch (error) {
        console.error('读取API配置失败:', error);
        return [];
    }
}

/**
 * 保存所有API配置
 */
function saveAPIProfiles(profiles) {
    try {
        localStorage.setItem(API_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
        return true;
    } catch (error) {
        console.error('保存API配置失败:', error);
        return false;
    }
}

/**
 * 获取当前激活的配置ID
 */
function getActiveAPIProfileId() {
    return localStorage.getItem(ACTIVE_API_PROFILE_ID_KEY);
}

/**
 * 设置当前激活的配置ID
 */
function setActiveAPIProfileId(profileId) {
    localStorage.setItem(ACTIVE_API_PROFILE_ID_KEY, profileId);

    // 更新所有配置的激活状态
    const profiles = getAPIProfiles();
    profiles.forEach(p => p.isActive = (p.id === profileId));
    saveAPIProfiles(profiles);
}

/**
 * 获取当前激活的API配置对象
 */
function getActiveAPIProfile() {
    const profiles = getAPIProfiles();
    const activeId = getActiveAPIProfileId();

    if (profiles.length === 0) {
        return null;
    }

    // 如果没有激活的配置，返回第一个
    if (!activeId) {
        return profiles[0];
    }

    return profiles.find(p => p.id === activeId) || profiles[0];
}

/**
 * 保存或更新单个API配置
 */
function saveAPIProfile(profile) {
    const profiles = getAPIProfiles();
    const existingIndex = profiles.findIndex(p => p.id === profile.id);

    if (existingIndex >= 0) {
        // 更新现有配置
        profiles[existingIndex] = { ...profiles[existingIndex], ...profile };
    } else {
        // 添加新配置
        profiles.push(profile);
    }

    saveAPIProfiles(profiles);
    return true;
}

/**
 * 删除API配置
 */
function deleteAPIProfile(profileId) {
    let profiles = getAPIProfiles();

    // 如果删除的是当前激活的配置，需要先切换到其他配置
    if (getActiveAPIProfileId() === profileId) {
        const otherProfiles = profiles.filter(p => p.id !== profileId);
        if (otherProfiles.length > 0) {
            setActiveAPIProfileId(otherProfiles[0].id);
        } else {
            localStorage.removeItem(ACTIVE_API_PROFILE_ID_KEY);
        }
    }

    profiles = profiles.filter(p => p.id !== profileId);
    saveAPIProfiles(profiles);
    return true;
}

/**
 * 根据AI服务获取默认URL
 */
function getDefaultUrlByService(service) {
    return AI_SERVICES[service]?.defaultUrl || '';
}

/**
 * 根据AI服务获取可用模型列表
 */
function getModelsByService(service) {
    return AI_SERVICES[service]?.models || [];
}

// ============================================
// 兼容旧版本的API配置接口
// ============================================

// 存储用户的API配置（保留旧接口以保持兼容性）
let userAPIConfig = {
    apiKey: localStorage.getItem('apiKey') || '',
    aiService: localStorage.getItem('aiService') || 'openai',
    apiUrl: localStorage.getItem('apiUrl') || '',
    apiModel: localStorage.getItem('apiModel') || 'gpt-3.5-turbo'
};

// 保存API配置（旧接口，保留兼容性）
function saveAPIConfig(apiKey, aiService, apiUrl, apiModel) {
    // 保存到旧的位置（兼容性）
    localStorage.setItem('apiKey', apiKey);
    localStorage.setItem('aiService', aiService);
    localStorage.setItem('apiUrl', apiUrl);
    localStorage.setItem('apiModel', apiModel);

    // 同时更新旧的全局变量
    userAPIConfig = { apiKey, aiService, apiUrl, apiModel };

    // 如果有新的配置系统，也更新当前激活的配置
    const activeProfile = getActiveAPIProfile();
    if (activeProfile) {
        activeProfile.apiKey = apiKey;
        activeProfile.aiService = aiService;
        activeProfile.apiUrl = apiUrl;
        activeProfile.apiModel = apiModel;
        saveAPIProfile(activeProfile);
    }
}

// 获取API配置（更新为使用新的多配置系统）
function getAPIConfig() {
    // 优先使用新的配置系统
    const activeProfile = getActiveAPIProfile();

    if (activeProfile) {
        // 如果URL为空，使用默认URL
        if (!activeProfile.apiUrl && activeProfile.aiService) {
            activeProfile.apiUrl = getDefaultUrlByService(activeProfile.aiService);
        }

        return {
            apiKey: activeProfile.apiKey,
            aiService: activeProfile.aiService,
            apiUrl: activeProfile.apiUrl,
            apiModel: activeProfile.apiModel
        };
    }

    // 降级到旧系统
    return userAPIConfig;
}

// API配置
const API_CONFIG = {
    baseURL: '/api',  // Vercel会自动处理相对路径
    timeout: 30000,  // 30秒超时
    retryCount: 3,   // 重试次数
    retryDelay: 1000 // 重试延迟（毫秒）
};

// 通用API调用函数
async function apiCall(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {},
        timeout = API_CONFIG.timeout,
        retryCount = API_CONFIG.retryCount,
        retryDelay = API_CONFIG.retryDelay
    } = options;

    // 默认请求头
    const defaultHeaders = {
        'Content-Type': 'application/json',
        ...headers
    };

    // 请求配置
    const fetchOptions = {
        method,
        headers: defaultHeaders,
    };

    if (body && method !== 'GET') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    // 带重试的请求函数
    const makeRequest = async (attempt = 1) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(endpoint, {
                ...fetchOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            return data;

        } catch (error) {
            clearTimeout(timeoutId);

            // 如果是最后一次尝试，直接抛出错误
            if (attempt >= retryCount) {
                throw error;
            }

            // 如果是网络错误或服务器错误，进行重试
            if (error.name === 'AbortError' || 
                error.message.includes('HTTP Error: 5') || 
                error.message.includes('Network')) {
                
                console.warn(`API请求失败，第 ${attempt} 次重试中...`, error.message);
                
                // 等待一段时间后重试
                await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                return makeRequest(attempt + 1);
            }

            // 其他错误直接抛出
            throw error;
        }
    };

    return makeRequest();
}


// AI鼓励语生成API（更新为新格式）
async function generateEncouragements(description, quantity = 5, userTitle = '大小姐', options = {}) {
    try {
        const config = getAPIConfig();

        if (!config.apiKey) {
            throw new Error('请先设置API密钥');
        }

        if (!config.apiUrl) {
            // 根据服务类型设置默认URL
            const defaultUrls = {
                'openai': 'https://api.openai.com/v1/chat/completions',
                'deepseek': 'https://api.deepseek.com',
                'doubao': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
            };
            config.apiUrl = defaultUrls[config.aiService] || '';
        }

        const response = await apiCall('/api/generate', {
            method: 'POST',
            body: {
                apiKey: config.apiKey,
                apiUrl: config.apiUrl,
                apiModel: config.apiModel,
                aiService: config.aiService,
                type: 'encourage',
                characterDescription: description,
                userTitle: userTitle,
                quantity: quantity,
                referenceStyle: options.referenceStyle
            }
        });

        return {
            success: true,
            data: {
                results: response.data?.results || response.results || []
            }
        };

    } catch (error) {
        console.error('生成鼓励语失败:', error);

        let errorMessage = error.message;
        if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查密钥是否正确';
        } else if (error.message.includes('429')) {
            errorMessage = 'API调用次数超限，请稍后再试';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = '网络连接失败，请检查网络或API地址是否正确';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

// 单个鼓励语重新生成API
async function regenerateSingleEncouragement(description, userTitle = '大小姐') {
    try {
        const response = await generateEncouragements(description, 1, userTitle);
        
        if (response.success && response.data.results && response.data.results.length > 0) {
            return {
                success: true,
                data: response.data.results[0]
            };
        } else {
            throw new Error('生成结果为空');
        }

    } catch (error) {
        console.error('重新生成鼓励语失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// AI聊天API（完整版，支持OC人设和状态）
async function sendChatMessage(message, systemPrompt, chatHistory = []) {
    try {
        const config = getAPIConfig();

        if (!config.apiKey) {
            throw new Error('请先设置API密钥');
        }

        if (!config.apiUrl) {
            // 根据服务类型设置默认URL
            const defaultUrls = {
                'deepseek': 'https://api.deepseek.com/v1/chat/completions',
                'openai': 'https://api.openai.com/v1/chat/completions',
                'doubao': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
            };
            config.apiUrl = defaultUrls[config.aiService] || '';
        }

        // ✅ 检查是否需要忽略历史记录
        const ocIndex = typeof getCurrentOCIndex === 'function' ? getCurrentOCIndex() : 0;
        const ignoreHistory = localStorage.getItem(`ignoreHistory_${ocIndex}`) === 'true';

        // 🔍 调试日志
        console.log('='.repeat(80));
        console.log('📤 发送 AI 聊天请求');
        console.log('='.repeat(80));
        console.log('🔗 API URL:', config.apiUrl);
        console.log('📋 请求方法: POST');
        console.log('🎯 模型:', config.apiModel);
        console.log('📝 用户消息:', message);
        console.log('📄 System Prompt (前200字符):');
        console.log(systemPrompt.substring(0, 200) + '...');
        console.log('💬 聊天历史条数:', chatHistory.length);
        console.log('🚫 忽略历史:', ignoreHistory);
        console.log('='.repeat(80));

        const startTime = performance.now();

        const response = await apiCall('/api/chat', {
            method: 'POST',
            body: {
                apiKey: config.apiKey,
                apiUrl: config.apiUrl,
                apiModel: config.apiModel,
                aiService: config.aiService,
                systemPrompt: systemPrompt,  // ✅ 直接传递前端生成的 System Prompt
                message: message,
                chatHistory: ignoreHistory ? [] : chatHistory,  // 如果忽略历史则传空数组
                ignoreHistory: ignoreHistory
            }
        });

        const endTime = performance.now();
        const requestTime = (endTime - startTime).toFixed(2);

        // ✅ 清除忽略历史标记（只生效一次）
        if (ignoreHistory) {
            localStorage.removeItem(`ignoreHistory_${ocIndex}`);
            console.log('✅ 已清除忽略历史标记');
        }

        // ✅ 响应日志
        console.log('✅ AI 请求成功');
        console.log('⏱️ 请求耗时:', requestTime + 'ms');
        console.log('💬 AI 回复内容:');
        console.log(response.data?.reply || response.reply || '无回复内容');
        console.log('='.repeat(80));
        console.log('');

        return {
            success: true,
            data: response.data || response
        };

    } catch (error) {
        console.error('❌ 聊天API调用失败:', error);

        // 根据错误类型提供更详细的错误信息
        let errorMessage = error.message;
        if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查密钥是否正确';
        } else if (error.message.includes('429')) {
            errorMessage = 'API调用次数超限，请稍后再试';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = '网络连接失败，请检查网络或API地址是否正确';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

// API健康检查
async function checkAPIHealth() {
    try {
        const response = await apiCall('/api/health', {
            method: 'GET',
            timeout: 5000,
            retryCount: 1
        });

        return {
            success: true,
            data: response
        };

    } catch (error) {
        console.error('API健康检查失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 错误处理工具函数
function handleAPIError(error, userMessage = '操作失败，请稍后重试') {
    let displayMessage = userMessage;
    
    // 根据错误类型提供更具体的提示
    if (error.includes('timeout') || error.includes('AbortError')) {
        displayMessage = '请求超时，请检查网络连接后重试';
    } else if (error.includes('HTTP Error: 429')) {
        displayMessage = '请求过于频繁，请稍后再试';
    } else if (error.includes('HTTP Error: 5')) {
        displayMessage = '服务器暂时不可用，请稍后重试';
    } else if (error.includes('Network')) {
        displayMessage = '网络连接异常，请检查网络设置';
    }
    
    return displayMessage;
}

// ============================================
// 新增：AI 语录生成 API 函数
// ============================================

/**
 * 生成问候语
 * @param {string} description - OC人设描述
 * @param {number} quantity - 生成数量（默认5条）
 * @param {string} userTitle - 用户称呼（默认"大小姐"）
 * @param {object} options - 可选参数 { referenceStyle }
 * @returns {Promise<{success: boolean, data?: {results: string[]}, error?: string}>}
 */
async function generateGreetings(description, quantity = 5, userTitle = '大小姐', options = {}) {
    try {
        const config = getAPIConfig();

        if (!config.apiKey) {
            throw new Error('请先设置API密钥');
        }

        if (!config.apiUrl) {
            // 根据服务类型设置默认URL
            const defaultUrls = {
                'openai': 'https://api.openai.com/v1/chat/completions',
                'deepseek': 'https://api.deepseek.com/v1/chat/completions',
                'doubao': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
            };
            config.apiUrl = defaultUrls[config.aiService] || '';
        }

        const response = await apiCall('/api/generate', {
            method: 'POST',
            body: {
                apiKey: config.apiKey,
                apiUrl: config.apiUrl,
                apiModel: config.apiModel,
                aiService: config.aiService,
                type: 'greeting',
                characterDescription: description,
                userTitle: userTitle,
                quantity: quantity,
                referenceStyle: options.referenceStyle
            }
        });

        return {
            success: true,
            data: {
                results: response.data?.results || response.results || []
            }
        };

    } catch (error) {
        console.error('生成问候语失败:', error);

        let errorMessage = error.message;
        if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查密钥是否正确';
        } else if (error.message.includes('429')) {
            errorMessage = 'API调用次数超限，请稍后再试';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = '网络连接失败，请检查网络或API地址是否正确';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * 生成督促语
 * @param {string} description - OC人设描述
 * @param {number} quantity - 生成数量（默认5条）
 * @param {string} level - 督促级别：'normal' | 'annoyed' | 'angry'
 * @param {string} userTitle - 用户称呼（默认"大小姐"）
 * @param {object} options - 可选参数 { referenceStyle }
 * @returns {Promise<{success: boolean, data?: {results: string[]}, error?: string}>}
 */
async function generateReminders(description, quantity = 5, level = 'normal', userTitle = '大小姐', options = {}) {
    try {
        const config = getAPIConfig();

        if (!config.apiKey) {
            throw new Error('请先设置API密钥');
        }

        if (!config.apiUrl) {
            // 根据服务类型设置默认URL
            const defaultUrls = {
                'openai': 'https://api.openai.com/v1/chat/completions',
                'deepseek': 'https://api.deepseek.com/v1/chat/completions',
                'doubao': 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
                'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
            };
            config.apiUrl = defaultUrls[config.aiService] || '';
        }

        const response = await apiCall('/api/generate', {
            method: 'POST',
            body: {
                apiKey: config.apiKey,
                apiUrl: config.apiUrl,
                apiModel: config.apiModel,
                aiService: config.aiService,
                type: 'remind',
                remindLevel: level,
                characterDescription: description,
                userTitle: userTitle,
                quantity: quantity,
                referenceStyle: options.referenceStyle
            }
        });

        return {
            success: true,
            data: {
                results: response.data?.results || response.results || []
            }
        };

    } catch (error) {
        console.error('生成督促语失败:', error);

        let errorMessage = error.message;
        if (error.message.includes('401')) {
            errorMessage = 'API密钥无效，请检查密钥是否正确';
        } else if (error.message.includes('429')) {
            errorMessage = 'API调用次数超限，请稍后再试';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = '网络连接失败，请检查网络或API地址是否正确';
        }

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * 重新生成单条语录
 * @param {string} type - 语录类型：'greeting' | 'encourage' | 'remind'
 * @param {string} description - OC人设描述
 * @param {string} userTitle - 用户称呼
 * @param {string} level - 督促级别（仅当 type='remind' 时需要）
 * @param {object} options - 可选参数 { referenceStyle }
 * @returns {Promise<{success: boolean, data?: string, error?: string}>}
 */
async function regenerateSinglePhrase(type, description, userTitle = '大小姐', level = 'normal', options = {}) {
    try {
        let result;

        if (type === 'greeting') {
            result = await generateGreetings(description, 1, userTitle, options);
        } else if (type === 'encourage') {
            result = await generateEncouragements(description, 1, userTitle);
        } else if (type === 'remind') {
            result = await generateReminders(description, 1, level, userTitle, options);
        } else {
            throw new Error('无效的语录类型');
        }

        if (result.success && result.data.results && result.data.results.length > 0) {
            return {
                success: true,
                data: result.data.results[0]
            };
        } else {
            throw new Error('生成结果为空');
        }

    } catch (error) {
        console.error('重新生成语录失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 批量生成多种类型的语录
 * @param {object} params - 生成参数
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function generateAllPhrases(params) {
    try {
        const {
            description,
            userTitle = '大小姐',
            generateGreetings: shouldGenGreetings = false,
            generateEncouragements: shouldGenEncouragements = false,
            generateReminders: shouldGenReminders = false,
            reminderLevels = ['normal'],
            greetingQuantity = 5,
            encourageQuantity = 10,
            remindQuantity = 5,
            referenceStyle
        } = params;

        const results = {};

        // 并发生成各种语录
        const promises = [];

        if (shouldGenGreetings) {
            promises.push(
                generateGreetings(description, greetingQuantity, userTitle, { referenceStyle })
                    .then(result => {
                        results.greetings = result.success ? result.data.results : [];
                        return result;
                    })
            );
        }

        if (shouldGenEncouragements) {
            promises.push(
                generateEncouragements(description, encourageQuantity, userTitle)
                    .then(result => {
                        results.encouragements = result.success ? result.data.results : [];
                        return result;
                    })
            );
        }

        if (shouldGenReminders) {
            // 为每个级别生成督促语
            reminderLevels.forEach(level => {
                promises.push(
                    generateReminders(description, remindQuantity, level, userTitle, { referenceStyle })
                        .then(result => {
                            if (!results.reminders) results.reminders = {};
                            results.reminders[level] = result.success ? result.data.results : [];
                            return result;
                        })
                );
            });
        }

        // 等待所有生成完成
        await Promise.all(promises);

        return {
            success: true,
            data: results
        };

    } catch (error) {
        console.error('批量生成语录失败:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// 导出API函数（如果使用模块化）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        saveAPIConfig,
        getAPIConfig,
        generateEncouragements,
        generateGreetings,
        generateReminders,
        regenerateSinglePhrase,
        generateAllPhrases,
        regenerateSingleEncouragement,
        sendChatMessage,
        checkAPIHealth,
        handleAPIError,
        getStatsData
    };
}

// 🔧 修复：确保多配置管理函数在浏览器环境中可用
if (typeof window !== 'undefined') {
    // 将所有多配置管理函数挂载到window对象
    window.initAPIProfiles = initAPIProfiles;
    window.generateProfileId = generateProfileId;
    window.getAPIProfiles = getAPIProfiles;
    window.saveAPIProfiles = saveAPIProfiles;
    window.getActiveAPIProfileId = getActiveAPIProfileId;
    window.setActiveAPIProfileId = setActiveAPIProfileId;
    window.getActiveAPIProfile = getActiveAPIProfile;
    window.saveAPIProfile = saveAPIProfile;
    window.deleteAPIProfile = deleteAPIProfile;
    window.getDefaultUrlByService = getDefaultUrlByService;
    window.getModelsByService = getModelsByService;
    window.getAPIConfig = getAPIConfig;
    window.saveAPIConfig = saveAPIConfig;
}

// 临时模拟统计API（开发用）
async function getStatsData(timeTab, date) {
    // 模拟API延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // 返回模拟数据（与api/stats.js中的数据结构相同）
    const mockData = {
        day: {
            pieData: {
                labels: ['学习', '工作', '阅读', '运动', '其他'],
                data: [120, 90, 45, 30, 35],
                times: ['2h 0m', '1h 30m', '45m', '30m', '35m']
            },
            trendData: {
                labels: ['6时', '9时', '12时', '15时', '18时', '21时'],
                data: [0, 85, 70, 90, 75, 40]
            },
            tomatoCount: 15,
            abandonCount: 2,
            focusDuration: 320 * 60,
            ocMessage: "今天的专注状态很棒哦！继续保持～"
        },
        week: {
            pieData: {
                labels: ['学习', '工作', '阅读', '运动', '娱乐'],
                data: [450, 380, 180, 120, 125],
                times: ['7h 30m', '6h 20m', '3h 0m', '2h 0m', '2h 5m']
            },
            trendData: {
                labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                data: [75, 82, 78, 88, 85, 60, 55]
            },
            tomatoCount: 65,
            abandonCount: 8,
            focusDuration: 1255 * 60,
            ocMessage: "这周表现很稳定，继续加油！"
        }
    };
    
    return {
        success: true,
        data: {
            totalPomodoros: 182,
            totalDays: 35,
            todayFocusTime: 5 * 3600 + 42 * 60,
            totalFocusTime: 286 * 3600,
            periodData: mockData[timeTab] || mockData.day
        }
    };
}
