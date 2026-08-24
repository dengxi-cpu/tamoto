(function () {
    'use strict';

    const state = {
        stream: null,
        sessionActive: false,
        requestInFlight: false,
        visionTimer: null,
        visionInFlight: false,
        visionUnavailable: false,
        audioStream: null,
        mediaRecorder: null,
        audioChunks: [],
        voiceHeld: false
    };

    const VISION_INTERVAL_MS = 30000;
    const reactions = {
        STUDYING: '嗯，这样才对。',
        PHONE: '手机有这么好看？',
        ABSENT: '人呢？',
        RESTING: '这就不行了？'
    };

    function elements() {
        return {
            button: document.getElementById('bnCameraBtn') || document.getElementById('cameraBtn'),
            preview: document.getElementById('bnCameraPreview') || document.getElementById('userCameraPreview'),
            video: document.getElementById('bnCameraVideo') || document.getElementById('userCameraVideo'),
            voiceButton: document.getElementById('bnVoiceInputBtn'),
            caption: document.getElementById('bnCaption') || document.getElementById('ocMessageText')
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
        stopVisionLoop();
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
            startVisionLoop();

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
        state.visionUnavailable = false;
        stopCamera();
    }

    function stopSession() {
        state.sessionActive = false;
        stopVoiceInput();
        stopCamera();
    }

    function setCaption(text) {
        const { caption } = elements();
        if (!caption || !text) return;
        if (caption.id === 'ocMessageText') {
            caption.textContent = text;
        } else {
            caption.textContent = `“${text}”`;
        }
    }

    function captureFrame() {
        const { video } = elements();
        if (!video || !video.videoWidth || !video.videoHeight) return null;
        const maxWidth = 512;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return null;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.68);
    }

    async function analyzeCurrentFrame() {
        if (!state.sessionActive || !state.stream || state.visionInFlight || state.visionUnavailable) return;
        const image = captureFrame();
        if (!image) return;
        state.visionInFlight = true;
        try {
            const response = await fetch('/api/vision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image })
            });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 503) {
                state.visionUnavailable = true;
                stopVisionLoop();
                notify('视觉模型待配置');
                return;
            }
            if (!response.ok) throw new Error(payload.error || `Vision HTTP ${response.status}`);
            const status = payload?.data?.status;
            if (reactions[status]) setCaption(reactions[status]);
            window.dispatchEvent(new CustomEvent('focus-vision-result', { detail: payload.data }));
        } catch (error) {
            console.warn('Vision analysis failed:', error);
        } finally {
            state.visionInFlight = false;
        }
    }

    function startVisionLoop() {
        stopVisionLoop();
        if (state.visionUnavailable) return;
        state.visionTimer = window.setTimeout(() => {
            analyzeCurrentFrame();
            state.visionTimer = window.setInterval(analyzeCurrentFrame, VISION_INTERVAL_MS);
        }, 5000);
    }

    function stopVisionLoop() {
        if (state.visionTimer) {
            window.clearTimeout(state.visionTimer);
            window.clearInterval(state.visionTimer);
            state.visionTimer = null;
        }
    }

    async function startVoiceInput() {
        if (!state.sessionActive || state.audioStream || !navigator.mediaDevices?.getUserMedia) return;
        state.voiceHeld = true;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            if (!state.sessionActive || !state.voiceHeld) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            if (typeof MediaRecorder === 'undefined') {
                stream.getTracks().forEach(track => track.stop());
                notify('当前浏览器不支持语音录制');
                return;
            }
            state.audioStream = stream;
            state.audioChunks = [];
            const recorder = new MediaRecorder(stream);
            state.mediaRecorder = recorder;
            recorder.addEventListener('dataavailable', event => {
                if (event.data && event.data.size) state.audioChunks.push(event.data);
            });
            recorder.addEventListener('stop', () => {
                const blob = new Blob(state.audioChunks, { type: recorder.mimeType || 'audio/webm' });
                state.audioChunks = [];
                window.dispatchEvent(new CustomEvent('focus-voice-captured', { detail: { blob } }));
                notify('语音已录制，识别接口待配置');
            }, { once: true });
            recorder.start();
            const { voiceButton } = elements();
            voiceButton?.classList.add('is-listening');
            voiceButton?.setAttribute('aria-label', '松开结束语音');
            setCaption('我在听……');
        } catch (error) {
            console.warn('Voice input failed:', error);
            notify('未获得麦克风权限');
        }
    }

    function stopVoiceInput() {
        state.voiceHeld = false;
        const recorder = state.mediaRecorder;
        state.mediaRecorder = null;
        if (recorder && recorder.state !== 'inactive') recorder.stop();
        if (state.audioStream) {
            state.audioStream.getTracks().forEach(track => track.stop());
            state.audioStream = null;
        }
        const { voiceButton } = elements();
        voiceButton?.classList.remove('is-listening');
        voiceButton?.setAttribute('aria-label', '按住说话');
    }

    window.focusCompanion = {
        startSession,
        stopSession,
        startCamera,
        stopCamera,
        toggleCamera,
        analyzeCurrentFrame,
        startVoiceInput,
        stopVoiceInput,
        isCameraEnabled: () => Boolean(state.stream)
    };

    window.toggleFocusCamera = toggleCamera;
    window.addEventListener('pagehide', stopSession);
})();
