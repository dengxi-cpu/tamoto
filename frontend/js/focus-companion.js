(function () {
    'use strict';

    const state = {
        stream: null,
        sessionActive: false,
        requestInFlight: false
    };

    function elements() {
        return {
            button: document.getElementById('cameraBtn'),
            preview: document.getElementById('userCameraPreview'),
            video: document.getElementById('userCameraVideo')
        };
    }

    function notify(message) {
        const toast = document.getElementById('bnToast');
        if (toast) {
            toast.textContent = message;
            toast.classList.add('is-show');
            window.setTimeout(() => toast.classList.remove('is-show'), 2600);
            return;
        }
        console.info(message);
    }

    function setButtonState(enabled) {
        const { button } = elements();
        if (!button) return;
        button.classList.toggle('camera-active', enabled);
        button.setAttribute('aria-pressed', String(enabled));
        button.setAttribute('aria-label', enabled ? '关闭视频' : '开启视频');
        button.title = enabled ? '关闭视频' : '开启视频';
    }

    function stopCamera() {
        const { preview, video } = elements();
        if (state.stream) {
            state.stream.getTracks().forEach(track => track.stop());
            state.stream = null;
        }
        if (video) video.srcObject = null;
        if (preview) preview.hidden = true;
        setButtonState(false);
    }

    async function startCamera() {
        if (!state.sessionActive || state.requestInFlight || state.stream) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            notify('当前浏览器不支持摄像头');
            return;
        }

        state.requestInFlight = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 640 },
                    height: { ideal: 480 }
                },
                audio: false
            });

            if (!state.sessionActive) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }

            const { preview, video } = elements();
            state.stream = stream;
            if (video) {
                video.srcObject = stream;
                await video.play().catch(() => {});
            }
            if (preview) preview.hidden = false;
            setButtonState(true);

            stream.getVideoTracks().forEach(track => {
                track.addEventListener('ended', () => {
                    if (state.stream === stream) stopCamera();
                }, { once: true });
            });
        } catch (error) {
            const denied = error && (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError');
            notify(denied ? '未获得摄像头权限' : '摄像头开启失败，请检查设备');
            console.warn('Camera start failed:', error);
            stopCamera();
        } finally {
            state.requestInFlight = false;
        }
    }

    async function toggleCamera() {
        if (!state.sessionActive) return;
        if (state.stream) {
            stopCamera();
            return;
        }
        await startCamera();
    }

    function startSession() {
        state.sessionActive = true;
        stopCamera();
    }

    function stopSession() {
        state.sessionActive = false;
        stopCamera();
    }

    window.focusCompanion = {
        startSession,
        stopSession,
        startCamera,
        stopCamera,
        toggleCamera,
        isCameraEnabled: () => Boolean(state.stream)
    };

    window.toggleFocusCamera = toggleCamera;
    window.addEventListener('pagehide', stopSession);
})();
