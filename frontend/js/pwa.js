(() => {
    'use strict';

    let deferredInstallPrompt = null;
    let toastTimer = null;
    let reminderRules = [];
    const DEVICE_ID_KEY = 'tamotoPushDeviceId';
    const DEVICE_SECRET_KEY = 'tamotoPushDeviceSecret';
    const FOCUS_AWAY_KEY = 'tamotoActiveFocusAwayKey';
    const TRACK_AWAY_AT_KEY = 'tamotoTrackAwayAt';

    function isStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function isIOS() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent);
    }

    function ensureToast() {
        let toast = document.getElementById('pwaToast');
        if (toast) return toast;
        toast = document.createElement('div');
        toast.id = 'pwaToast';
        toast.className = 'pwa-toast';
        toast.hidden = true;
        toast.setAttribute('role', 'status');
        toast.innerHTML = '<span class="pwa-toast__message"></span><button class="pwa-toast__action" type="button" hidden></button><button class="pwa-toast__close" type="button" aria-label="关闭">×</button>';
        toast.querySelector('.pwa-toast__close').addEventListener('click', () => { toast.hidden = true; });
        document.body.appendChild(toast);
        return toast;
    }

    function showToast(message, actionLabel, action, persistent = false) {
        const toast = ensureToast();
        const actionButton = toast.querySelector('.pwa-toast__action');
        toast.querySelector('.pwa-toast__message').textContent = message;
        actionButton.hidden = !actionLabel;
        actionButton.textContent = actionLabel || '';
        actionButton.onclick = action || null;
        toast.hidden = false;
        clearTimeout(toastTimer);
        if (!persistent) toastTimer = setTimeout(() => { toast.hidden = true; }, 5000);
    }

    async function installApp() {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        ensureToast().hidden = true;
    }

    function urlBase64ToUint8Array(value) {
        const padding = '='.repeat((4 - value.length % 4) % 4);
        const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        return Uint8Array.from([...raw].map(character => character.charCodeAt(0)));
    }

    function randomSecret() {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function getDeviceCredentials() {
        let deviceId = localStorage.getItem(DEVICE_ID_KEY);
        let deviceSecret = localStorage.getItem(DEVICE_SECRET_KEY);
        if (!deviceId) {
            deviceId = crypto.randomUUID();
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        if (!deviceSecret) {
            deviceSecret = randomSecret();
            localStorage.setItem(DEVICE_SECRET_KEY, deviceSecret);
        }
        return { deviceId, deviceSecret };
    }

    function focusIsRunning() {
        try {
            return typeof isTimerRunning !== 'undefined' && isTimerRunning &&
                (typeof isPaused === 'undefined' || !isPaused);
        } catch {
            return false;
        }
    }

    function registerFocusAway() {
        if (!focusIsRunning() || localStorage.getItem(FOCUS_AWAY_KEY)) return;
        const awayKey = crypto.randomUUID();
        localStorage.setItem(FOCUS_AWAY_KEY, awayKey);
        localStorage.setItem(TRACK_AWAY_AT_KEY, String(Date.now()));
        window.track?.('focus_away');
        const payload = JSON.stringify({ ...getDeviceCredentials(), awayKey });
        const url = (window.APP_BASE || '') + '/api/reminders?action=focus-away';
        const sent = navigator.sendBeacon?.(url, new Blob([payload], { type: 'application/json' }));
        if (!sent) {
            fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payload,
                keepalive: true
            }).catch(error => console.warn('记录离开状态失败:', error.message));
        }
    }

    async function registerFocusReturn() {
        const awayKey = localStorage.getItem(FOCUS_AWAY_KEY);
        if (!awayKey) return;
        const trackAwayAt = Number(localStorage.getItem(TRACK_AWAY_AT_KEY)) || Date.now();
        window.track?.('focus_return', { away_seconds: Math.max(0, Math.round((Date.now() - trackAwayAt) / 1000)) });
        localStorage.removeItem(TRACK_AWAY_AT_KEY);
        try {
            const response = await fetch((window.APP_BASE || '') + '/api/reminders?action=focus-return', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...getDeviceCredentials(), awayKey }),
                keepalive: true
            });
            localStorage.removeItem(FOCUS_AWAY_KEY);
            if (!response.ok) console.warn('返回状态未被服务端接受:', response.status);
        } catch (error) {
            console.warn('更新返回状态失败:', error.message);
        }
    }

    function currentOCName() {
        try {
            return (typeof ocData !== 'undefined' && ocData[currentOCIndex]?.name) || '小艾';
        } catch { return '小艾'; }
    }

    async function syncSubscription(subscription) {
        const credentials = getDeviceCredentials();
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
        const response = await fetch((window.APP_BASE || '') + '/api/reminders?action=subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...credentials,
                subscription: subscription.toJSON(),
                timezone,
                ocName: currentOCName()
            })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || '设备订阅保存失败');
        return credentials;
    }

    function repeatLabel(weekdays) {
        const key = [...weekdays].sort().join(',');
        if (key === '0,1,2,3,4,5,6') return '每天';
        if (key === '1,2,3,4,5') return '工作日';
        if (key === '0,6') return '周末';
        return '每天';
    }

    function repeatDays(label) {
        if (label === '工作日') return [1, 2, 3, 4, 5];
        if (label === '周末') return [0, 6];
        return [0, 1, 2, 3, 4, 5, 6];
    }

    function renderReminderRules() {
        const container = document.getElementById('reminderTimesList');
        if (!container) return;
        if (!reminderRules.length) {
            container.innerHTML = '<p class="text-xs text-slate-400 py-2">还没有提醒时间，点击右上角添加。</p>';
            return;
        }
        container.innerHTML = reminderRules.map((rule, index) => `
            <div class="flex items-center gap-2" data-reminder-index="${index}">
                <input type="time" value="${String(rule.time).slice(0, 5)}" onchange="updateReminderTime(${index}, this.value)" class="flex-1 min-w-0 px-3 py-2 rounded-lg border border-purple-100 bg-white text-sm">
                <select onchange="updateReminderRepeat(${index}, this.value)" class="px-2 py-2 rounded-lg border border-purple-100 bg-white text-sm">
                    ${['每天', '工作日', '周末'].map(label => `<option${repeatLabel(rule.weekdays) === label ? ' selected' : ''}>${label}</option>`).join('')}
                </select>
                <button type="button" onclick="removeReminderTime(${index})" class="px-2 py-2 text-red-400 text-sm" aria-label="删除提醒">删除</button>
            </div>
        `).join('');
    }

    async function loadReminderRules() {
        const settings = document.getElementById('reminderSettings');
        if (settings) settings.classList.remove('hidden');
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
        const timezoneElement = document.getElementById('reminderTimezone');
        if (timezoneElement) timezoneElement.textContent = `按本地时区发送：${timezone}`;
        const credentials = getDeviceCredentials();
        const query = new URLSearchParams(credentials);
        const response = await fetch((window.APP_BASE || '') + `/api/reminders?action=rules&${query}`);
        if (!response.ok) {
            reminderRules = [];
            renderReminderRules();
            return;
        }
        const result = await response.json();
        reminderRules = (result.rules || []).map(rule => ({
            time: String(rule.time_local).slice(0, 5),
            weekdays: rule.weekdays || [0, 1, 2, 3, 4, 5, 6],
            enabled: rule.enabled !== false,
            message: rule.message_template
        }));
        renderReminderRules();
    }

    window.addReminderTime = function addReminderTime() {
        if (reminderRules.length >= 10) return;
        const next = new Date(Date.now() + 5 * 60 * 1000);
        reminderRules.push({
            time: `${String(next.getHours()).padStart(2, '0')}:${String(next.getMinutes()).padStart(2, '0')}`,
            weekdays: [0, 1, 2, 3, 4, 5, 6], enabled: true
        });
        renderReminderRules();
    };

    window.removeReminderTime = function removeReminderTime(index) {
        reminderRules.splice(index, 1);
        renderReminderRules();
    };

    window.updateReminderTime = function updateReminderTime(index, value) {
        if (reminderRules[index]) reminderRules[index].time = value;
    };

    window.updateReminderRepeat = function updateReminderRepeat(index, value) {
        if (reminderRules[index]) reminderRules[index].weekdays = repeatDays(value);
    };

    window.saveOCReminders = async function saveOCReminders() {
        const button = document.getElementById('saveRemindersButton');
        const message = document.getElementById('reminderSaveMessage');
        if (button) button.disabled = true;
        if (message) message.textContent = '保存中…';
        try {
            const credentials = getDeviceCredentials();
            const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
            const response = await fetch((window.APP_BASE || '') + '/api/reminders?action=rules', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...credentials, rules: reminderRules.map(rule => ({ ...rule, timezone })) })
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(result.error || '保存失败');
            if (message) message.textContent = `已保存 ${result.count} 个提醒。`;
        } catch (error) {
            if (message) message.textContent = error.message;
        } finally {
            if (button) button.disabled = false;
        }
    };

    window.parseReminderText = async function parseReminderText(text, context = {}) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
        const response = await fetch((window.APP_BASE || '') + '/api/reminder-parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, timezone, ...context })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || '提醒解析失败');
        return result.data;
    };

    window.createOneOffReminder = async function createOneOffReminder(reminder) {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai';
        const response = await fetch((window.APP_BASE || '') + '/api/reminders?action=one-off', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...getDeviceCredentials(), ...reminder, timezone })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success) throw new Error(result.error || '提醒保存失败');
        return result.reminder;
    };

    let messageSyncPromise = null;
    async function syncOCMessages() {
        if (messageSyncPromise) return messageSyncPromise;
        messageSyncPromise = (async () => {
            const credentials = getDeviceCredentials();
            const query = new URLSearchParams(credentials);
            const response = await fetch((window.APP_BASE || '') + `/api/reminders?action=messages&${query}`);
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.success) throw new Error(result.error || 'OC 消息同步失败');
            const messages = result.messages || [];
            const receivedIds = typeof window.receiveOCMessages === 'function'
                ? window.receiveOCMessages(messages)
                : [];
            const unreadIds = messages.filter(item => !item.read_at).map(item => item.id);
            if (unreadIds.length && document.visibilityState === 'visible') {
                await fetch((window.APP_BASE || '') + '/api/reminders?action=messages-read', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...credentials, messageIds: unreadIds })
                });
            }
            return receivedIds;
        })().finally(() => { messageSyncPromise = null; });
        return messageSyncPromise;
    }

    window.syncOCMessages = syncOCMessages;

    function setPushUI(status, message, enabled) {
        const statusElement = document.getElementById('pushNotificationStatus');
        const messageElement = document.getElementById('pushNotificationMessage');
        const testButton = document.getElementById('testPushButton');
        const enableButton = document.getElementById('enablePushButton');
        if (statusElement) statusElement.textContent = status;
        if (messageElement && message) messageElement.textContent = message;
        if (testButton) testButton.disabled = !enabled;
        if (enableButton) enableButton.textContent = enabled ? '通知已开启' : '开启通知';
    }

    async function getPushRegistration() {
        if (!('serviceWorker' in navigator)) throw new Error('当前浏览器不支持 Service Worker');
        return navigator.serviceWorker.ready;
    }

    async function getOrCreatePushSubscription(registration) {
        let subscription = await registration.pushManager.getSubscription();
        if (subscription) return subscription;
        const response = await fetch((window.APP_BASE || '') + '/api/push');
        const config = await response.json();
        if (!response.ok || !config.configured || !config.publicKey) {
            throw new Error('PUSH_NOT_CONFIGURED');
        }
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.publicKey)
        });
        return subscription;
    }

    async function showLocalPlaceholderNotification(registration) {
        await registration.showNotification('小艾', {
            body: '【占位消息】该开始今天的专注啦，我在番茄钟里等你。',
            icon: (window.APP_BASE || '') + '/icons/icon-192.png',
            badge: (window.APP_BASE || '') + '/icons/icon-120.png',
            tag: 'oc-study-reminder',
            data: { url: (window.APP_BASE || '') + '/?page=focus&source=notification' }
        });
    }

    window.enableOCNotifications = async function enableOCNotifications() {
        try {
            if (!('Notification' in window)) throw new Error('当前浏览器不支持系统通知');
            if (isIOS() && !isStandalone()) throw new Error('请先将应用添加到 iPhone 主屏幕，再从主屏幕打开');
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') throw new Error('通知权限未开启，请在系统设置中允许通知');
            const registration = await getPushRegistration();
            try {
                const subscription = await getOrCreatePushSubscription(registration);
                await syncSubscription(subscription);
                setPushUI('已开启', 'Web Push 已连接，网页关闭后也可以接收后端通知。', true);
                await loadReminderRules();
            } catch (error) {
                if (error.message !== 'PUSH_NOT_CONFIGURED') throw error;
                setPushUI('已授权', '本机通知可用；部署端配置 VAPID 密钥后即可接收远程推送。', true);
            }
        } catch (error) {
            setPushUI('未开启', error.message || '通知开启失败', false);
        }
    };

    window.sendOCTestNotification = async function sendOCTestNotification() {
        const testButton = document.getElementById('testPushButton');
        if (testButton) testButton.disabled = true;
        try {
            if (Notification.permission !== 'granted') throw new Error('请先开启通知权限');
            const registration = await getPushRegistration();
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                try { subscription = await getOrCreatePushSubscription(registration); }
                catch (error) {
                    if (error.message !== 'PUSH_NOT_CONFIGURED') throw error;
                }
            }

            if (subscription) {
                try {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 7000);
                    const response = await fetch((window.APP_BASE || '') + '/api/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subscription: subscription.toJSON() }),
                        signal: controller.signal
                    });
                    clearTimeout(timeout);
                    if (!response.ok) throw new Error('REMOTE_PUSH_FAILED');
                } catch (error) {
                    await showLocalPlaceholderNotification(registration);
                    setPushUI('已开启', '远程推送网络不可达，已改用本机系统通知完成测试。', true);
                    return;
                }
            } else {
                await showLocalPlaceholderNotification(registration);
            }
            setPushUI('已开启', '测试通知已发送，请查看系统通知中心。', true);
        } catch (error) {
            setPushUI('发送失败', error.message || '测试通知发送失败', true);
        } finally {
            if (testButton) testButton.disabled = false;
        }
    };

    async function refreshPushUI() {
        if (!('Notification' in window)) {
            setPushUI('不支持', '当前浏览器不支持系统通知。', false);
            return;
        }
        if (Notification.permission === 'granted') {
            setPushUI('已开启', '通知权限已经开启，可以发送测试通知。', true);
            try {
                const registration = await getPushRegistration();
                const subscription = await registration.pushManager.getSubscription();
                if (subscription) {
                    await syncSubscription(subscription);
                    await loadReminderRules();
                }
            } catch (error) {
                console.warn('提醒订阅同步失败:', error.message);
            }
        } else if (Notification.permission === 'denied') {
            setPushUI('已阻止', '请在浏览器或系统设置中重新允许通知。', false);
        }
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        if (!isStandalone() && !sessionStorage.getItem('pwa-install-dismissed')) {
            showToast('安装到桌面，获得无地址栏的沉浸式番茄钟。', '安装', installApp, true);
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        showToast('伴柠番茄钟已安装。');
    });

    window.addEventListener('offline', () => showToast('当前离线，本地计时和已保存数据仍可使用。', null, null, true));
    window.addEventListener('online', () => showToast('网络已恢复。'));
    window.addEventListener('focus', () => syncOCMessages().catch(error => console.warn(error.message)));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            registerFocusReturn();
            syncOCMessages().catch(error => console.warn(error.message));
        } else {
            registerFocusAway();
        }
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'OC_PUSH_MESSAGE') {
                syncOCMessages().catch(error => console.warn(error.message));
            }
        });
    }

    window.addEventListener('load', async () => {
        refreshPushUI();
        registerFocusReturn();
        syncOCMessages().catch(error => console.warn(error.message));
        if (isIOS() && !isStandalone() && !localStorage.getItem('pwa-ios-hint-seen')) {
            showToast('在 Safari 点“分享”，再选“添加到主屏幕”，即可沉浸式使用。', '知道了', () => {
                localStorage.setItem('pwa-ios-hint-seen', '1');
                ensureToast().hidden = true;
            }, true);
        }

        if (!('serviceWorker' in navigator)) return;
        try {
            const registration = await navigator.serviceWorker.register((window.APP_BASE || '') + '/sw.js', { scope: (window.APP_BASE || '') + '/' });
            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                if (!worker) return;
                worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        showToast('新版本已经准备好。', '刷新', () => window.location.reload(), true);
                    }
                });
            });
        } catch (error) {
            console.warn('PWA Service Worker 注册失败:', error);
        }
    });
})();
