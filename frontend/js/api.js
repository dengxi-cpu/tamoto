// Frontend API client. Provider credentials live only in Vercel server environment variables.

// Remove credentials left behind by versions that stored provider settings in the browser.
['apiKey', 'apiUrl', 'apiModel', 'aiService', 'apiProfiles', 'activeApiProfileId', 'apiConfigs']
    .forEach(key => localStorage.removeItem(key));

const API_CONFIG = {
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000
};

async function apiCall(endpoint, options = {}) {
    const {
        method = 'GET',
        body = null,
        headers = {},
        timeout = API_CONFIG.timeout,
        retryCount = API_CONFIG.retryCount,
        retryDelay = API_CONFIG.retryDelay
    } = options;

    const fetchOptions = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers }
    };
    if (body && method !== 'GET') {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    async function makeRequest(attempt = 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch((window.APP_BASE || '') + endpoint, { ...fetchOptions, signal: controller.signal });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const error = new Error(payload.error || `HTTP Error: ${response.status}`);
                error.status = response.status;
                throw error;
            }
            return payload;
        } catch (error) {
            const retryable = error.name === 'AbortError' || error.status >= 500;
            if (!retryable || attempt >= retryCount) throw error;
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
            return makeRequest(attempt + 1);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    return makeRequest();
}

async function requestPhraseGeneration(body) {
    try {
        const response = await apiCall('/api/generate', { method: 'POST', body });
        return {
            success: true,
            data: { results: response.data?.results || response.results || [] }
        };
    } catch (error) {
        console.error('AI phrase generation failed:', error);
        return { success: false, error: formatAIError(error) };
    }
}

async function generateEncouragements(description, quantity = 5, userTitle = '大小姐', options = {}) {
    return requestPhraseGeneration({
        type: 'encourage',
        characterDescription: description,
        userTitle,
        quantity,
        referenceStyle: options.referenceStyle
    });
}

async function generateGreetings(description, quantity = 5, userTitle = '大小姐', options = {}) {
    return requestPhraseGeneration({
        type: 'greeting',
        characterDescription: description,
        userTitle,
        quantity,
        referenceStyle: options.referenceStyle
    });
}

async function generateReminders(description, quantity = 5, level = 'normal', userTitle = '大小姐', options = {}) {
    return requestPhraseGeneration({
        type: 'remind',
        remindLevel: level,
        characterDescription: description,
        userTitle,
        quantity,
        referenceStyle: options.referenceStyle
    });
}

async function regenerateSingleEncouragement(description, userTitle = '大小姐') {
    const result = await generateEncouragements(description, 1, userTitle);
    return result.success && result.data.results.length
        ? { success: true, data: result.data.results[0] }
        : { success: false, error: result.error || '生成结果为空' };
}

async function regenerateSinglePhrase(type, description, userTitle = '大小姐', level = 'normal', options = {}) {
    let result;
    if (type === 'greeting') result = await generateGreetings(description, 1, userTitle, options);
    else if (type === 'encourage') result = await generateEncouragements(description, 1, userTitle, options);
    else if (type === 'remind') result = await generateReminders(description, 1, level, userTitle, options);
    else return { success: false, error: '无效的语录类型' };

    return result.success && result.data.results.length
        ? { success: true, data: result.data.results[0] }
        : { success: false, error: result.error || '生成结果为空' };
}

async function generateAllPhrases(params) {
    try {
        const {
            description,
            userTitle = '大小姐',
            generateGreetings: shouldGenerateGreetings = false,
            generateEncouragements: shouldGenerateEncouragements = false,
            generateReminders: shouldGenerateReminders = false,
            reminderLevels = ['normal'],
            greetingQuantity = 5,
            encourageQuantity = 10,
            remindQuantity = 5,
            referenceStyle
        } = params;
        const data = {};
        const requests = [];

        if (shouldGenerateGreetings) {
            requests.push(generateGreetings(description, greetingQuantity, userTitle, { referenceStyle })
                .then(result => { data.greetings = result.success ? result.data.results : []; }));
        }
        if (shouldGenerateEncouragements) {
            requests.push(generateEncouragements(description, encourageQuantity, userTitle, { referenceStyle })
                .then(result => { data.encouragements = result.success ? result.data.results : []; }));
        }
        if (shouldGenerateReminders) {
            data.reminders = {};
            reminderLevels.forEach(remindLevel => {
                requests.push(generateReminders(description, remindQuantity, remindLevel, userTitle, { referenceStyle })
                    .then(result => { data.reminders[remindLevel] = result.success ? result.data.results : []; }));
            });
        }

        await Promise.all(requests);
        return { success: true, data };
    } catch (error) {
        return { success: false, error: formatAIError(error) };
    }
}

async function sendChatMessage(message, systemPrompt, chatHistory = []) {
    try {
        const ocIndex = typeof getCurrentOCIndex === 'function' ? getCurrentOCIndex() : 0;
        const ignoreHistoryKey = `ignoreHistory_${ocIndex}`;
        const ignoreHistory = localStorage.getItem(ignoreHistoryKey) === 'true';
        const response = await apiCall('/api/chat', {
            method: 'POST',
            body: {
                systemPrompt,
                message,
                chatHistory: ignoreHistory ? [] : chatHistory,
                ignoreHistory
            }
        });
        if (ignoreHistory) localStorage.removeItem(ignoreHistoryKey);
        return { success: true, data: response.data || response };
    } catch (error) {
        console.error('Chat API request failed:', error);
        return { success: false, error: formatAIError(error) };
    }
}

async function checkAPIHealth() {
    try {
        const data = await apiCall('/api/health', { timeout: 5000, retryCount: 1 });
        return { success: true, data };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

function formatAIError(error) {
    if (error.status === 429 || String(error.message).includes('429')) return 'AI 请求较多，请稍后再试';
    if (error.name === 'AbortError') return '请求超时，请检查网络后重试';
    return error.message || '操作失败，请稍后重试';
}

function handleAPIError(error, userMessage = '操作失败，请稍后重试') {
    return formatAIError(error instanceof Error ? error : new Error(String(error || userMessage)));
}

async function getStatsData() {
    return {
        success: true,
        data: {
            pieData: { labels: [], data: [], times: [] },
            trendData: { labels: [], data: [] },
            tomatoCount: 0,
            abandonCount: 0,
            focusDuration: 0,
            ocMessage: ''
        }
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
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
