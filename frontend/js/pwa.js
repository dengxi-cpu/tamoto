(() => {
    'use strict';

    let deferredInstallPrompt = null;
    let toastTimer = null;

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
        const response = await fetch('/api/push');
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
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-120.png',
            tag: 'oc-study-reminder',
            data: { url: '/?page=focus&source=notification' }
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
                await getOrCreatePushSubscription(registration);
                setPushUI('已开启', 'Web Push 已连接，网页关闭后也可以接收后端通知。', true);
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
                    const response = await fetch('/api/push', {
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

    window.addEventListener('load', async () => {
        refreshPushUI();
        if (isIOS() && !isStandalone() && !localStorage.getItem('pwa-ios-hint-seen')) {
            showToast('在 Safari 点“分享”，再选“添加到主屏幕”，即可沉浸式使用。', '知道了', () => {
                localStorage.setItem('pwa-ios-hint-seen', '1');
                ensureToast().hidden = true;
            }, true);
        }

        if (!('serviceWorker' in navigator)) return;
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
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
