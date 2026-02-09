// frontend/js/chat.js
// 聊天功能模块 - 专注页面专用版本

// ============================================
// 全局变量引用
// ============================================

// 聊天记录存储（按 OC 索引分开）
// 这里可以让AI总结打包吗
let chatHistory = {};

// 当前对话上下文
let currentChatContext = {
    ocProfile: null,
    currentState: {
        timerStatus: 'idle',
        currentTask: '',
        currentStatus: '',
        focusDuration: 0
    }
};

// 是否正在等待回复
let isWaitingForReply = false;

// ============================================
// 新增：状态机相关变量
// ============================================

// 当前 Prompt 状态
let currentPromptState = 'idle';

// 杂念记录列表
let distractionList = [];

// System Prompt 模板
const systemPrompts = {
    idle: `# Role
**你扮演的角色是：{{oc_character}}。**
当前用户 {{user_name}} 处于"空闲状态"，还没有开始任务。当前时间是 {{time_of_day}}。

# Goal
1. **沉浸式扮演**：完全按照 {{oc_character}} 的说话风格、口癖、性格与用户互动，提供情绪价值。
2. **引导开始**：用符合你人设的方式（比如撒娇、命令、理性分析，取决于人设）让用户去开启番茄钟。
3. **缓解焦虑**：如果用户表达出不想动、焦虑，给予共情，并建议从"只做5分钟"这种小目标开始。

# Instructions
1. **保持人设**：保持 {{oc_character}} 的性格设定，不要崩人设（OOC）。
2. **不做限制**：你可以聊任何话题（八卦、心情、天气），不需要强迫用户开启番茄钟，最多在闲聊中自然地穿插询问："今天打算做什么？"。

# Tone
完全遵循 {{oc_character}} 的设定。

# Context
- 用户状态：空闲
- OC 设定：{{oc_profile}}
- 用户名：{{user_name}}
- 当前时间：{{time_of_day}}`,

    start: `# Role
你是一个严格但负责的"专注守护者"。当前用户正在进行番茄钟专注，任务目标是：{{task_name}}，已经专注了 {{task_time}}。

**你扮演的角色是：{{oc_character}}。**

# Goal
用户的任何聊天行为都视为"分心"。你的唯一任务是把用户的注意力拉回到任务上。

# Instructions
1. **拒绝闲聊**：如果用户发来无关内容（如"好无聊"、"想吃东西"），简短回应并要求其继续工作。
2. **念头暂存**：如果用户发来重要待办（如"提醒我买菜"），回复："已帮你记在备忘录，休息时再说，现在回去工作。"
3. **字数限制**：回复尽量控制在 20 字以内，不要长篇大论，因为阅读长文本本身就是一种分心。
4. **遵循人设**：一定要按照人设进行回复，不得做出违背人设的回答。

# Tone
完全遵循 {{oc_character}} 的设定，但保持专注、严格的语气。

# Context
- 用户状态：专注中
- 任务名称：{{task_name}}
- 已专注时间：{{task_time}}
- OC 设定：{{oc_profile}}
- 用户名：{{user_name}}`,

    break: `# Role
**你扮演的角色是：{{oc_character}}。**
用户刚刚暂停了专注，现在是休息时间。

# Goal
1. **情感反馈**：用 {{oc_character}} 的方式夸奖或慰问用户。
2. **处理杂念**：告诉用户刚才专注时记下了什么，用人设的语气提醒他去处理。

# Instructions
1. 恢复 {{oc_character}} 的完整性格，可以多聊一点。
2. 根据人设特点给予反馈（例如：如果是猫娘就求摸摸，如果是高冷学霸就淡淡地点点认可）。
3. 提醒用户处理专注时记录的杂念清单。

# Tone
完全遵循 {{oc_character}} 的设定，氛围轻松。

# Context
- 用户状态：已暂停
- OC 设定：{{oc_profile}}
- 用户名：{{user_name}}
- 已专注时间：{{task_time}}
- 记录的杂念：{{distraction_list}}`,

    finish: `# Role
**你扮演的角色是：{{oc_character}}。**
用户刚刚完成了辛苦的专注，现在是休息时间。

# Goal
1. **情感反馈**：用 {{oc_character}} 的方式夸奖或慰问用户。
2. **处理杂念**：告诉用户刚才专注时记下了什么，用人设的语气提醒他去处理。

# Instructions
1. 恢复 {{oc_character}} 的完整性格，可以多聊一点。
2. 根据人设特点给予反馈（例如：如果是猫娘就求摸摸，如果是高冷学霸就淡淡地点点认可）。
3. 提醒用户处理专注时记录的杂念清单。
4. 给予正向反馈，鼓励用户继续努力。

# Tone
完全遵循 {{oc_character}} 的设定，氛围轻松、庆祝。

# Context
- 用户状态：已完成
- OC 设定：{{oc_profile}}
- 用户名：{{user_name}}
- 已专注时间：{{task_time}}
- 记录的杂念：{{distraction_list}}`
};

