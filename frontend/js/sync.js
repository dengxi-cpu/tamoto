/**
 * SyncManager - 云端同步管理器
 *
 * 架构：Local-First，所有数据先写 localStorage，再后台同步到 Supabase
 * 使用方式： window.syncManager = new SyncManager(); syncManager.init();
 */
class SyncManager {
  static STORAGE_KEY = 'cloudSync';
  static DEBOUNCE_MS = 2000;
  static RETRY_INTERVAL = 30000;

  constructor() {
    this.enabled = false;
    this.userId = null;
    this.identityHash = null;
    this.lastSyncAt = null;
    this._pending = {};       // { type: data }
    this._timer = null;
    this._syncing = false;
    this._retryCount = 0;
    this.status = 'offline';  // offline | synced | syncing | error | not_configured
    this._listeners = [];
    this._apiBase = '';
  }

  // ===================================
  //  初始化与生命周期
  // ===================================

  /** 初始化：恢复状态、绑定事件、触发首次同步 */
  async init() {
    this._loadState();
    this._bindEvents();

    if (this.enabled && this.identityHash) {
      this.status = 'offline';
      this._notify();
      // 启动时拉取一次
      await this.pull();
    } else {
      this.status = 'not_configured';
      this._notify();
    }
  }

  /** 获取设备 ID（localStorage 中持久化） */
  _getDeviceId() {
    let id = localStorage.getItem('deviceId');
    if (!id) {
      id = 'device_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('deviceId', id);
    }
    return id;
  }

  /** 从 localStorage 恢复同步状态 */
  _loadState() {
    try {
      const raw = localStorage.getItem(SyncManager.STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        this.enabled = data.enabled || false;
        this.userId = data.userId || null;
        this.identityHash = data.identityHash || null;
        this.lastSyncAt = data.lastSyncAt || null;
      }
    } catch (e) {
      console.warn('SyncManager: 恢复状态失败', e);
    }
  }

  /** 持久化同步状态到 localStorage */
  _saveState() {
    try {
      localStorage.setItem(SyncManager.STORAGE_KEY, JSON.stringify({
        enabled: this.enabled,
        userId: this.userId,
        identityHash: this.identityHash,
        lastSyncAt: this.lastSyncAt
      }));
    } catch (e) {
      console.warn('SyncManager: 保存状态失败', e);
    }
  }

