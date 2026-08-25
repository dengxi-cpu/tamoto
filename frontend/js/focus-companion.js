(function () {
    'use strict';

    const state = {
        stream: null,
        sessionActive: false,
        requestInFlight: false,
        visionTimer: null,
        visionInFlight: false,
        visionUnavailable: false,
        paused: false,
        epoch: Date.now(),
        turnId: 0,
        sessionStartedAt: null,
        recentObservations: [],
        policyState: {},
        ambientTimer: null,
        ambientCount: 0,
        productiveAmbientEncouragementCount: 0,
        lastAmbientAt: 0,
        lastPraiseAt: 0,
        lastEventOrDialogueAt: 0,
        roleActivity: '看书',
        openingTimers: [],
        openingAmbientDone: false,
        openingEventDone: false,
        latestObservation: null,
        preparedOpening: null,
        preparingOpening: null,
        skipNextOpening: false,
        dialogueController: null,
        dialogueHistory: [],
        pipelineController: null,
        audioContext: null,
        gainNode: null,
        playback: null,
        speechSequenceId: 0,
        activeSpeechSequence: null,
        audioStream: null,
        mediaRecorder: null,
        audioChunks: [],
        voiceHeld: false,
        voiceInFlight: false
    };

    const VISION_INTERVAL_MS = 20000;
    const TTS_BUFFER_MS = 180;
    // 测试期高频策略：前5分钟密集建立陪伴感，之后舒适陪伴。
    const AMBIENT_POLICY = {
        checkMinMs: 20 * 1000,
        checkJitterMs: 15 * 1000,
        studyCheckMinMs: 45 * 1000,
        studyCheckJitterMs: 25 * 1000,
        firstOpportunitySeconds: 20,
        eventCooldownMs: 20 * 1000,
        ambientCooldownMs: 35 * 1000,
        baseChance: 1,
        studyChance: 0.85,
        studyAmbientCooldownMs: 60 * 1000,
        firstTenMinutesLimit: 20,
        perTwentyFiveMinutesLimit: 50
    };
    const LOG_STORAGE_KEY = 'bn_companion_production_logs_v1';
    const LOG_TTL_MS = 24 * 60 * 60 * 1000;
    const LOG_LIMIT = 20;

    function readLogs() {
        try {
            const cutoff = Date.now() - LOG_TTL_MS;
            const logs = JSON.parse(localStorage.getItem(LOG_STORAGE_KEY) || '[]');
            return Array.isArray(logs) ? logs.filter(item => Date.parse(item.createdAt) >= cutoff) : [];
        } catch (_) {
            return [];
        }
    }

    function saveLog(entry) {
        try {
            const logs = readLogs();
            const index = logs.findIndex(item => item.id === entry.id);
            if (index >= 0) logs[index] = { ...logs[index], ...entry };
            else logs.unshift(entry);
            localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs.slice(0, LOG_LIMIT)));
            window.dispatchEvent(new CustomEvent('companion-production-log', { detail: entry }));
        } catch (error) {
            console.warn('Companion log could not be saved:', error);
        }
    }

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
        cancelReaction('视频已关闭');
    }

    async function startCamera() {
        if (!state.sessionActive || state.requestInFlight || state.stream) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            notify('当前浏览器不支持摄像头');
            return;
        }

        state.requestInFlight = true;
        try {
            await ensureAudio();
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
        const skipOpening = state.skipNextOpening;
        state.skipNextOpening = false;
        ensureAudio().catch(error => console.warn('Audio unlock failed:', error));
        cancelReaction('新专注会话');
        state.epoch = Date.now();
        state.turnId = 0;
        state.sessionStartedAt = (typeof focusStartTime !== 'undefined' && Number.isFinite(focusStartTime))
            ? focusStartTime
            : Date.now();
        state.recentObservations = [];
        state.policyState = {};
        state.ambientCount = 0;
        state.productiveAmbientEncouragementCount = 0;
        state.lastAmbientAt = 0;
        state.lastPraiseAt = 0;
        state.lastEventOrDialogueAt = 0;
        state.roleActivity = '看书';
        state.openingAmbientDone = skipOpening;
        state.openingEventDone = skipOpening;
        state.latestObservation = null;
        state.dialogueHistory = [];
        state.sessionActive = true;
        state.paused = false;
        state.visionUnavailable = false;
        stopCamera();
        if (!skipOpening) scheduleOpeningSequence();
        scheduleAmbientCheck();
        if (!skipOpening) playPreparedOpening().catch(error => console.warn('Prepared opening playback failed:', error));
    }

    function stopSession() {
        state.sessionActive = false;
        state.epoch += 1;
        stopAmbientLoop();
        stopOpeningSequence();
        state.dialogueController?.abort();
        state.dialogueController = null;
        cancelReaction('专注已结束');
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

    function normalizeMessages(messages, fallback = '') {
        const items = Array.isArray(messages) ? messages : [];
        const normalized = items.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3);
        if (normalized.length) return normalized;
        return String(fallback || '').split(/\n+/).map(item => item.trim()).filter(Boolean).slice(0, 3);
    }

    function beginSpeechMessages() {
        const { caption } = elements();
        if (!caption || caption.id === 'ocMessageText') return;
        caption.replaceChildren();
    }

    function appendSpeechMessage(text) {
        const { caption } = elements();
        if (!caption || !text) return;
        if (caption.id === 'ocMessageText') {
            caption.textContent = text;
            return;
        }
        const bubble = document.createElement('div');
        bubble.className = 'bn-speech-message';
        bubble.textContent = text;
        caption.appendChild(bubble);
        while (caption.children.length > 3) caption.firstElementChild?.remove();
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

    function getCompanionContext() {
        const task = (typeof currentTask !== 'undefined' && currentTask?.name)
            || document.getElementById('bnTaskInput')?.value?.trim()
            || '专注任务';
        const oc = typeof ocData !== 'undefined' && Array.isArray(ocData)
            ? (ocData[typeof currentOCIndex === 'number' ? currentOCIndex : 0] || ocData[0])
            : null;
        const betaMode = new URLSearchParams(location.search).get('mode') === 'beta';
        const userTitle = betaMode ? (oc?.userTitle || '大小姐') : '大小姐';
        const roleContext = {
            name: oc?.name || 'TA',
            userTitle,
            relationship: oc?.relationship || '学习搭子',
            persona: oc?.characterDescription || '毒舌但关心用户',
            voiceType: oc?.voiceType || 'zh_male_ruyayichen_saturn_bigtts'
        };
        const persona = oc
            ? `${roleContext.name}，与用户的关系是${roleContext.relationship}。完整人设：${roleContext.persona}。需要称呼时只叫用户“${roleContext.userTitle}”，不要使用其他姓名，也不要每句话都称呼。反应自然、简短。`
            : '毒舌但关心用户的陪伴者，需要称呼时只叫用户“大小姐”，不要每句话都称呼，反应自然、简短。';
        return { task, persona, roleContext };
    }

    async function ensureAudio() {
        if (!state.audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) throw new Error('当前浏览器不支持流式语音播放');
            state.audioContext = new AudioContextClass();
            state.gainNode = state.audioContext.createGain();
            state.gainNode.connect(state.audioContext.destination);
        }
        if (state.audioContext.state === 'suspended') await state.audioContext.resume();
    }

    function stopPlayback() {
        const playback = state.playback;
        if (!playback) return;
        state.playback = null;
        playback.controller.abort();
        playback.sources.forEach(source => {
            source.onended = null;
            try { source.stop(); } catch (_) {}
        });
        playback.sources.clear();
        playback.resolveFinished?.(false);
    }

    function cancelSpeechSequence() {
        state.speechSequenceId += 1;
        state.activeSpeechSequence = null;
        stopPlayback();
    }

    function cancelReaction() {
        state.pipelineController?.abort();
        state.pipelineController = null;
        cancelSpeechSequence();
    }

    function schedulePcmChunk(bytes, playback) {
        if (state.playback !== playback || playback.epoch !== state.epoch) return;
        let data = bytes;
        if (playback.carry !== null) {
            const merged = new Uint8Array(bytes.length + 1);
            merged[0] = playback.carry;
            merged.set(bytes, 1);
            data = merged;
            playback.carry = null;
        }
        if (data.length % 2) {
            playback.carry = data[data.length - 1];
            data = data.slice(0, -1);
        }
        if (!data.length) return;
        const samples = data.length / 2;
        const buffer = state.audioContext.createBuffer(1, samples, playback.sampleRate);
        const channel = buffer.getChannelData(0);
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        for (let index = 0; index < samples; index += 1) {
            channel[index] = view.getInt16(index * 2, true) / 32768;
        }
        const source = state.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(state.gainNode);
        const minimumStart = state.audioContext.currentTime + TTS_BUFFER_MS / 1000;
        playback.nextPlayTime = Math.max(playback.nextPlayTime, minimumStart);
        source.start(playback.nextPlayTime);
        playback.nextPlayTime += buffer.duration;
        playback.sources.add(source);
        source.onended = () => {
            playback.sources.delete(source);
            finishPlaybackIfDone(playback);
        };
    }

    function finishPlaybackIfDone(playback) {
        if (state.playback === playback && playback.streamEnded && playback.sources.size === 0) {
            state.playback = null;
            playback.resolveFinished?.(true);
        }
    }

    async function playStreamingTts(text, result, priority = 2, speechType = 'visual', onPlaybackStarted) {
        await ensureAudio();
        if (state.playback && state.playback.priority <= priority) return 0;
        stopPlayback();
        const controller = new AbortController();
        let resolveFinished;
        const finished = new Promise(resolve => { resolveFinished = resolve; });
        const playback = {
            epoch: result.epoch,
            controller,
            sources: new Set(),
            nextPlayTime: 0,
            carry: null,
            sampleRate: 24000,
            streamEnded: false,
            priority,
            speechType,
            resolveFinished
        };
        state.playback = playback;
        const response = await fetch('/api/tts-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ text, epoch: result.epoch, turnId: result.turnId, speechType, voiceType: getCompanionContext().roleContext.voiceType })
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || `TTS HTTP ${response.status}`);
        }
        playback.sampleRate = Number(response.headers.get('x-audio-sample-rate')) || 24000;
        const reader = response.body.getReader();
        let receivedAudio = false;
        let revealScheduled = false;
        let audioBytes = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (state.playback !== playback || playback.epoch !== state.epoch) {
                controller.abort();
                break;
            }
            if (value?.length) {
                receivedAudio = true;
                audioBytes += value.length;
                schedulePcmChunk(value, playback);
                if (!revealScheduled) {
                    revealScheduled = true;
                    window.setTimeout(() => {
                        if (playback.epoch === state.epoch && !playback.controller.signal.aborted) onPlaybackStarted?.();
                    }, TTS_BUFFER_MS + 60);
                }
            }
        }
        if (!receivedAudio && state.playback === playback) throw new Error('TTS 没有返回音频');
        playback.streamEnded = true;
        finishPlaybackIfDone(playback);
        const completed = await finished;
        return completed ? audioBytes : 0;
    }

    function waitBetweenMessages(sequenceId) {
        const delay = 300 + Math.floor(Math.random() * 501);
        return new Promise(resolve => window.setTimeout(() => {
            resolve(sequenceId === state.speechSequenceId);
        }, delay));
    }

    async function playMessageSequence(messages, result, priority = 2, speechType = 'visual', onMessage = appendSpeechMessage) {
        const items = normalizeMessages(messages);
        if (!items.length) return 0;
        if (state.activeSpeechSequence && state.activeSpeechSequence.priority <= priority) return 0;
        if (state.activeSpeechSequence) cancelSpeechSequence();
        const sequenceId = ++state.speechSequenceId;
        state.activeSpeechSequence = { id: sequenceId, priority };
        beginSpeechMessages();
        let totalBytes = 0;
        try {
            for (let index = 0; index < items.length; index += 1) {
                if (sequenceId !== state.speechSequenceId || result.epoch !== state.epoch || state.voiceHeld || state.paused) break;
                const message = items[index];
                let messageShown = false;
                const showMessage = () => {
                    if (messageShown) return;
                    messageShown = true;
                    onMessage(message, index);
                };
                let bytes;
                try {
                    bytes = await playStreamingTts(message, result, priority, speechType, showMessage);
                } catch (error) {
                    showMessage();
                    throw error;
                }
                if (!bytes) showMessage();
                if (!bytes || sequenceId !== state.speechSequenceId) break;
                totalBytes += bytes;
                if (index < items.length - 1 && !await waitBetweenMessages(sequenceId)) break;
            }
        } finally {
            if (state.activeSpeechSequence?.id === sequenceId) state.activeSpeechSequence = null;
        }
        return totalBytes;
    }

    async function analyzeCurrentFrame() {
        if (!state.sessionActive || state.paused || state.voiceHeld || state.voiceInFlight || !state.stream || state.visionInFlight || state.visionUnavailable) return;
        const image = captureFrame();
        if (!image) return;
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        const controller = new AbortController();
        const logId = `${requestEpoch}-${turnId}`;
        const startedAt = performance.now();
        state.pipelineController = controller;
        state.visionInFlight = true;
        try {
            const { task, persona, roleContext } = getCompanionContext();
            const sessionStartedAt = new Date(state.sessionStartedAt || Date.now()).toISOString();
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (state.sessionStartedAt || Date.now())) / 1000));
            const recentObservations = state.recentObservations.slice(-1);
            const response = await fetch('/api/companion-observe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    image, task, persona, roleContext, epoch: requestEpoch, turnId,
                    sessionStartedAt, elapsedSeconds, recentObservations,
                    policyState: state.policyState
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (response.status === 503) {
                state.visionUnavailable = true;
                stopVisionLoop();
                notify('视觉模型待配置');
                return;
            }
            if (!response.ok) throw new Error(payload.error || `Vision HTTP ${response.status}`);
            const result = payload?.data || payload;
            if (requestEpoch !== state.epoch || state.paused || !state.sessionActive) return;
            if (!result?.decision) throw new Error('AI 没有返回发言决策');
            state.policyState = result.decision.policyState || state.policyState;
            state.latestObservation = {
                capturedAt: Date.now(),
                scene: result.observation?.scene || '',
                state: result.decision.state || 'UNKNOWN'
            };
            state.recentObservations.push({
                observedAt: result.observation?.observedAt || new Date().toISOString(),
                elapsedSeconds,
                scene: result.observation?.scene || '',
                reaction: result.reaction
            });
            state.recentObservations = state.recentObservations.slice(-1);
            window.dispatchEvent(new CustomEvent('focus-companion-result', { detail: result }));
            saveLog({
                id: logId,
                createdAt: new Date().toISOString(),
                status: 'success',
                epoch: requestEpoch,
                turnId,
                task,
                persona,
                image,
                scene: result.observation?.scene || '',
                reaction: result.reaction || '',
                visionMs: result.timings?.visionMs,
                reactionMs: result.timings?.reactionMs,
                totalMs: result.timings?.totalMs,
                requestMs: Math.round(performance.now() - startedAt),
                ttsStatus: result.decision.shouldSpeak ? 'streaming' : 'skipped',
                ttsBytes: 0
            });
            const messages = normalizeMessages(result.messages, result.reaction);
            if (result.decision.shouldSpeak && messages.length) {
                const ttsBytes = await playMessageSequence(messages, result, 2, 'visual');
                if (ttsBytes) state.lastEventOrDialogueAt = Date.now();
                saveLog({ id: logId, ttsStatus: ttsBytes ? 'completed' : 'suppressed', ttsBytes });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Companion pipeline failed:', error);
                saveLog({
                    id: logId,
                    createdAt: new Date().toISOString(),
                    status: 'failed',
                    epoch: requestEpoch,
                    turnId,
                    image,
                    task: getCompanionContext().task,
                    persona: getCompanionContext().persona,
                    error: error.message || '未知错误',
                    requestMs: Math.round(performance.now() - startedAt),
                    ttsStatus: 'failed'
                });
                notify(error.message || '感知陪伴暂时不可用');
            }
        } finally {
            if (state.pipelineController === controller) state.pipelineController = null;
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

    function setPaused(paused) {
        state.paused = Boolean(paused);
        if (state.paused) {
            stopVisionLoop();
            cancelReaction('专注已暂停');
            stopAmbientLoop();
            stopOpeningSequence();
        } else if (state.sessionActive) {
            if (state.stream) startVisionLoop();
            scheduleAmbientCheck();
            if (openingElapsedMs() < 120000 && (!state.openingAmbientDone || !state.openingEventDone)) {
                addOpeningTimer(state.openingAmbientDone ? runOpeningEvent : runOpeningAmbient, 1000);
            }
        }
    }

    function stopAmbientLoop() {
        if (state.ambientTimer) window.clearTimeout(state.ambientTimer);
        state.ambientTimer = null;
    }

    function openingElapsedMs() {
        return Date.now() - (state.sessionStartedAt || Date.now());
    }

    function addOpeningTimer(callback, delay) {
        const timer = window.setTimeout(callback, delay);
        state.openingTimers.push(timer);
    }

    function stopOpeningSequence() {
        state.openingTimers.forEach(timer => window.clearTimeout(timer));
        state.openingTimers = [];
    }

    function scheduleOpeningSequence() {
        stopOpeningSequence();
        addOpeningTimer(runOpeningAmbient, 700);
        addOpeningTimer(runOpeningEvent, 40000);
    }

    async function prepareOpening() {
        if (state.preparedOpening || state.preparingOpening) return state.preparingOpening;
        state.preparingOpening = (async () => {
            const { task, persona, roleContext } = getCompanionContext();
            const preloadEpoch = Date.now();
            const preloadTurnId = 900000;
            const lineResponse = await fetch('/api/companion-observe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'ambient', type: 'opening', task, persona, roleContext, elapsedSeconds: 0, epoch: preloadEpoch, turnId: preloadTurnId })
            });
            const linePayload = await lineResponse.json().catch(() => ({}));
            if (!lineResponse.ok) throw new Error(linePayload.error || '开场台词预生成失败');
            const messages = normalizeMessages(linePayload.data?.messages, linePayload.data?.reaction);
            if (!messages.length) throw new Error('开场台词为空');
            const preparedMessages = [];
            for (const text of messages) {
                const audioResponse = await fetch('/api/tts-stream', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, epoch: preloadEpoch, turnId: preloadTurnId, speechType: 'opening', voiceType: roleContext.voiceType })
                });
                if (!audioResponse.ok) throw new Error('开场语音预生成失败');
                preparedMessages.push({
                    text,
                    bytes: new Uint8Array(await audioResponse.arrayBuffer()),
                    sampleRate: Number(audioResponse.headers.get('x-audio-sample-rate')) || 24000
                });
            }
            state.preparedOpening = { messages: preparedMessages };
            return state.preparedOpening;
        })().catch(error => {
            console.warn('Opening preload failed:', error);
            return null;
        }).finally(() => {
            state.preparingOpening = null;
        });
        return state.preparingOpening;
    }

    async function playPreparedOpening() {
        const prepared = state.preparedOpening;
        if (!prepared || state.openingAmbientDone || !state.sessionActive) return false;
        await ensureAudio();
        if (state.activeSpeechSequence) return false;
        const sequenceId = ++state.speechSequenceId;
        state.activeSpeechSequence = { id: sequenceId, priority: 4 };
        beginSpeechMessages();
        for (let index = 0; index < prepared.messages.length; index += 1) {
            if (sequenceId !== state.speechSequenceId || !state.sessionActive || state.voiceHeld) return false;
            const item = prepared.messages[index];
            let resolveFinished;
            const finished = new Promise(resolve => { resolveFinished = resolve; });
            const playback = {
                epoch: state.epoch,
                controller: new AbortController(),
                sources: new Set(),
                nextPlayTime: 0,
                carry: null,
                sampleRate: item.sampleRate,
                streamEnded: false,
                priority: 4,
                speechType: 'opening',
                resolveFinished
            };
            state.playback = playback;
            schedulePcmChunk(item.bytes, playback);
            window.setTimeout(() => {
                if (sequenceId === state.speechSequenceId) appendSpeechMessage(item.text);
            }, TTS_BUFFER_MS + 60);
            playback.streamEnded = true;
            finishPlaybackIfDone(playback);
            if (!await finished || sequenceId !== state.speechSequenceId) return false;
            if (index < prepared.messages.length - 1 && !await waitBetweenMessages(sequenceId)) return false;
        }
        if (state.activeSpeechSequence?.id === sequenceId) state.activeSpeechSequence = null;
        const now = Date.now();
        state.openingAmbientDone = true;
        state.lastAmbientAt = now;
        state.ambientCount += 1;
        state.policyState.lastAnySpokenAt = now;
        state.preparedOpening = null;
        prepareOpening();
        return true;
    }

    async function requestAmbientLine(type, extra = {}) {
        const { task, persona, roleContext } = getCompanionContext();
        const elapsedSeconds = Math.max(0, Math.floor(openingElapsedMs() / 1000));
        const response = await fetch('/api/companion-observe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'ambient', type, task, persona, roleContext, elapsedSeconds, ...extra })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Ambient HTTP ${response.status}`);
        return normalizeMessages(payload.data?.messages, payload.data?.reaction);
    }

    async function runOpeningAmbient() {
        if (!state.sessionActive || state.paused || state.openingAmbientDone || openingElapsedMs() >= 120000) return;
        if (!state.preparedOpening && state.preparingOpening && openingElapsedMs() < 1000) {
            addOpeningTimer(runOpeningAmbient, 200);
            return;
        }
        if (await playPreparedOpening()) return;
        if (state.voiceHeld || state.playback) {
            addOpeningTimer(runOpeningAmbient, 3000);
            return;
        }
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        try {
            const messages = await requestAmbientLine('opening', { epoch: requestEpoch, turnId });
            if (!messages.length || requestEpoch !== state.epoch || state.paused) return;
            if (state.voiceHeld || state.playback) {
                addOpeningTimer(runOpeningAmbient, 3000);
                return;
            }
            const bytes = await playMessageSequence(messages, { epoch: requestEpoch, turnId }, 4, 'opening');
            if (!bytes) return;
            const now = Date.now();
            state.openingAmbientDone = true;
            state.lastAmbientAt = now;
            state.ambientCount += 1;
            state.policyState.lastAnySpokenAt = now;
        } catch (error) {
            console.warn('Opening ambient failed:', error);
            if (openingElapsedMs() < 120000) addOpeningTimer(runOpeningAmbient, 5000);
        }
    }

    async function runOpeningEvent() {
        if (!state.sessionActive || state.paused || state.openingEventDone || openingElapsedMs() >= 120000) return;
        if (!state.openingAmbientDone || state.voiceHeld || state.playback || state.visionInFlight) {
            addOpeningTimer(runOpeningEvent, 3000);
            return;
        }
        const latest = state.latestObservation;
        const fresh = latest && Date.now() - latest.capturedAt <= 25000;
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        try {
            const messages = await requestAmbientLine('opening_event', {
                epoch: requestEpoch,
                turnId,
                scene: fresh ? latest.scene : '',
                state: fresh ? latest.state : 'NO_CAMERA'
            });
            if (!messages.length || requestEpoch !== state.epoch || state.paused) return;
            if (state.voiceHeld || state.playback || state.visionInFlight) {
                addOpeningTimer(runOpeningEvent, 3000);
                return;
            }
            const bytes = await playMessageSequence(messages, { epoch: requestEpoch, turnId }, 2, 'opening_event');
            if (!bytes) return;
            state.openingEventDone = true;
            state.lastEventOrDialogueAt = Date.now();
            state.policyState.lastAnySpokenAt = state.lastEventOrDialogueAt;
        } catch (error) {
            console.warn('Opening event failed:', error);
            if (openingElapsedMs() < 120000) addOpeningTimer(runOpeningEvent, 5000);
        }
    }

    function scheduleAmbientCheck() {
        stopAmbientLoop();
        if (!state.sessionActive || state.paused) return;
        const studyPhase = openingElapsedMs() >= 5 * 60 * 1000;
        const delay = studyPhase
            ? AMBIENT_POLICY.studyCheckMinMs + Math.floor(Math.random() * AMBIENT_POLICY.studyCheckJitterMs)
            : AMBIENT_POLICY.checkMinMs + Math.floor(Math.random() * AMBIENT_POLICY.checkJitterMs);
        state.ambientTimer = window.setTimeout(async () => {
            await considerAmbientSpeech();
            scheduleAmbientCheck();
        }, delay);
    }

    async function considerAmbientSpeech() {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - (state.sessionStartedAt || now)) / 1000);
        const policy = state.policyState || {};
        if (!state.sessionActive || state.paused || state.voiceHeld || state.visionInFlight || state.playback) return;
        const productiveStates = ['STUDYING', 'READING', 'WRITING', 'COMPUTER_WORK'];
        const ambientSafe = !state.stream || !policy.currentState || productiveStates.includes(policy.currentState);
        if (elapsedSeconds < AMBIENT_POLICY.firstOpportunitySeconds || !ambientSafe || policy.phoneStartedAt) return;
        if (state.lastEventOrDialogueAt && now - state.lastEventOrDialogueAt < AMBIENT_POLICY.eventCooldownMs) return;
        const studyPhase = elapsedSeconds >= 5 * 60;
        const ambientCooldownMs = studyPhase ? AMBIENT_POLICY.studyAmbientCooldownMs : AMBIENT_POLICY.ambientCooldownMs;
        if (state.lastAmbientAt && now - state.lastAmbientAt < ambientCooldownMs) return;
        const ambientLimit = elapsedSeconds <= 10 * 60
            ? AMBIENT_POLICY.firstTenMinutesLimit
            : Math.ceil(elapsedSeconds / (25 * 60)) * AMBIENT_POLICY.perTwentyFiveMinutesLimit;
        if (state.ambientCount >= ambientLimit) return;

        const focusSeconds = policy.focusStreakStartedAt ? Math.floor((now - policy.focusStreakStartedAt) / 1000) : 0;
        const speakChance = studyPhase ? AMBIENT_POLICY.studyChance : AMBIENT_POLICY.baseChance;
        if (Math.random() > speakChance) return;
        let type = 'presence';
        let priority = 5;
        let activity = '';
        const studyRoll = Math.random();
        const needsProductiveEncouragement = productiveStates.includes(policy.currentState)
            && state.productiveAmbientEncouragementCount < 3;
        if (needsProductiveEncouragement) {
            type = 'encourage';
            priority = 4;
        } else if (studyPhase && studyRoll < 0.34 && (!state.lastPraiseAt || now - state.lastPraiseAt >= 3 * 60 * 1000)) {
            type = 'praise';
            priority = 4;
        } else if (studyPhase && studyRoll < 0.67) {
            activity = state.roleActivity;
            type = 'activity';
        } else if (studyPhase) {
            type = 'encourage';
        }

        const { task, persona } = getCompanionContext();
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        try {
            const messages = await requestAmbientLine(type, { activity, epoch: requestEpoch, turnId });
            if (requestEpoch !== state.epoch || state.paused || state.voiceHeld || state.visionInFlight) return;
            if (!messages.length) return;
            const bytes = await playMessageSequence(messages, { epoch: requestEpoch, turnId }, priority, type);
            if (!bytes) return;
            state.lastAmbientAt = now;
            state.ambientCount += 1;
            state.policyState.lastAnySpokenAt = now;
            if (needsProductiveEncouragement) state.productiveAmbientEncouragementCount += 1;
            if (type === 'praise') {
                state.lastPraiseAt = now;
            }
            window.dispatchEvent(new CustomEvent('focus-ambient-spoken', { detail: { type, reaction: messages.join('\n'), messages } }));
        } catch (error) {
            console.warn('Ambient speech failed:', error);
        }
    }

    async function startVoiceInput() {
        if (!state.sessionActive || state.audioStream || state.voiceInFlight || !navigator.mediaDevices?.getUserMedia) return;
        state.voiceHeld = true;
        state.dialogueController?.abort();
        state.dialogueController = null;
        cancelReaction('用户开始说话');
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
            const preferredMimeType = [
                'audio/ogg;codecs=opus',
                'audio/webm;codecs=opus',
                'audio/webm'
            ].find(type => MediaRecorder.isTypeSupported?.(type));
            const recorder = preferredMimeType
                ? new MediaRecorder(stream, { mimeType: preferredMimeType })
                : new MediaRecorder(stream);
            state.mediaRecorder = recorder;
            recorder.addEventListener('dataavailable', event => {
                if (event.data && event.data.size) state.audioChunks.push(event.data);
            });
            recorder.addEventListener('stop', async () => {
                const blob = new Blob(state.audioChunks, { type: recorder.mimeType || 'audio/webm' });
                state.audioChunks = [];
                window.dispatchEvent(new CustomEvent('focus-voice-captured', { detail: { blob } }));
                await transcribeVoice(blob);
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

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.addEventListener('load', () => resolve(reader.result), { once: true });
            reader.addEventListener('error', () => reject(reader.error || new Error('Audio read failed')), { once: true });
            reader.readAsDataURL(blob);
        });
    }

    async function transcribeVoice(blob) {
        if (!blob?.size) return;
        if (blob.size > 3 * 1024 * 1024) {
            notify('录音过长，请缩短后重试');
            return;
        }
        state.voiceInFlight = true;
        const { voiceButton } = elements();
        voiceButton?.classList.add('is-processing');
        voiceButton?.setAttribute('aria-label', '正在识别');
        setCaption('正在听你说……');
        try {
            const audio = await blobToDataUrl(blob);
            const response = await fetch('/api/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Speech HTTP ${response.status}`);
            const text = payload?.data?.text?.trim();
            if (text) {
                setCaption(`你说：“${text}”`);
                notify('语音识别完成');
                window.dispatchEvent(new CustomEvent('focus-voice-result', { detail: { text } }));
                await respondToVoice(text);
            } else {
                setCaption('刚才没有听清，再说一次？');
                notify('没有识别到文字');
            }
        } catch (error) {
            console.warn('Voice transcription failed:', error);
            setCaption('刚才没听清，再试一次？');
            notify(error.message || '语音识别失败');
        } finally {
            state.voiceInFlight = false;
            voiceButton?.classList.remove('is-processing');
            voiceButton?.setAttribute('aria-label', '按住说话');
        }
    }

    async function respondToVoice(text) {
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        const controller = new AbortController();
        state.dialogueController = controller;
        const { task, persona, roleContext } = getCompanionContext();
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (state.sessionStartedAt || Date.now())) / 1000));
        const scene = state.latestObservation && Date.now() - state.latestObservation.capturedAt <= 120000
            ? state.latestObservation.scene : '';
        const history = state.dialogueHistory.slice(-6);
        state.dialogueHistory.push({ role: 'user', content: text });
        setCaption('TA 正在想……');
        try {
            const response = await fetch('/api/companion-observe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({ mode: 'dialogue', text, task, persona, roleContext, elapsedSeconds, scene, history, epoch: requestEpoch, turnId })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Dialogue HTTP ${response.status}`);
            if (requestEpoch !== state.epoch || state.voiceHeld || state.paused) return;
            const messages = normalizeMessages(payload.data?.messages, payload.data?.reaction);
            if (!messages.length) throw new Error('AI 没有生成回复');
            const reaction = messages.join('\n');
            state.dialogueHistory.push({ role: 'assistant', content: reaction });
            state.dialogueHistory = state.dialogueHistory.slice(-6);
            const bytes = await playMessageSequence(messages, { epoch: requestEpoch, turnId }, 1, 'dialogue');
            if (bytes) {
                state.lastEventOrDialogueAt = Date.now();
                state.policyState.lastAnySpokenAt = state.lastEventOrDialogueAt;
                window.dispatchEvent(new CustomEvent('focus-dialogue-spoken', { detail: { text, reaction, messages } }));
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Companion dialogue failed:', error);
                setCaption('刚才没接上，再和我说一次？');
                notify(error.message || 'AI 对话失败');
            }
        } finally {
            if (state.dialogueController === controller) state.dialogueController = null;
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
        setPaused,
        prepareOpening,
        unlockAudio: ensureAudio,
        createSpeechTurn: () => ({ epoch: state.epoch, turnId: ++state.turnId }),
        speakMessages: (messages, turn, speechType = 'session_opening', onMessage) => playMessageSequence(messages, turn, 1, speechType, onMessage),
        markMeetingComplete: () => { state.skipNextOpening = true; },
        previewVoice: () => playMessageSequence(['我在这。'], { epoch: state.epoch, turnId: ++state.turnId }, 1, 'voice_preview'),
        isCameraEnabled: () => Boolean(state.stream)
    };

    window.toggleFocusCamera = toggleCamera;
    if (new URLSearchParams(location.search).get('mode') !== 'beta') window.setTimeout(prepareOpening, 0);
    window.addEventListener('pagehide', stopSession);
})();