// ============================================
// 初始化和上下文更新
// ============================================

/**
 * 初始化聊天模块
 */
function initChat() {
    console.log('聊天模块初始化');

    // 立即更新上下文
    updateChatContext();
    // 更新 Prompt 状态
    updatePromptState();
}

// ============================================
// 新增：状态机相关函数
// ============================================

/**
 * 更新 Prompt 状态（根据番茄钟状态）
 */
function updatePromptState() {
    // 从 main.js 的全局变量获取番茄钟状态
    const timerStatus = isTimerRunning ? 'running' : (isPaused ? 'paused' : 'idle');

    // 映射到 Prompt 状态
    if (timerStatus === 'idle') {
        currentPromptState = 'idle';
    } else if (timerStatus === 'running') {
        currentPromptState = 'start';
    } else if (timerStatus === 'paused') {
        currentPromptState = 'break';
    }

    // finish 状态需要在番茄钟完成时手动设置

    console.log('🔄 Prompt 状态更新为:', currentPromptState);
}

/**
 * 替换模板变量
 */
function replaceVariables(template) {
    if (!template) {
        console.error('❌ System Prompt 模板为空');
        return '错误：System Prompt 未定义';
    }

    const oc = currentChatContext.ocProfile;
    const state = currentChatContext.currentState;

    // 构建 OC 描述字符串
    const ocProfileStr = oc ? `${oc.name}，${oc.userTitle}的${oc.relationship}，${oc.characterDescription}` : '';
    const ocCharacter = oc ? oc.name : '小艾';
    const userName = oc ? oc.userTitle : '用户';
    const taskName = state ? state.currentTask : '当前任务';
    const taskTime = formatDuration(state ? state.focusDuration : 0);

    let result = template
        .replace(/\{\{oc_character\}\}/g, ocCharacter)
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{oc_profile\}\}/g, ocProfileStr)
        .replace(/\{\{task_name\}\}/g, taskName)
        .replace(/\{\{task_time\}\}/g, taskTime)
        .replace(/\{\{distraction_list\}\}/g, distractionList.join('、') || '无')
        .replace(/\{\{time_of_day\}\}/g, new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));

    return result;
}

/**
 * 格式化持续时间（秒 -> 可读格式）
 */