  /** 绑定网络状态和可见性事件 */
  _bindEvents() {
    window.addEventListener('online', () => {
      console.log('SyncManager: 网络恢复');
      if (this.enabled) this._flush();
    });

    window.addEventListener('offline', () => {
      console.log('SyncManager: 网络断开');
      this.status = 'offline';
      this._notify();
    });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.enabled) {
        this.pull();
      }
    });
  }

  // ===================================
  //  状态变更通知
  // ===================================

  onStatusChange(cb) {
    this._listeners.push(cb);
  }

  _notify() {
    this._listeners.forEach(cb => cb(this.status));
  }

  // ===================================
  //  同步码管理
  // ===================================

  /** 生成 identityHash */
  async _hashSyncCode(code) {
    const deviceId = this._getDeviceId();
    const encoder = new TextEncoder();
    const data = encoder.encode(deviceId + '::' + code);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /** 设置同步码：启用云同步 */
  async setSyncCode(code) {
    if (!code || code.length < 2) {
      throw new Error('同步码至少 2 个字符');
    }

    this.status = 'syncing';
    this._notify();

    try {
      const identityHash = await this._hashSyncCode(code);

      const resp = await fetch(this._apiBase + '/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', identityHash })
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || '注册失败');
      }

      const data = await resp.json();
      this.enabled = true;
      this.userId = data.userId;
      this.identityHash = identityHash;
      this.lastSyncAt = null;
      this._saveState();

      if (data.isNew) {
        // 首台设备：推本地数据到云端
        await this._pushAll();
      } else {
        // 已有数据：从云端拉取到本地
        this.lastSyncAt = null;
        await this.pull();
        location.reload();
      }
      this.status = 'synced';
      this._notify();
      return data;
    } catch (e) {
      this.status = 'error';
      this._notify();
      throw e;
    }
  }

  /** 解除同步：停止云同步，不清除云端数据 */
  disableSync() {
    this.enabled = false;
    this.userId = null;
    this.identityHash = null;
    this.lastSyncAt = null;
    this._pending = {};
    this._saveState();
    this.status = 'not_configured';
    this._notify();
  }

  /** 是否已启用同步 */
  isSyncingEnabled() {
    return this.enabled;
  }

  /** 获取当前状态 */
  getSyncInfo() {
    return {
      enabled: this.enabled,
      userId: this.userId,
      lastSyncAt: this.lastSyncAt,
      status: this.status
    };
  }

  // ===================================
  //  数据推送
  // ===================================

  /** 加入同步队列（去抖） */
  enqueue(type, data) {
    if (!this.enabled) return;
    this._pending[type] = data;

    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._flush(), SyncManager.DEBOUNCE_MS);
  }

  /** 立即推送队列 */
  async _flush() {
    if (this._syncing || !this.enabled || Object.keys(this._pending).length === 0) return;
    this._syncing = true;
    this.status = 'syncing';
    this._notify();

    try {
      await this._pushChanges(this._pending);
      this._pending = {};
      this._retryCount = 0;
      this.status = 'synced';
    } catch (e) {
      console.warn('SyncManager: 推送失败', e);
      this._retryCount++;
      if (this._retryCount < 5) {
        setTimeout(() => this._flush(), SyncManager.RETRY_INTERVAL);
      }
      this.status = navigator.onLine ? 'error' : 'offline';
    }

    this._syncing = false;
    this._notify();
  }

  /** 全量推送所有数据 */
  async _pushAll() {
    const data = this._collectAllData();
    await this._pushChanges(data);
  }

  /** 收集所有本地数据 */
  _collectAllData() {
    const data = {};
    try {
      const ocRaw = localStorage.getItem('ocData');
      if (ocRaw) {
        const ocData = JSON.parse(ocRaw);
        // 把 idxdb 引用转回 dataURL（从 ocData 内存中拿）
        data.ocData = ocData;
      }

      const tasksRaw = localStorage.getItem('tasks');
      if (tasksRaw) data.tasks = JSON.parse(tasksRaw);

      const statsRaw = localStorage.getItem('detailedStats');
      const dailyRaw = localStorage.getItem('dailyStats');
      if (statsRaw || dailyRaw) {
        data.stats = {
          detailedStats: statsRaw ? JSON.parse(statsRaw) : null,
          dailyStats: dailyRaw ? JSON.parse(dailyRaw) : null
        };
      }

      const chatRaw = localStorage.getItem('chatHistory');
      const chatByOC = {};
      // 收集每个 OC 的聊天历史
      if (ocRaw) {
        const ocData = JSON.parse(ocRaw);
        ocData.forEach((oc, index) => {
          const key = 'chatHistory_' + index;
          const ch = localStorage.getItem(key);
          if (ch) chatByOC[key] = JSON.parse(ch);
        });
      }
      data.chatHistory = chatByOC;

      data.preferences = {
        currentOCIndex: localStorage.getItem('currentOCIndex') || '0',
        statusGifts: localStorage.getItem('statusGifts') || '[]',
        customStatuses: localStorage.getItem('customStatuses') || '[]',
        customStatusIcons: localStorage.getItem('customStatusIcons') || '{}'
      };
    } catch (e) {
      console.warn('SyncManager: 收集数据失败', e);
    }
    return data;
  }

  /** 实际推送 HTTP 请求 */
  async _pushChanges(data) {
    if (!this.identityHash) throw new Error('未设置同步码');

    const resp = await fetch(this._apiBase + '/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + this.identityHash
      },
      body: JSON.stringify(data)
    });

    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error || '同步失败');
    }

    const result = await resp.json();
    this.lastSyncAt = result.serverTime;
    this._saveState();
    return result;
  }

  // ===================================
  //  数据拉取
  // ===================================

  /** 从云端拉取增量数据 */
  async pull() {
    if (!this.enabled || !this.identityHash) return;

    try {
      this.status = 'syncing';
      this._notify();

      const params = new URLSearchParams();
      if (this.lastSyncAt) params.set('since', this.lastSyncAt);
      else params.set('bootstrap', 'true');

      const resp = await fetch(this._apiBase + '/api/sync?' + params.toString(), {
        headers: {
          'Authorization': 'Bearer ' + this.identityHash
        }
      });

      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || '拉取失败');
      }

      const result = await resp.json();
      if (result.changes && Object.keys(result.changes).length > 0) {
        this._mergeData(result.changes);
      }

      this.lastSyncAt = result.serverTime;
      this._saveState();
      this.status = 'synced';
    } catch (e) {
      console.warn('SyncManager: 拉取失败', e);
      this.status = navigator.onLine ? 'error' : 'offline';
    }

    this._notify();
  }

  /** 合并远程数据到本地 */
  _mergeData(changes) {
    try {
      if (changes.ocData) {
        // 用内存中的 ocData，保留 dataURL
        const localOC = localStorage.getItem('ocData');
        if (localOC) {
          const localParsed = JSON.parse(localOC);
          // 保留本地的 idxdb 引用，只更新其他字段
          const merged = changes.ocData.map((remoteOC, i) => {
            const localOC = localParsed[i] || {};
            return { ...remoteOC, avatar: localOC.avatar || remoteOC.avatar };
          });
          localStorage.setItem('ocData', JSON.stringify(merged));
        } else {
          localStorage.setItem('ocData', JSON.stringify(changes.ocData));
        }
      }

      if (changes.tasks) {
        localStorage.setItem('tasks', JSON.stringify(changes.tasks));
      }

      if (changes.stats) {
        if (changes.stats.detailedStats) {
          localStorage.setItem('detailedStats', JSON.stringify(changes.stats.detailedStats));
        }
        if (changes.stats.dailyStats) {
          localStorage.setItem('dailyStats', JSON.stringify(changes.stats.dailyStats));
        }
      }

      if (changes.chatHistory) {
        Object.keys(changes.chatHistory).forEach(key => {
          localStorage.setItem(key, JSON.stringify(changes.chatHistory[key]));
        });
      }

      if (changes.preferences) {
        if (changes.preferences.currentOCIndex !== undefined) {
          localStorage.setItem('currentOCIndex', String(changes.preferences.currentOCIndex));
        }
        if (changes.preferences.statusGifts) {
          localStorage.setItem('statusGifts', changes.preferences.statusGifts);
        }
        if (changes.preferences.customStatuses) {
          localStorage.setItem('customStatuses', changes.preferences.customStatuses);
        }
      }

      console.log('SyncManager: 已合并远程数据');
    } catch (e) {
      console.warn('SyncManager: 合并数据失败', e);
    }
  }
}

// 全局实例
window.syncManager = new SyncManager();
