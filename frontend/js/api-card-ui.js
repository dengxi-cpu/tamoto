// frontend/js/api-card-ui.js
// API配置卡片UI组件

/**
 * API配置卡片类
 * 负责单个配置卡片的渲染和交互
 */
class APIProfileCard {
    constructor(profileData) {
        this.profile = profileData;
        this.element = null;
        this.isEditing = false;
    }

    /**
     * 渲染卡片HTML
     */
    render() {
        const card = document.createElement('div');
        card.className = `api-profile-card ${this.profile.isActive ? 'active' : ''} ${this.profile.isExpanded ? 'expanded' : 'collapsed'}`;
        card.id = `api-card-${this.profile.id}`;
        card.dataset.profileId = this.profile.id;

        if (this.profile.isExpanded) {
            card.innerHTML = this.renderExpandedContent();
        } else {
            card.innerHTML = this.renderCollapsedContent();
        }

        this.element = card;
        return card;
    }

    /**
     * 渲染收起状态的内容
     */
    renderCollapsedContent() {
        return `
            <div class="api-card-collapsed">
                <div class="api-card-header">
                    <div class="api-card-info" onclick="toggleAPIProfileCard('${this.profile.id}')">
                        <span class="api-card-name">${this.escapeHtml(this.profile.name)}</span>
                    </div>
                    <div class="api-card-actions">
                        <button class="api-delete-btn" onclick="event.stopPropagation(); deleteAPIProfileConfirm('${this.profile.id}')" title="删除配置">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2">
                                <path d="M9 9l6 6m0-6l-6 6"/>
                            </svg>
                        </button>
                        <button class="api-select-btn ${this.profile.isActive ? 'active' : ''}"
                                onclick="event.stopPropagation(); setActiveAPIProfile('${this.profile.id}')"
                                title="选择此配置">
                            ${this.profile.isActive
                                ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                    <polyline points="20 6 9 17 4 12"/>
                                   </svg>`
                                : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                   </svg>`
                            }
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * 渲染展开状态的内容
     */
    renderExpandedContent() {
        return `
            <div class="api-card-expanded">
                <div class="api-card-header">
                    <input type="text"
                           class="api-card-name-input"
                           value="${this.escapeHtml(this.profile.name)}"
                           placeholder="配置名称"
                           onchange="updateAPIProfileName('${this.profile.id}', this.value)"
                    />
                    <div class="api-card-actions">
                        <button class="api-action-btn api-collapse-btn" onclick="event.stopPropagation(); toggleAPIProfileCard('${this.profile.id}')" title="收起">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M18 15l-6-6-6 6"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="api-card-body" onclick="event.stopPropagation()">
                    <div class="api-form-group">
                        <label class="api-form-label">AI服务</label>
                        <div class="api-form-input-group">
                            <select class="api-form-select" onchange="updateAPIProfileService('${this.profile.id}', this.value)">
                                <option value="openai" ${this.profile.aiService === 'openai' ? 'selected' : ''}>OpenAI</option>
                                <option value="deepseek" ${this.profile.aiService === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                                <option value="doubao" ${this.profile.aiService === 'doubao' ? 'selected' : ''}>豆包</option>
                                <option value="gemini" ${this.profile.aiService === 'gemini' ? 'selected' : ''}>Gemini</option>
                            </select>
                        </div>
                    </div>

                    <div class="api-form-group">
                        <label class="api-form-label">模型</label>
                        <div class="api-form-input-group">
                            <select class="api-form-select" id="model-select-${this.profile.id}" onchange="updateAPIProfileModel('${this.profile.id}', this.value)">
                                ${this.renderModelOptions()}
                            </select>
                        </div>
                    </div>

                    <div class="api-form-group">
                        <label class="api-form-label">API地址</label>
                        <input type="text"
                               class="api-form-input"
                               value="${this.escapeHtml(this.profile.apiUrl || '')}"
                               placeholder="留空则使用默认地址"
                               onchange="updateAPIProfileUrl('${this.profile.id}', this.value)"
                        />
                    </div>

                    <div class="api-form-group">
                        <label class="api-form-label">API密钥</label>
                        <div class="api-form-input-group">
                            <input type="password"
                                   class="api-form-input api-key-input"
                                   id="api-key-${this.profile.id}"
                                   value="${this.escapeHtml(this.profile.apiKey)}"
                                   placeholder="请输入API密钥"
                                   onchange="updateAPIProfileKey('${this.profile.id}', this.value)"
                            />
                            <button class="api-toggle-visibility-btn" onclick="event.stopPropagation(); toggleAPIKeyVisibility('${this.profile.id}')" title="显示/隐藏密钥">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="api-card-footer" onclick="event.stopPropagation()">
                    ${this.profile.isActive
                        ? `<button class="api-btn api-btn-success" disabled>当前配置</button>`
                        : `<button class="api-btn api-btn-primary" onclick="setActiveAPIProfile('${this.profile.id}')">设为当前</button>`
                    }
                    <button class="api-btn api-btn-danger" onclick="deleteAPIProfileConfirm('${this.profile.id}')">删除</button>
                </div>
            </div>
        `;
    }

    /**
     * 渲染模型选项
     */
    renderModelOptions() {
        const getModels = window.getModelsByService || getModelsByService;
        const models = getModels(this.profile.aiService);
        return models.map(model =>
            `<option value="${model}" ${this.profile.apiModel === model ? 'selected' : ''}>${model}</option>`
        ).join('');
    }

    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 刷新卡片显示
     */
    refresh() {
        if (this.element) {
            const newElement = this.render();
            this.element.replaceWith(newElement);
            this.element = newElement;
        }
    }
}

// ============================================
// 全局变量和初始化
// ============================================

let apiProfileCards = [];

/**
 * 初始化API配置卡片系统
 */
function initAPIProfileCards() {
    // 使用window对象访问函数
    const initProfiles = window.initAPIProfiles || initAPIProfiles;
    const getProfiles = window.getAPIProfiles || getAPIProfiles;

    // 初始化配置数据
    initProfiles();

    // 加载配置并创建卡片
    const profiles = getProfiles();
    apiProfileCards = profiles.map(profile => new APIProfileCard(profile));

    // 渲染所有卡片
    renderAPIProfileCards();
}

/**
 * 渲染所有API配置卡片
 */
function renderAPIProfileCards() {
    const container = document.getElementById('apiProfilesContainer');
    if (!container) {
        console.warn('未找到 apiProfilesContainer 容器');
        return;
    }

    container.innerHTML = '';
    apiProfileCards.forEach(card => {
        container.appendChild(card.render());
    });
}

/**
 * 切换卡片展开/收起状态（改为打开弹窗）
 */
function toggleAPIProfileCard(profileId) {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;

    if (typeof getProfiles !== 'function') {
        console.error('getAPIProfiles 函数不存在');
        alert('系统错误：API函数未加载，请刷新页面');
        return;
    }

    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
        openAPIConfigModal(profile);
    }
}

/**
 * 打开API配置弹窗
 */
function openAPIConfigModal(profile) {
    const modal = document.getElementById('apiConfigModal');
    const modalTitle = document.getElementById('apiConfigModalTitle');
    const modalBody = document.getElementById('apiConfigModalBody');

    // 设置标题
    modalTitle.textContent = `编辑 ${profile.name}`;

    // 生成表单内容
    const card = new APIProfileCard(profile);
    modalBody.innerHTML = `
        <div class="api-card-expanded">
            <div class="api-card-body">
                <div class="api-form-group">
                    <label class="api-form-label">配置名称</label>
                    <input type="text"
                           class="api-form-input"
                           value="${card.escapeHtml(profile.name)}"
                           placeholder="配置名称"
                           onchange="updateAPIProfileName('${profile.id}', this.value); document.getElementById('apiConfigModalTitle').textContent = '编辑 ' + this.value;"
                    />
                </div>

                <div class="api-form-group">
                    <label class="api-form-label">AI服务</label>
                    <div class="api-form-input-group">
                        <select class="api-form-select" onchange="updateAPIProfileService('${profile.id}', this.value); openAPIConfigModal(window.getAPIProfiles().find(p => p.id === '${profile.id}'));">
                            <option value="openai" ${profile.aiService === 'openai' ? 'selected' : ''}>OpenAI</option>
                            <option value="deepseek" ${profile.aiService === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
                            <option value="doubao" ${profile.aiService === 'doubao' ? 'selected' : ''}>豆包</option>
                            <option value="gemini" ${profile.aiService === 'gemini' ? 'selected' : ''}>Gemini</option>
                        </select>
                    </div>
                </div>

                <div class="api-form-group">
                    <label class="api-form-label">模型</label>
                    <div class="api-form-input-group">
                        <select class="api-form-select" onchange="updateAPIProfileModel('${profile.id}', this.value)">
                            ${card.renderModelOptions()}
                        </select>
                    </div>
                </div>

                <div class="api-form-group">
                    <label class="api-form-label">API地址</label>
                    <input type="text"
                           class="api-form-input"
                           value="${card.escapeHtml(profile.apiUrl || '')}"
                           placeholder="留空则使用默认地址"
                           onchange="updateAPIProfileUrl('${profile.id}', this.value)"
                    />
                </div>

                <div class="api-form-group">
                    <label class="api-form-label">API密钥</label>
                    <div class="api-form-input-group">
                        <input type="password"
                               class="api-form-input api-key-input"
                               id="modal-api-key-${profile.id}"
                               value="${card.escapeHtml(profile.apiKey)}"
                               placeholder="请输入API密钥"
                               onchange="updateAPIProfileKey('${profile.id}', this.value)"
                        />
                        <button class="api-toggle-visibility-btn" onclick="toggleAPIKeyVisibilityInModal('${profile.id}')" title="显示/隐藏密钥">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div class="api-card-footer">
                ${profile.isActive
                    ? `<button class="api-btn api-btn-success" disabled>当前配置</button>`
                    : `<button class="api-btn api-btn-primary" onclick="setActiveAPIProfile('${profile.id}'); setTimeout(() => closeAPIConfigModal(), 300);">设为当前</button>`
                }
                <button class="api-btn api-btn-danger" onclick="deleteAPIProfileConfirm('${profile.id}')">删除</button>
                <button class="api-btn api-btn-secondary" onclick="closeAPIConfigModal()">关闭</button>
            </div>
        </div>
    `;

    // 显示弹窗
    modal.classList.add('show');
}

/**
 * 关闭API配置弹窗
 */
function closeAPIConfigModal() {
    const modal = document.getElementById('apiConfigModal');
    modal.classList.remove('show');
}

/**
 * 在弹窗中切换API密钥显示/隐藏
 */
function toggleAPIKeyVisibilityInModal(profileId) {
    const input = document.getElementById(`modal-api-key-${profileId}`);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

/**
 * 更新配置名称
 */
function updateAPIProfileName(profileId, name) {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;
    const saveProfiles = window.saveAPIProfiles || saveAPIProfiles;

    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
        profile.name = name.trim() || '未命名配置';
        saveProfiles(profiles);

        // 重新渲染所有卡片以更新显示
        const updatedProfiles = getProfiles();
        apiProfileCards = updatedProfiles.map(p => new APIProfileCard(p));
        renderAPIProfileCards();
    }
}

/**
 * 更新AI服务
 */
function updateAPIProfileService(profileId, service) {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;
    const saveProfiles = window.saveAPIProfiles || saveAPIProfiles;
    const getModels = window.getModelsByService || getModelsByService;
    const getUrl = window.getDefaultUrlByService || getDefaultUrlByService;

    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
        profile.aiService = service;
        // 更新默认模型
        const models = getModels(service);
        if (models.length > 0) {
            profile.apiModel = models[0];
        }
        // 更新默认URL
        profile.apiUrl = getUrl(service);

        saveProfiles(profiles);

        // 重新渲染所有卡片
        const updatedProfiles = getProfiles();
        apiProfileCards = updatedProfiles.map(p => new APIProfileCard(p));
        renderAPIProfileCards();
    }
}

/**
 * 更新模型
 */
function updateAPIProfileModel(profileId, model) {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;
    const saveProfiles = window.saveAPIProfiles || saveAPIProfiles;

    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
        profile.apiModel = model;
        saveProfiles(profiles);

        // 重新渲染所有卡片
        const updatedProfiles = getProfiles();
        apiProfileCards = updatedProfiles.map(p => new APIProfileCard(p));
        renderAPIProfileCards();
    }
}

/**
 * 更新API URL
 */
function updateAPIProfileUrl(profileId, url) {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;
    const saveProfiles = window.saveAPIProfiles || saveAPIProfiles;

    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
        profile.apiUrl = url.trim();
        saveProfiles(profiles);

        // 重新渲染所有卡片
        const updatedProfiles = getProfiles();
        apiProfileCards = updatedProfiles.map(p => new APIProfileCard(p));
        renderAPIProfileCards();
    }
}

/**
 * 更新API密钥
 */
function updateAPIProfileKey(profileId, key) {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;
    const saveProfiles = window.saveAPIProfiles || saveAPIProfiles;

    const profiles = getProfiles();
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
        profile.apiKey = key.trim();
        saveProfiles(profiles);

        // 重新渲染所有卡片
        const updatedProfiles = getProfiles();
        apiProfileCards = updatedProfiles.map(p => new APIProfileCard(p));
        renderAPIProfileCards();

        // 显示保存成功提示
        showAPISaveToast('密钥已保存');
    }
}

/**
 * 切换API密钥显示/隐藏
 */
function toggleAPIKeyVisibility(profileId) {
    const input = document.getElementById(`api-key-${profileId}`);
    if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
    }
}

/**
 * 设为当前配置
 */
function setActiveAPIProfile(profileId) {
    const setActiveId = window.setActiveAPIProfileId || setActiveAPIProfileId;
    const getProfiles = window.getAPIProfiles || getAPIProfiles;

    setActiveId(profileId);

    // 重新渲染所有卡片以更新激活状态
    const profiles = getProfiles();
    apiProfileCards = profiles.map(profile => new APIProfileCard(profile));
    renderAPIProfileCards();

    showAPISaveToast('已切换配置');
}

/**
 * 删除配置确认
 */
function deleteAPIProfileConfirm(profileId) {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;
    const delProfile = window.deleteAPIProfile || deleteAPIProfile;

    const profiles = getProfiles();

    if (profiles.length === 1) {
        alert('⚠️ 至少需要保留一个API配置！');
        return;
    }

    const profile = profiles.find(p => p.id === profileId);
    const confirmMsg = `确定要删除配置 "${profile.name}" 吗？\n\n此操作不可撤销。`;

    if (confirm(confirmMsg)) {
        delProfile(profileId);

        // 重新加载并渲染
        const updatedProfiles = getProfiles();
        apiProfileCards = updatedProfiles.map(p => new APIProfileCard(p));
        renderAPIProfileCards();

        showAPISaveToast('配置已删除');
    }
}

/**
 * 添加新配置
 */
function addNewAPIProfile() {
    const getProfiles = window.getAPIProfiles || getAPIProfiles;
    const saveProfiles = window.saveAPIProfiles || saveAPIProfiles;
    const genId = window.generateProfileId || generateProfileId;

    const profiles = getProfiles();

    // 创建新配置
    const newProfile = {
        id: genId(),
        name: `新配置 ${profiles.length + 1}`,
        aiService: 'openai',
        apiModel: 'gpt-3.5-turbo',
        apiUrl: '',
        apiKey: '',
        isActive: false,
        isExpanded: true, // 自动展开
        createdAt: Date.now()
    };

    profiles.push(newProfile);
    saveProfiles(profiles);

    // 添加新卡片
    const newCard = new APIProfileCard(newProfile);
    apiProfileCards.push(newCard);

    // 渲染
    renderAPIProfileCards();

    // 滚动到新卡片
    setTimeout(() => {
        const cardElement = document.getElementById(`api-card-${newProfile.id}`);
        if (cardElement) {
            cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
}

/**
 * 显示保存成功提示
 */
function showAPISaveToast(message) {
    // 移除旧的toast
    const oldToast = document.querySelector('.api-save-toast');
    if (oldToast) {
        oldToast.remove();
    }

    // 创建新toast
    const toast = document.createElement('div');
    toast.className = 'api-save-toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// 页面加载时自动初始化
if (typeof document !== 'undefined') {
    // 等待api.js完全加载
    function waitForAPIFunctions(callback, maxAttempts = 10) {
        let attempts = 0;

        function check() {
            attempts++;
            const hasFunctions = typeof window.getAPIProfiles === 'function' &&
                               typeof window.saveAPIProfiles === 'function' &&
                               typeof window.initAPIProfiles === 'function';

            if (hasFunctions) {
                callback();
            } else if (attempts < maxAttempts) {
                setTimeout(check, 100);
            } else {
                // 尝试直接调用
                callback();
            }
        }

        check();
    }

    function initWhenReady() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                waitForAPIFunctions(initAPIProfileCards);
            });
        } else {
            waitForAPIFunctions(initAPIProfileCards);
        }
    }

    initWhenReady();
}