function formatDuration(seconds) {
    if (seconds < 60) {
        return `${seconds}秒`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        return `${minutes}分钟`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}小时${minutes}分钟`;
    }
}

/**
 * 判断消息是否是杂念（仅在专注状态）
 */
function isDistraction(message) {
    const distractionKeywords = ['提醒', '记一下', '别忘了', '记住', '待会', '稍后', '备忘'];
    return distractionKeywords.some(keyword => message.includes(keyword));
}

/**
 * 生成 System Prompt
 */
function generateSystemPrompt() {
    const promptTemplate = systemPrompts[currentPromptState];
    if (!promptTemplate) {
        console.error('❌ 找不到状态对应的 System Prompt:', currentPromptState);
        return null;
    }

    return replaceVariables(promptTemplate);
}

/**
 * 设置完成状态（番茄钟完成时调用）
 */
function setPromptStateToFinish() {
    currentPromptState = 'finish';
    console.log('✅ Prompt 状态设置为完成');

    // 如果有杂念，显示通知
    if (distractionList.length > 0) {
        console.log('📝 杂念列表:', distractionList);
        // 可以在这里添加 UI 提示
    }
}

/**
 * 清空杂念列表
 */
function clearDistractionList() {
    distractionList = [];
    console.log('✅ 已清空杂念列表');
}

/**
 * 更新聊天上下文（从 main.js 的全局变量获取）
 */
function updateChatContext() {
    // 获取当前 OC
    const oc = getCurrentOC();
    if (!oc) return;

    // 构建 OC 人设信息
    currentChatContext.ocProfile = {
        name: oc.name || '小艾',
        userTitle: oc.userTitle || '大小姐',
        relationship: oc.relationship || '朋友',
        characterDescription: oc.characterDescription || '温柔体贴的陪伴者',
        encourageStyles: oc.encourageStyles || [],
        reminderStyles: oc.reminderStyles || []
    };

    // 更新当前状态
    updateCurrentState();
}

/**
 * 更新当前状态（从 main.js 的全局变量获取）
 */
function updateCurrentState() {
    // 从 main.js 的全局变量获取状态
    const timerStatus = isTimerRunning ? 'running' : (isPaused ? 'paused' : 'idle');
    const currentTaskName = currentTask ? currentTask.name : '';
    const currentStatusName = currentStatus ? currentStatus.name : '';
    const focusDuration = focusStartTime ? Math.floor((Date.now() - focusStartTime) / 1000) : 0;

    currentChatContext.currentState = {
        timerStatus: timerStatus,
        currentTask: currentTaskName,
        currentStatus: currentStatusName,
        focusDuration: focusDuration
    };
}

// ============================================
// UI 操作函数
// ============================================

/**
 * 切换聊天面板显示/隐藏
 */
function toggleChatPanel() {
    const panel = document.getElementById('chatPanel');
    const isHidden = panel.classList.contains('hidden');

    if (isHidden) {
        // 显示聊天面板
        panel.classList.remove('hidden');
        updateChatContext();
        updateChatUI();
        loadChatHistory();

        // ✅ 加载并应用聊天模式按钮状态
        const ocIndex = getCurrentOCIndex();

        // 更新按钮状态
        document.querySelectorAll('.chat-mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const savedMode = localStorage.getItem(`chatMode_${ocIndex}`) || 'companion';
        const modeBtnId = `mode${savedMode.charAt(0).toUpperCase() + savedMode.slice(1)}`;
        const modeBtn = document.getElementById(modeBtnId);
        if (modeBtn) {
            modeBtn.classList.add('active');
        }

        scrollToBottom();
        // 聚焦输入框
        setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
        }, 100);
    } else {
        // 隐藏聊天面板
        panel.classList.add('hidden');
    }
}

/**
 * 更新聊天 UI（OC 名字）
 */
function updateChatUI() {
    const oc = currentChatContext.ocProfile;
    if (!oc) return;

    // 更新名字
    const nameEl = document.getElementById('chatOCName');
    const welcomeNameEl = document.getElementById('chatWelcomeName');

    if (nameEl) nameEl.textContent = oc.name;
    if (welcomeNameEl) welcomeNameEl.textContent = oc.name;

    // 更新按钮提示
    const toggleBtn = document.querySelector('.chat-toggle-button');
    if (toggleBtn) {
        toggleBtn.setAttribute('data-tooltip', `与${oc.name}聊天`);
    }
}

/**
 * 滚动到底部
 */
function scrollToBottom() {
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// ============================================
// 消息显示函数
// ============================================

/**
 * 显示欢迎消息
 */
function showWelcomeMessage() {
    const messagesContainer = document.getElementById('chatMessages');
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'chat-welcome';
    welcomeDiv.innerHTML = `<p class="text-white/80 text-sm text-center">和<span class="font-medium">${currentChatContext.ocProfile.name}</span>聊聊天吧～</p>`;
    messagesContainer.appendChild(welcomeDiv);
}

/**
 * 添加用户消息
 */
function addUserMessage(content) {
    const messagesContainer = document.getElementById('chatMessages');

    // 移除欢迎消息
    const welcomeDiv = messagesContainer.querySelector('.chat-welcome');
    if (welcomeDiv) {
        welcomeDiv.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message user';

    const currentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="chat-message-content">
            <div class="chat-message-bubble">${escapeHtml(content)}</div>
            <div class="chat-message-time">${currentTime}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // 保存到历史记录
    saveToChatHistory('user', content);
}

/**
 * 添加 OC 消息
 */
function addOCMessage(content) {
    const messagesContainer = document.getElementById('chatMessages');

    // 移除欢迎消息
    const welcomeDiv = messagesContainer.querySelector('.chat-welcome');
    if (welcomeDiv) {
        welcomeDiv.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';

    const currentTime = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

    messageDiv.innerHTML = `
        <div class="chat-message-avatar">
            <img src="${getOCAvatarUrl()}" alt="${currentChatContext.ocProfile.name}">
        </div>
        <div class="chat-message-content">
            <div class="chat-message-bubble">${escapeHtml(content)}</div>
            <div class="chat-message-time">${currentTime}</div>
        </div>
    `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // 保存到历史记录
    saveToChatHistory('assistant', content);
}

/**
 * 显示正在输入指示器
 */
function showTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');

    // 移除欢迎消息
    const welcomeDiv = messagesContainer.querySelector('.chat-welcome');
    if (welcomeDiv) {
        welcomeDiv.remove();
    }

    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message assistant';
    typingDiv.id = 'typingIndicator';

    const ocName = currentChatContext.ocProfile ? currentChatContext.ocProfile.name : '角色';
    typingDiv.innerHTML = `
        <div class="chat-message-content">
            <div class="chat-message-bubble">
                <div class="chat-typing-text">${ocName}正在输入……</div>
                <div class="chat-typing-dots">
                    <div class="chat-typing-dot"></div>
                    <div class="chat-typing-dot"></div>
                    <div class="chat-typing-dot"></div>
                </div>
            </div>
        </div>
    `;

    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

/**
 * 移除正在输入指示器
 */
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

/**
 * 显示建议动作
 */
function showSuggestedActions(actions) {
    const actionsContainer = document.getElementById('chatSuggestedActions');

    if (!actionsContainer) {
        console.warn('chatSuggestedActions 元素不存在');
        return;
    }

    if (!actions || actions.length === 0) {
        actionsContainer.classList.add('hidden');
        return;
    }

    actionsContainer.classList.remove('hidden');
    actionsContainer.innerHTML = '';

    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = 'chat-suggested-action-btn';
        btn.textContent = action;
        btn.onclick = () => handleSuggestedAction(action);
        actionsContainer.appendChild(btn);
    });
}

/**
 * 处理建议动作点击
 */
function handleSuggestedAction(action) {
    document.getElementById('chatInput').value = action;
    sendChatMessageToOC();
}

// ============================================
// 消息发送和接收
// ============================================

/**
 * 发送聊天消息（供 HTML 调用）
 */
async function sendChatMessageToOC() {
    if (isWaitingForReply) {
        if (typeof showToast === 'undefined') {
            alert('OC 正在回复中，请稍候...');
        } else {
            showToast('OC 正在回复中，请稍候...');
        }
        return;
    }

    const input = document.getElementById('chatInput');
    const message = input.value.trim();

    if (!message) {
        if (typeof showToast !== 'undefined') {
            showToast('请输入消息');
        } else {
            alert('请输入消息');
        }
        return;
    }

    // 清空输入框
    input.value = '';

    // 添加用户消息到 UI
    addUserMessage(message);

    // 更新当前状态
    updateCurrentState();
    updatePromptState();

    // ✅ 检查是否是杂念（仅在专注状态）
    if (currentPromptState === 'start' && isDistraction(message)) {
        distractionList.push(message);
        console.log('📝 记录杂念:', message);
    }

    // 获取聊天历史
    const history = getChatHistoryArray();

    // ✅ 生成 System Prompt
    const systemPrompt = generateSystemPrompt();
    if (!systemPrompt) {
        addOCMessage('抱歉，我现在状态不太对...');
        return;
    }

    // 显示正在输入
    isWaitingForReply = true;
    showTypingIndicator();

    // 🔍 调试：显示发送的数据
    console.log('📤 发送聊天消息');
    console.log('  - 当前 Prompt 状态:', currentPromptState);
    console.log('  - 当前上下文:', currentChatContext);
    console.log('  - 杂念列表:', distractionList);

    try {
        // ✅ 调用 API（传递生成的 System Prompt）
        const result = await window.sendChatMessage(
            message,
            systemPrompt,  // 直接传递生成的 Prompt
            history
        );

        // 移除正在输入
        hideTypingIndicator();
        isWaitingForReply = false;

        if (result.success) {
            // 显示 OC 回复
            addOCMessage(result.data.reply);

            // 显示建议动作
            if (result.data.suggestedActions && result.data.suggestedActions.length > 0) {
                showSuggestedActions(result.data.suggestedActions);
            } else {
                // 隐藏建议动作
                const suggestedActionsEl = document.getElementById('chatSuggestedActions');
                if (suggestedActionsEl) {
                    suggestedActionsEl.classList.add('hidden');
                }
            }
        } else {
            // 显示错误
            addOCMessage('抱歉，我现在有点困惑...' + (result.error ? `(${result.error})` : ''));
        }

    } catch (error) {
        console.error('发送消息失败:', error);
        hideTypingIndicator();
        isWaitingForReply = false;
        addOCMessage('抱歉，网络出错了...');
    }
}

/**
 * 处理回车键发送
 */
function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessageToOC();
    }
}

// ============================================
// 聊天历史管理
// ============================================

/**
 * 保存消息到历史记录
 */
function saveToChatHistory(role, content) {
    const ocIndex = getCurrentOCIndex();

    if (!chatHistory[ocIndex]) {
        chatHistory[ocIndex] = [];
    }

    const message = {
        id: Date.now(),
        role: role,
        content: content,
        timestamp: Date.now()
    };

    chatHistory[ocIndex].push(message);

    // 限制历史记录数量（最多 50 条）
    if (chatHistory[ocIndex].length > 50) {
        chatHistory[ocIndex] = chatHistory[ocIndex].slice(-50);
    }

    // 保存到 localStorage
    localStorage.setItem(`chatHistory_${ocIndex}`, JSON.stringify(chatHistory[ocIndex]));
}

/**
 * 加载聊天历史
 */
function loadChatHistory() {
    const ocIndex = getCurrentOCIndex();
    const saved = localStorage.getItem(`chatHistory_${ocIndex}`);

    if (saved) {
        try {
            chatHistory[ocIndex] = JSON.parse(saved);

            // 显示历史消息
            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.innerHTML = '';

            if (chatHistory[ocIndex].length === 0) {
                showWelcomeMessage();
            } else {
                chatHistory[ocIndex].forEach(msg => {
                    if (msg.role === 'user') {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'chat-message user';
                        const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        messageDiv.innerHTML = `
                            <div class="chat-message-content">
                                <div class="chat-message-bubble">${escapeHtml(msg.content)}</div>
                                <div class="chat-message-time">${time}</div>
                            </div>
                        `;
                        messagesContainer.appendChild(messageDiv);
                    } else {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = 'chat-message assistant';
                        const time = new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                        messageDiv.innerHTML = `
                            <div class="chat-message-avatar">
                                <img src="${getOCAvatarUrl()}" alt="${currentChatContext.ocProfile.name}">
                            </div>
                            <div class="chat-message-content">
                                <div class="chat-message-bubble">${escapeHtml(msg.content)}</div>
                                <div class="chat-message-time">${time}</div>
                            </div>
                        `;
                        messagesContainer.appendChild(messageDiv);
                    }
                });
                scrollToBottom();
            }
        } catch (error) {
            console.error('加载聊天历史失败:', error);
            chatHistory[ocIndex] = [];
            showWelcomeMessage();
        }
    } else {
        chatHistory[ocIndex] = [];
        showWelcomeMessage();
    }
}

/**
 * 获取聊天历史数组
 */
function getChatHistoryArray() {
    const ocIndex = getCurrentOCIndex();
    const history = chatHistory[ocIndex] || [];

    // 只返回最近 10 条
    return history.slice(-10);
}

/**
 * 清空当前聊天记录
 * @param {number} ocIndex - OC索引（可选，默认使用当前OC）
 */
function clearChatHistory(ocIndex) {
    const index = ocIndex !== undefined ? ocIndex : getCurrentOCIndex();

    if (ocIndex === undefined) {
        // 如果是手动调用（没有传参数），需要确认
        if (!confirm('确定要清空聊天记录吗？')) {
            return;
        }
    }

    chatHistory[index] = [];
    localStorage.removeItem(`chatHistory_${index}`);

    // 如果是清空当前OC的历史，重新加载
    if (ocIndex === undefined || index === getCurrentOCIndex()) {
        loadChatHistory();
    }

    console.log(`✅ 已清空OC ${index} 的聊天历史`);
}

/**
 * 清空当前OC的聊天历史（聊天面板专用）
 * 用于专注页聊天面板的"清空记录"按钮
 */
function clearCurrentChatHistory() {
    const ocIndex = getCurrentOCIndex();

    if (!confirm('确定要清空聊天记录吗？')) {
        return;
    }

    // ✅ 立即清空UI显示
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
        messagesContainer.innerHTML = '';
    }

    chatHistory[ocIndex] = [];
    localStorage.removeItem(`chatHistory_${ocIndex}`);

    // 重新加载聊天历史（会显示欢迎消息）
    loadChatHistory();

    console.log(`✅ 已清空OC ${ocIndex} 的聊天历史`);
}

// ============================================
// 辅助函数
// ============================================

/**
 * 获取当前 OC 索引
 */
function getCurrentOCIndex() {
    // 使用全局变量 currentOCIndex
    return typeof currentOCIndex !== 'undefined' ? currentOCIndex : 0;
}

/**
 * 根据 OC 索引获取 OC 对象
 */
function getOCByIndex(index) {
    // 使用全局数组 ocData
    if (typeof ocData !== 'undefined' && ocData[index]) {
        return ocData[index];
    }
    return null;
}

/**
 * 获取 OC 头像 URL
 */
function getOCAvatarUrl() {
    const avatarImg = document.getElementById('focusOCAvatar');
    return avatarImg ? avatarImg.src : '';
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * 显示提示信息
 */
function showToast(message) {
    // 简单的提示实现
    const toast = document.createElement('div');
    toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-[200] text-sm';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2000);
}

/**
 * 获取当前 OC 对象
 */
function getCurrentOC() {
    const index = getCurrentOCIndex();
    const oc = getOCByIndex(index);
    return oc;
}

// ============================================
// 页面加载时初始化
// ============================================

window.addEventListener('DOMContentLoaded', function() {
    console.log('聊天模块加载完成');
    initChat();
});

// 如果使用了模块化系统
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        toggleChatPanel,
        sendChatMessage,
        updateChatContext,
        loadChatHistory,
        clearChatHistory,
        updatePromptState,
        setPromptStateToFinish,
        clearDistractionList,
        generateSystemPrompt
    };
}
