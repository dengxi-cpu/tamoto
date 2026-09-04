(function () {
    'use strict';

    const state = {
        stream: null,
        cameraState: 'camera-off',
        sessionActive: false,
        requestInFlight: false,
        visionTimer: null,
        visionInFlight: false,
        visionUnavailable: false,
        paused: false,
        epoch: Date.now(),
        turnId: 0,
        sessionStartedAt: null,
        serverSessionId: null,
        serverSessionVersion: null,
        serverSessionPromise: null,
        serverSessionFailed: false,
        recentObservations: [],
        workingMemory: [],
        storyMemory: null,
        relationshipMemory: null,
        relationshipMemoryEnabled: localStorage.getItem('bnRelationshipMemoryEnabled') !== 'false',
        memoryConsolidationInFlight: false,
        memoryRequestSequence: 0,
        latestAppliedMemoryRequest: 0,
        policyState: {},
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
        activeTrackSpeechId: null,
        dialogueController: null,
        memoryEventController: null,
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
        voiceInFlight: false,
        voiceCancelled: false,
        speechRecognition: null,
        previousAudioSessionType: null,
        companionMode: 'quiet',
        voiceAutoEnabled: false,
        stageTapCount: 0,
        stageTapTimer: null
    };

    // Serialize observations so slow model calls never build a request queue.
    // 观察以 5 秒为节拍；请求保持串行，避免 VLM 与 Memory LLM 调用堆积。
    const VISION_INTERVAL_MS = 5000;
    const VISION_INITIAL_DELAY_MS = 1000;
    const TTS_BUFFER_MS = 180;
    const LOG_STORAGE_KEY = 'bn_companion_production_logs_v1';
    const LOG_TTL_MS = 24 * 60 * 60 * 1000;
    const LOG_LIMIT = 20;
    const RELATIONSHIP_MEMORY_KEY = 'bn_companion_relationship_memory_v1';

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

    function setPresence(presence = 'silent') {
        const value = ['silent', 'listening', 'watching', 'speaking'].includes(presence) ? presence : 'silent';
        const root = document.querySelector('.bn-focus-running');
        const stage = document.querySelector('.bn-stage');
        if (root) root.dataset.companionPresence = value;
        if (stage) stage.dataset.companionPresence = value;
        window.dispatchEvent(new CustomEvent('focus-companion-presence', { detail: { presence: value } }));
    }

    function createMemoryEvent(type, data = {}) {
        return {
            id: `${state.epoch}-${state.turnId}-${type}-${Date.now()}`,
            type,
            observedAt: data.observedAt || new Date().toISOString(),
            elapsedSeconds: Math.max(0, Number(data.elapsedSeconds) || 0),
            observation: String(data.observation || data.scene || '').slice(0, 300),
            changes: Array.isArray(data.changes) ? data.changes.slice(0, 4) : [],
            confidence: Math.max(0, Math.min(1, Number(data.confidence) || 0)),
            reaction: String(data.reaction || '').slice(0, 200),
            delivered: data.delivered === true
        };
    }

    function appendWorkingMemory(event) {
        if (!event?.observation) return;
        const previous = state.workingMemory[state.workingMemory.length - 1];
        const duplicate = previous && previous.type === event.type && previous.observation === event.observation
            && Date.parse(event.observedAt) - Date.parse(previous.observedAt) < 15000;
        if (duplicate) {
            previous.observedAt = event.observedAt;
            previous.elapsedSeconds = event.elapsedSeconds;
            previous.confidence = Math.max(previous.confidence || 0, event.confidence || 0);
        } else {
            state.workingMemory.push(event);
        }
        state.workingMemory = state.workingMemory
            .filter(item => Number.isFinite(Date.parse(item.observedAt)) && Date.now() - Date.parse(item.observedAt) <= 3 * 60 * 1000)
            .slice(-24);
    }

    function emitSpeechLifecycle(status, detail = {}) {
        window.dispatchEvent(new CustomEvent('focus-speech-lifecycle', { detail:{ status, at:Date.now(), ...detail } }));
        if (detail.logId) {
            const ttsStatus = {
                generated:'generated', displayed:'displayed', playback_started:'streaming',
                playback_completed:'completed', interrupted:'interrupted', expired:'expired'
            }[status] || status;
            saveLog({ id:detail.logId, ttsStatus, lifecycleStatus:status, lifecycleAt:new Date().toISOString() });
        }
    }

    function beginMemoryRequest() {
        state.memoryRequestSequence += 1;
        return state.memoryRequestSequence;
    }

    function applyStoryMemory(memory, requestSequence) {
        if (!memory?.storyMemory || requestSequence < state.latestAppliedMemoryRequest) return false;
        state.latestAppliedMemoryRequest = requestSequence;
        state.storyMemory = memory.storyMemory;
        return true;
    }

    function setButtonState(enabled) {
        const { button } = elements();
        if (!button) return;
        button.classList.toggle('camera-active', enabled);
        button.setAttribute('aria-pressed', String(enabled));
        button.setAttribute('aria-label', enabled ? '关闭视频' : '开启视频');
        button.title = enabled ? '关闭视频' : '开启视频';
    }

    function setCameraState(cameraState) {
        const { button, preview } = elements();
        state.cameraState = cameraState;
        const enabled = cameraState === 'camera-on';
        const requesting = cameraState === 'camera-requesting';
        if (preview) {
            preview.hidden = false;
            preview.dataset.cameraState = cameraState;
            preview.classList.toggle('is-placeholder', !enabled);
            preview.classList.toggle('is-requesting', requesting);
            preview.classList.toggle('is-denied', cameraState === 'camera-denied');
            preview.setAttribute('aria-busy', String(requesting));
            preview.setAttribute('aria-label', enabled
                ? '你的摄像头预览，点击关闭，可拖动或双指缩放'
                : requesting
                    ? '正在请求摄像头权限'
                    : '点击开启摄像头，可拖动或双指缩放');
        }
        if (button) button.disabled = requesting;
        setButtonState(enabled);
    }

    function stopCamera(nextState = 'camera-off') {
        const { video } = elements();
        const streamToStop = state.stream;
        state.stream = null;
        setCameraState(nextState);
        window.setTimeout(() => {
            streamToStop?.getTracks().forEach(track => track.stop());
            if (video?.srcObject === streamToStop) video.srcObject = null;
        }, 260);
        stopVisionLoop();
        if (streamToStop) window.track?.cameraToggle(false, 'allow');
        cancelReaction('视频已关闭');
    }

    async function startCamera() {
        if (!state.sessionActive || state.requestInFlight || state.stream) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            notify('当前浏览器不支持摄像头');
            setCameraState('camera-denied');
            return;
        }

        state.requestInFlight = true;
        setCameraState('camera-requesting');
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
                setCameraState('camera-off');
                return;
            }

            const { preview, video } = elements();
            state.stream = stream;
            window.track?.cameraToggle(true, 'allow');
            if (video) {
                video.srcObject = stream;
                await video.play().catch(() => {});
            }
            setCameraState('camera-on');
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
            window.track?.cameraToggle(false, denied ? 'deny' : 'error');
            stopCamera(denied ? 'camera-denied' : 'camera-off');
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

    function configureMode(options = {}) {
        const mode = ['quiet','occasional','strict'].includes(options.mode) ? options.mode : 'quiet';
        const modePolicy = window.CompanionModePolicy?.getModePolicy(mode);
        state.companionMode = mode;
        state.voiceAutoEnabled = options.autoPlayVoice == null ? Boolean(modePolicy?.autoPlayVoice) : Boolean(options.autoPlayVoice);
    }

    function setVoiceAutoEnabled(enabled) {
        state.voiceAutoEnabled = Boolean(enabled);
        if (!state.voiceAutoEnabled) stopPlayback('character_voice_muted');
    }

    async function requestStrictCameraPermission() {
        if (!navigator.mediaDevices?.getUserMedia) {
            notify('当前设备不支持严格督促所需的摄像头');
            return false;
        }
        try {
            const probe = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' }, audio:false });
            probe.getTracks().forEach(track => track.stop());
            return true;
        } catch (error) {
            notify('开启严格督促前，需要允许摄像头权限');
            return false;
        }
    }

    function isBetaSessionRuntime() {
        return window.APP_BASE === '/beta' || new URLSearchParams(location.search).get('mode') === 'beta';
    }

    async function initializeServerSession(requestEpoch) {
        if (!isBetaSessionRuntime()) return null;
        const { task, persona, roleContext } = getCompanionContext();
        try {
            const response = await fetch((window.APP_BASE || '') + '/api/companion-session', {
                method:'POST',
                headers:{ 'Content-Type':'application/json' },
                body:JSON.stringify({
                    task, persona, roleContext, relationshipMemory:state.relationshipMemory,
                    epoch:requestEpoch,
                    sessionStartedAt:new Date(state.sessionStartedAt || Date.now()).toISOString()
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Session HTTP ${response.status}`);
            if (requestEpoch !== state.epoch || !state.sessionActive) return null;
            state.serverSessionId = payload.data?.sessionId || null;
            state.serverSessionVersion = payload.data?.stateVersion || null;
            state.serverSessionFailed = !state.serverSessionId;
            return state.serverSessionId;
        } catch (error) {
            state.serverSessionFailed = true;
            console.warn('V2 Session unavailable; using V1 fallback:', error);
            return null;
        }
    }

    function closeServerSession() {
        const sessionId = state.serverSessionId;
        state.serverSessionId = null;
        state.serverSessionVersion = null;
        state.serverSessionPromise = null;
        if (!sessionId) return;
        fetch((window.APP_BASE || '') + `/api/companion-session?sessionId=${encodeURIComponent(sessionId)}`, {
            method:'DELETE', keepalive:true
        }).catch(error => console.warn('Session cleanup failed:', error));
    }

    function startSession() {
        ensureAudio().catch(error => console.warn('Audio unlock failed:', error));
        cancelReaction('新专注会话');
        state.epoch = Date.now();
        state.turnId = 0;
        state.sessionStartedAt = (typeof focusStartTime !== 'undefined' && Number.isFinite(focusStartTime))
            ? focusStartTime
            : Date.now();
        state.recentObservations = [];
        state.workingMemory = [];
        state.storyMemory = null;
        state.serverSessionId = null;
        state.serverSessionVersion = null;
        state.serverSessionPromise = null;
        state.serverSessionFailed = false;
        state.memoryRequestSequence = 0;
        state.latestAppliedMemoryRequest = 0;
        try {
            const savedRelationshipMemory = state.relationshipMemoryEnabled ? localStorage.getItem(RELATIONSHIP_MEMORY_KEY) : null;
            if (!savedRelationshipMemory) state.relationshipMemory = null;
            else {
                try { state.relationshipMemory = JSON.parse(savedRelationshipMemory); }
                catch (_) { state.relationshipMemory = savedRelationshipMemory.slice(0, 6000); }
            }
        } catch (_) {
            state.relationshipMemory = null;
        }
        state.policyState = {};
        state.productiveAmbientEncouragementCount = 0;
        state.lastAmbientAt = 0;
        state.lastPraiseAt = 0;
        state.lastEventOrDialogueAt = 0;
        state.roleActivity = '看书';
        state.openingAmbientDone = false;
        state.openingEventDone = false;
        state.latestObservation = null;
        state.dialogueHistory = [];
        state.sessionActive = true;
        if (isBetaSessionRuntime()) state.serverSessionPromise = initializeServerSession(state.epoch);
        setPresence('silent');
        state.paused = false;
        state.visionUnavailable = false;
        stopCamera();
        scheduleOpeningSequence();
        playPreparedOpening().catch(error => console.warn('Prepared opening playback failed:', error));
        if (state.companionMode === 'strict') startCamera();
    }

    function stopSession() {
        Promise.resolve(consolidateSessionMemory()).finally(closeServerSession);
        state.sessionActive = false;
        setPresence('silent');
        state.epoch += 1;
        stopAmbientLoop();
        stopOpeningSequence();
        state.dialogueController?.abort();
        state.dialogueController = null;
        state.memoryEventController?.abort();
        state.memoryEventController = null;
        cancelReaction('专注已结束');
        stopVoiceInput();
        stopCamera();
    }

    async function completeSession() {
        if (!state.sessionActive) return;
        try {
            await announceSessionEvent('completion');
        } finally {
            stopSession();
        }
    }

    async function consolidateSessionMemory() {
        if (!state.relationshipMemoryEnabled) return;
        if (state.memoryConsolidationInFlight || (!state.storyMemory && !state.workingMemory.length && !state.dialogueHistory.length)) return;
        state.memoryConsolidationInFlight = true;
        const { task, persona, roleContext } = getCompanionContext();
        const snapshot = {
            mode: 'memory_consolidation', task, persona, roleContext,
            storyMemory: state.storyMemory,
            relationshipMemory: state.relationshipMemory,
            workingMemory: state.workingMemory.slice(-24),
            conversationHistory: state.dialogueHistory.slice(-12)
        };
        try {
            const response = await fetch((window.APP_BASE || '') + '/api/companion-observe', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot), keepalive: true
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Memory HTTP ${response.status}`);
            const relationshipMemory = payload?.data?.relationshipMemory;
            if (!relationshipMemory || typeof relationshipMemory !== 'object') return;
            state.relationshipMemory = relationshipMemory;
            localStorage.setItem(RELATIONSHIP_MEMORY_KEY, JSON.stringify(relationshipMemory));
            window.dispatchEvent(new CustomEvent('focus-relationship-memory-updated', { detail:{ relationshipMemory } }));
        } catch (error) {
            console.warn('Relationship memory consolidation failed:', error);
        } finally {
            state.memoryConsolidationInFlight = false;
        }
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
        const splitClauses = source => source
            .flatMap(item => String(item || '').match(/[^。！？!?\n]+[。！？!?]?/g) || [])
            .map(item => item.trim())
            .filter(Boolean)
            .slice(0, 3)
            .map(item => /[。！？!?]$/.test(item) ? item : `${item}。`);
        const normalized = splitClauses(items);
        if (normalized.length) return normalized;
        return splitClauses([fallback]);
    }

    const messageTimers = new WeakMap();

    function dismissConversationMessage(bubble) {
        if (!bubble?.isConnected || bubble.classList.contains('is-leaving')) return;
        const timer = messageTimers.get(bubble);
        if (timer) window.clearTimeout(timer);
        bubble.style.height = `${bubble.offsetHeight}px`;
        bubble.getBoundingClientRect();
        bubble.classList.add('is-leaving');
        window.requestAnimationFrame(() => { bubble.style.height = '0px'; });
        const remove = () => bubble.remove();
        bubble.addEventListener('transitionend', event => {
            if (event.propertyName === 'height') remove();
        }, { once:true });
        window.setTimeout(remove, 800);
    }

    function beginSpeechMessages() {
        const { caption } = elements();
        if (!caption || caption.id === 'ocMessageText') return;
        caption.querySelectorAll('.is-pending').forEach(item => item.remove());
    }

    function appendConversationMessage(text, role = 'assistant', pending = false) {
        const { caption } = elements();
        if (!caption || !text) return;
        if (caption.id === 'ocMessageText') {
            caption.textContent = text;
            return;
        }
        const bubble = document.createElement('div');
        bubble.className = `bn-speech-message is-${role}${pending ? ' is-pending' : ''}`;
        if (role === 'assistant' && !pending) {
            const copy = document.createElement('span');
            copy.className = 'bn-speech-copy';
            copy.textContent = text;
            const replay = document.createElement('button');
            replay.className = 'bn-speech-replay';
            replay.type = 'button';
            setReplayIcon(replay, false);
            replay.setAttribute('aria-label', `播放语音：${text}`);
            replay.addEventListener('click', event => {
                event.stopPropagation();
                replaySpeechMessage(text, replay);
            });
            bubble.append(copy, replay);
        } else {
            bubble.textContent = text;
        }
        caption.appendChild(bubble);
        const visibleBubbles = [...caption.querySelectorAll('.bn-speech-message:not(.is-leaving)')];
        while (visibleBubbles.length > 2) dismissConversationMessage(visibleBubbles.shift());
        messageTimers.set(bubble, window.setTimeout(() => dismissConversationMessage(bubble), 18000));
        return bubble;
    }

    function appendSpeechMessage(text) {
        return appendConversationMessage(text, 'assistant');
    }

    function setReplayIcon(button, playing) {
        if (!button) return;
        button.innerHTML = playing
            ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7.5" y="7.5" width="9" height="9" rx="2"/></svg>'
            : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7.4v9.2c0 .8.9 1.3 1.6.85l7-4.6a1 1 0 0 0 0-1.7l-7-4.6A1 1 0 0 0 9 7.4Z"/></svg>';
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
        const betaMode = window.APP_BASE === '/beta' || new URLSearchParams(location.search).get('mode') === 'beta';
        const userTitle = betaMode ? (oc?.userTitle || '大小姐') : '大小姐';
        const roleContext = {
            name: oc?.name || 'TA',
            userTitle,
            relationship: oc?.relationship || '学习搭子',
            persona: oc?.characterDescription || '毒舌但关心用户',
            voiceType: oc?.voiceType || 'zh_male_ruyayichen_saturn_bigtts',
            voiceProvider: oc?.voiceProvider || 'volcengine',
            voiceId: oc?.voiceId || '',
            speechLanguage: oc?.speechLanguage === 'en' ? 'en' : 'zh'
        };
        let persona = oc
            ? `与用户的关系是${roleContext.relationship}。完整人设：${roleContext.persona}。需要称呼时只叫用户“${roleContext.userTitle}”，不要使用其他姓名，也不要每句话都称呼。反应自然、简短。`
            : '毒舌但关心用户的陪伴者，需要称呼时只叫用户“大小姐”，不要每句话都称呼，反应自然、简短。';
        if (state.companionMode === 'strict') persona += '当用户明显分心时，语气要严肃、直接、有压迫感，但不侮辱、不贬低用户。';
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

    function stopPlayback(reason = 'playback_stopped') {
        const playback = state.playback;
        if (!playback) return;
        if (state.activeTrackSpeechId) {
            window.track?.speechEnded(state.activeTrackSpeechId, 'cancelled', { cancelled_by: reason });
            state.activeTrackSpeechId = null;
        }
        state.playback = null;
        if (playback.started && !['replay', 'voice_preview'].includes(playback.speechType)) {
            emitSpeechLifecycle('interrupted', { speechType:playback.speechType, reason, logId:playback.logId });
            appendWorkingMemory(createMemoryEvent('ai_speech', {
                elapsedSeconds:Math.floor(openingElapsedMs() / 1000),
                observation:`AI 语音被中断：${String(playback.text || '').slice(0, 180)}`,
                reaction:String(playback.text || '').slice(0, 180), confidence:1, delivered:false
            }));
        }
        playback.controller.abort();
        playback.sources.forEach(source => {
            source.onended = null;
            try { source.stop(); } catch (_) {}
        });
        playback.sources.clear();
        playback.resolveFinished?.(false);
    }

    function cancelSpeechSequence(reason = 'cancelled') {
        if (state.activeTrackSpeechId) {
            window.track?.speechEnded(state.activeTrackSpeechId, 'cancelled', { cancelled_by: reason });
            state.activeTrackSpeechId = null;
        }
        state.speechSequenceId += 1;
        state.activeSpeechSequence = null;
        stopPlayback(reason);
    }

    function cancelReaction(reason = 'cancelled') {
        state.pipelineController?.abort();
        state.pipelineController = null;
        cancelSpeechSequence(reason);
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

    async function scheduleEncodedAudio(bytes, playback) {
        const decoded = await state.audioContext.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        if (state.playback !== playback) return 0;
        const source = state.audioContext.createBufferSource();
        source.buffer = decoded;
        source.connect(state.gainNode);
        playback.nextPlayTime = Math.max(playback.nextPlayTime, state.audioContext.currentTime + 0.04);
        source.start(playback.nextPlayTime);
        playback.nextPlayTime += decoded.duration;
        playback.sources.add(source);
        source.onended = () => {
            playback.sources.delete(source);
            finishPlaybackIfDone(playback);
        };
        return decoded.duration;
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
            text,
            started: false,
            logId: result?.logId || '',
            resolveFinished
        };
        state.playback = playback;
        const response = await fetch((window.APP_BASE || '') + '/api/tts-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify((() => {
                const voice = getCompanionContext().roleContext;
                return {
                    text, epoch: result.epoch, turnId: result.turnId, speechType,
                    voiceType: result.voiceType || voice.voiceType,
                    voiceProvider: result.voiceProvider || voice.voiceProvider,
                    voiceId: result.voiceId || voice.voiceId,
                    speechLanguage: result.speechLanguage || voice.speechLanguage,
                    performance: result.performance || null
                };
            })())
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || `TTS HTTP ${response.status}`);
        }
        if (response.headers.get('x-audio-format') === 'mp3') {
            const bytes = new Uint8Array(await response.arrayBuffer());
            if (!bytes.length) throw new Error('TTS 没有返回音频');
            await scheduleEncodedAudio(bytes, playback);
            playback.started = true;
            emitSpeechLifecycle('playback_started', { speechType, text, logId:result?.logId });
            onPlaybackStarted?.();
            playback.streamEnded = true;
            finishPlaybackIfDone(playback);
            const completed = await finished;
            return completed ? bytes.length : 0;
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
                        if (playback.epoch === state.epoch && !playback.controller.signal.aborted) {
                            playback.started = true;
                            emitSpeechLifecycle('playback_started', { speechType, text, logId:result?.logId });
                            onPlaybackStarted?.();
                        }
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

    async function generateSilentTts(text, result, speechType = 'visual') {
        const voice = getCompanionContext().roleContext;
        const response = await fetch((window.APP_BASE || '') + '/api/tts-stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text, epoch: result.epoch, turnId: result.turnId, speechType,
                voiceType: result.voiceType || voice.voiceType,
                voiceProvider: result.voiceProvider || voice.voiceProvider,
                voiceId: result.voiceId || voice.voiceId,
                speechLanguage: result.speechLanguage || voice.speechLanguage
            })
        });
        if (!response.ok) {
            const payload = await response.json().catch(() => ({}));
            throw new Error(payload.error || `TTS HTTP ${response.status}`);
        }
        const bytes = new Uint8Array(await response.arrayBuffer());
        return bytes.length;
    }

    async function replaySpeechMessage(text, button) {
        if (!text || button?.classList.contains('is-loading')) return;
        document.querySelectorAll('.bn-speech-replay.is-playing,.bn-speech-replay.is-loading').forEach(item => item.classList.remove('is-playing','is-loading'));
        button?.classList.add('is-loading');
        try {
            const result = { epoch: state.epoch, turnId: ++state.turnId };
            const bytes = await playStreamingTts(text, result, 0, 'replay', () => {
                button?.classList.remove('is-loading');
                button?.classList.add('is-playing');
                setReplayIcon(button, true);
            });
            if (!bytes) throw new Error('语音暂时无法播放');
        } catch (error) {
            console.warn('Speech replay failed:', error);
            notify(error.message || '语音播放失败');
        } finally {
            button?.classList.remove('is-loading','is-playing');
            setReplayIcon(button, false);
        }
    }

    function waitBetweenMessages(sequenceId) {
        const delay = 300 + Math.floor(Math.random() * 501);
        return new Promise(resolve => window.setTimeout(() => {
            resolve(sequenceId === state.speechSequenceId);
        }, delay));
    }

    function isCriticalVisualEvent(result, speechType) {
        return speechType === 'visual'
            && result?.decision?.shouldSpeak
            && ['PHONE', 'ABSENT'].includes(result?.decision?.state);
    }

    function releaseFailedVisualCooldown(decision) {
        if (!decision) return;
        state.policyState.lastAnySpokenAt = null;
    }

    async function playMessageSequence(messages, result, priority = 2, speechType = 'visual', onMessage = appendSpeechMessage) {
        const items = normalizeMessages(messages);
        if (!items.length) return 0;
        if (result?.validUntil && Date.now() > Number(result.validUntil)) {
            window.track?.('ai_decision', { engine:'speech', decision:'discard', reason_code:'expired_before_playback', speech_type:speechType });
            emitSpeechLifecycle('expired', { speechType, text:items.join(''), logId:result?.logId });
            return 0;
        }
        if (state.activeSpeechSequence && state.activeSpeechSequence.priority <= priority) return 0;
        if (state.activeSpeechSequence) cancelSpeechSequence();
        const sequenceId = ++state.speechSequenceId;
        state.activeSpeechSequence = { id: sequenceId, priority };
        elements().voiceButton?.classList.add('is-speaking');
        setPresence('speaking');
        beginSpeechMessages();
        emitSpeechLifecycle('generated', { speechType, text:items.join(''), logId:result?.logId });
        let totalBytes = 0;
        let trackedSpeechId = null;
        try {
            const sessionEvent = ['pause','resume','completion'].includes(speechType);
            const criticalVisualEvent = isCriticalVisualEvent(result, speechType);
            if (result.epoch !== state.epoch || state.voiceHeld || (state.paused && !sessionEvent)) return 0;
            const fullText = items.join('');
            const performanceCue = result?.performance;
            if (performanceCue?.pauseBefore && speechType === 'visual') {
                await new Promise(resolve => window.setTimeout(resolve, Math.min(3000, Math.max(0, Number(performanceCue.pauseBefore) || 0))));
                if (sequenceId !== state.speechSequenceId) return 0;
            }
            const shown = new Set();
            const showItem = index => {
                if (shown.has(index) || sequenceId !== state.speechSequenceId) return;
                shown.add(index);
                return onMessage(items[index], index);
            };
            const scheduleCaptions = () => {
                showItem(0);
                emitSpeechLifecycle('displayed', { speechType, text:fullText, logId:result?.logId });
                const totalCharacters = Math.max(1, items.reduce((sum, item) => sum + Array.from(item).length, 0));
                const estimatedDuration = Math.max(1400, Math.min(12000, totalCharacters * 220));
                let passedCharacters = Array.from(items[0]).length;
                for (let index = 1; index < items.length; index += 1) {
                    const delay = Math.round(estimatedDuration * passedCharacters / totalCharacters);
                    window.setTimeout(() => showItem(index), delay);
                    passedCharacters += Array.from(items[index]).length;
                }
            };
            // Critical supervision feedback should be visible immediately instead
            // of waiting for the first TTS audio chunk.
            if (criticalVisualEvent) items.forEach((_, index) => showItem(index));
            const ttsRequestStartedAt = performance.now();
            try {
                const shouldPlayAudio = state.voiceAutoEnabled
                    || (state.companionMode === 'strict' && criticalVisualEvent)
                    || speechType === 'replay'
                    || speechType === 'voice_preview';
                if (!shouldPlayAudio) {
                    items.forEach((_, index) => showItem(index));
                    emitSpeechLifecycle('displayed', { speechType, text:fullText, logId:result?.logId });
                    totalBytes = 0;
                } else {
                    totalBytes = await playStreamingTts(fullText, result, priority, speechType, () => {
                        state.policyState.lastAnySpokenAt = Date.now();
                        scheduleCaptions();
                        if (!trackedSpeechId) {
                            trackedSpeechId = window.track?.speechStarted({
                                source: speechType === 'visual' ? 'vision' : 'ambient', speech_type: speechType,
                                text_len: fullText.length, speech_id: `${result.epoch}-${result.turnId}-${speechType}`
                            });
                            state.activeTrackSpeechId = trackedSpeechId;
                        }
                    });
                }
                window.track?.('api_result', { error_area: 'tts', result: totalBytes ? 'success' : 'suppressed', latency_ms: Math.round(performance.now() - ttsRequestStartedAt) });
            } catch (error) {
                window.track?.('client_error', { error_area: 'tts', error_code: error.name || 'Error' });
                items.forEach((_, index) => showItem(index));
                throw error;
            }
            if (!totalBytes) items.forEach((_, index) => showItem(index));
        } finally {
            if (trackedSpeechId && state.activeTrackSpeechId === trackedSpeechId) {
                window.track?.speechEnded(trackedSpeechId, totalBytes ? 'completed' : 'failed', { tts_bytes: totalBytes });
                state.activeTrackSpeechId = null;
            }
            if (totalBytes) emitSpeechLifecycle('playback_completed', { speechType, text:items.join(''), ttsBytes:totalBytes, logId:result?.logId });
            if (state.activeSpeechSequence?.id === sequenceId) state.activeSpeechSequence = null;
            elements().voiceButton?.classList.remove('is-speaking');
            if (state.sessionActive) setPresence('silent');
        }
        return totalBytes;
    }

    async function analyzeCurrentFrame() {
        if (!state.sessionActive || state.paused || state.voiceHeld || state.voiceInFlight || !state.stream || state.visionInFlight || state.visionUnavailable) return;
        const image = captureFrame();
        if (!image) return;
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        const memoryRequestSequence = beginMemoryRequest();
        const controller = new AbortController();
        const logId = `${requestEpoch}-${turnId}`;
        const startedAt = performance.now();
        state.pipelineController = controller;
        state.visionInFlight = true;
        try {
            const { task, persona, roleContext } = getCompanionContext();
            const sessionStartedAt = new Date(state.sessionStartedAt || Date.now()).toISOString();
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (state.sessionStartedAt || Date.now())) / 1000));
            const recentObservations = state.recentObservations.slice(-24);
            if (state.serverSessionPromise) await state.serverSessionPromise;
            const legacyBody = {
                image, task, persona, roleContext, epoch: requestEpoch, turnId,
                sessionStartedAt, elapsedSeconds, recentObservations,
                workingMemory: state.workingMemory.slice(-24),
                storyMemory: state.storyMemory,
                relationshipMemory: state.relationshipMemory,
                conversationHistory: state.dialogueHistory.slice(-8),
                policyState: state.policyState
            };
            let usingV2 = isBetaSessionRuntime() && state.serverSessionId && !state.serverSessionFailed;
            let response = await fetch((window.APP_BASE || '') + '/api/companion-observe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(usingV2 ? { image, sessionId:state.serverSessionId, turnId, elapsedSeconds } : legacyBody)
            });
            let payload = await response.json().catch(() => ({}));
            if (!response.ok && usingV2 && response.status !== 429) {
                console.warn('V2 observation failed; retrying once with V1:', payload.error || response.status);
                state.serverSessionFailed = true;
                usingV2 = false;
                response = await fetch((window.APP_BASE || '') + '/api/companion-observe', {
                    method:'POST', headers:{ 'Content-Type':'application/json' }, signal:controller.signal,
                    body:JSON.stringify(legacyBody)
                });
                payload = await response.json().catch(() => ({}));
            }
            if (response.status === 503) {
                state.visionUnavailable = true;
                stopVisionLoop();
                notify('视觉模型待配置');
                return;
            }
            if (!response.ok) throw new Error(payload.error || `Vision HTTP ${response.status}`);
            const result = payload?.data || payload;
            if (result.stateVersion) state.serverSessionVersion = result.stateVersion;
            if (requestEpoch !== state.epoch || state.paused || !state.sessionActive) return;
            if (!result?.decision) throw new Error('AI 没有返回发言决策');
            result.logId = logId;
            window.track?.('ai_decision', {
                engine: 'vision', decision: result.decision.shouldSpeak ? 'speak' : 'silent',
                decision_id: result.decision.decisionId || '',
                evidence_event_ids: result.decision.evidenceEventIds || [],
                should_speak: Boolean(result.decision.shouldSpeak), reason_code: result.decision.reason || 'unspecified',
                state: result.decision.state || result.state || 'unknown',
                raw_state: result.decision.rawState || 'unknown',
                confidence: Number(result.decision.confidence) || 0,
                phone_visible: Boolean(result.decision.phoneVisible),
                state_changed: Boolean(result.decision.stateChanged),
                event: result.decision.event || '',
                speech_mode: result.decision.speechMode || 'generated',
                vision_ms: result.timings?.visionMs,
                reaction_ms: result.timings?.reactionMs,
                total_ms: result.timings?.totalMs
                ,protocol: result.metrics?.session?.protocol || 'v1'
            });
            state.policyState = result.decision.policyState || state.policyState;
            setPresence(result.decision.shouldSpeak ? 'speaking' : (result.decision.silentReaction || 'silent'));
            applyStoryMemory(result.memory, memoryRequestSequence);
            state.latestObservation = {
                capturedAt: Date.now(),
                scene: result.observation?.scene || '',
                state: result.decision.state || 'UNKNOWN'
            };
            const memoryEvent = createMemoryEvent('vision', {
                observedAt: result.observation?.observedAt || new Date().toISOString(),
                elapsedSeconds,
                scene: result.observation?.scene || '',
                observation: result.observation?.observation || result.observation?.scene || '',
                changes: result.observation?.changes || [],
                confidence: result.observation?.confidence,
                reaction: result.reaction
            });
            memoryEvent.state = result.decision.state || 'UNKNOWN';
            state.recentObservations.push(memoryEvent);
            state.recentObservations = state.recentObservations.slice(-24);
            appendWorkingMemory(memoryEvent);
            window.dispatchEvent(new CustomEvent('focus-companion-result', { detail: result }));
            saveLog({
                id: logId,
                createdAt: new Date().toISOString(),
                status: 'success',
                epoch: requestEpoch,
                turnId,
                decisionId: result.decision.decisionId || '',
                decisionReason: result.decision.reason || '',
                evidenceEventIds: Array.isArray(result.decision.evidenceEventIds) ? result.decision.evidenceEventIds : [],
                validUntil: result.decision.validUntil || null,
                memoryShouldUpdateStory: Boolean(result.memory?.shouldUpdateStory),
                memoryCurrentSituation: result.memory?.currentSituation || '',
                memoryBehaviorChange: result.memory?.behaviorChange || '',
                memoryResponseIntent: result.memory?.responseIntent || '',
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
                let ttsBytes = 0;
                try {
                    ttsBytes = await playMessageSequence(messages, result, 2, 'visual');
                } catch (error) {
                    if (state.companionMode === 'strict' && isCriticalVisualEvent(result, 'visual')) {
                        releaseFailedVisualCooldown(result.decision);
                    }
                    if (error.name !== 'AbortError') saveLog({ id: logId, ttsStatus: 'failed', ttsBytes: 0, error: error.message || 'TTS failed' });
                    throw error;
                }
                if (ttsBytes) state.lastEventOrDialogueAt = Date.now();
                if (!ttsBytes && state.companionMode === 'strict' && isCriticalVisualEvent(result, 'visual')) {
                    releaseFailedVisualCooldown(result.decision);
                    window.track?.('ai_decision', {
                        engine: 'vision', decision: 'retry', reason_code: 'critical_tts_not_played',
                        state: result.decision.state, event: result.decision.event
                    });
                }
                saveLog({ id: logId, ttsStatus: ttsBytes ? 'completed' : 'suppressed', ttsBytes });
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                window.track?.('client_error', { error_area: 'vision', error_code: error.name || 'Error' });
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
        const runNext = async () => {
            state.visionTimer = null;
            if (!state.sessionActive || state.paused || !state.stream || state.visionUnavailable) return;
            await analyzeCurrentFrame();
            if (!state.sessionActive || state.paused || !state.stream || state.visionUnavailable) return;
            state.visionTimer = window.setTimeout(runNext, VISION_INTERVAL_MS);
        };
        state.visionTimer = window.setTimeout(runNext, VISION_INITIAL_DELAY_MS);
    }

    function stopVisionLoop() {
        if (state.visionTimer) {
            window.clearTimeout(state.visionTimer);
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
            announceSessionEvent('pause');
        } else if (state.sessionActive) {
            if (state.stream) startVisionLoop();
            announceSessionEvent('resume');
            if (openingElapsedMs() < 120000 && (!state.openingAmbientDone || !state.openingEventDone)) {
                addOpeningTimer(state.openingAmbientDone ? runOpeningEvent : runOpeningAmbient, 1000);
            }
        }
    }

    function stopAmbientLoop() {
        // 中途定时鼓励已移除。保留空函数供旧生命周期调用安全过渡。
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
            const lineResponse = await fetch((window.APP_BASE || '') + '/api/companion-observe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'ambient', type: 'opening', task, persona, roleContext, elapsedSeconds: 0, epoch: preloadEpoch, turnId: preloadTurnId })
            });
            const linePayload = await lineResponse.json().catch(() => ({}));
            if (!lineResponse.ok) throw new Error(linePayload.error || '开场台词预生成失败');
            const messages = normalizeMessages(linePayload.data?.messages, linePayload.data?.reaction);
            if (!messages.length) throw new Error('开场台词为空');
            const audioResponse = await fetch((window.APP_BASE || '') + '/api/tts-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: messages.join(''), epoch: preloadEpoch, turnId: preloadTurnId, speechType: 'opening', voiceType: roleContext.voiceType, voiceProvider: roleContext.voiceProvider, voiceId: roleContext.voiceId })
            });
            if (!audioResponse.ok) throw new Error('开场语音预生成失败');
            state.preparedOpening = {
                messages,
                bytes: new Uint8Array(await audioResponse.arrayBuffer()),
                sampleRate: Number(audioResponse.headers.get('x-audio-sample-rate')) || 24000,
                format: audioResponse.headers.get('x-audio-format') || 'pcm_s16le'
            };
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
        if (!state.voiceAutoEnabled) {
            beginSpeechMessages();
            prepared.messages.forEach(message => appendSpeechMessage(message));
            state.openingAmbientDone = true;
            state.preparedOpening = null;
            return true;
        }
        await ensureAudio();
        if (state.activeSpeechSequence) return false;
        const sequenceId = ++state.speechSequenceId;
        state.activeSpeechSequence = { id: sequenceId, priority: 4 };
        beginSpeechMessages();
        if (sequenceId !== state.speechSequenceId || !state.sessionActive || state.voiceHeld) return false;
        let resolveFinished;
        const finished = new Promise(resolve => { resolveFinished = resolve; });
        const playback = {
            epoch: state.epoch,
            controller: new AbortController(),
            sources: new Set(),
            nextPlayTime: 0,
            carry: null,
            sampleRate: prepared.sampleRate,
            streamEnded: false,
            priority: 4,
            speechType: 'opening',
            text: prepared.messages.join(''),
            started: false,
            resolveFinished
        };
        state.playback = playback;
        playback.started = true;
        emitSpeechLifecycle('playback_started', { speechType:'opening', text:playback.text });
        state.policyState.lastAnySpokenAt = Date.now();
        const trackedSpeechId = window.track?.speechStarted({
            source: 'opening', speech_type: 'opening', text_len: prepared.messages.join('').length,
            speech_id: `${state.epoch}-prepared-opening`
        });
        state.activeTrackSpeechId = trackedSpeechId;
        const encodedDuration = prepared.format === 'mp3' ? await scheduleEncodedAudio(prepared.bytes, playback) : 0;
        if (prepared.format !== 'mp3') schedulePcmChunk(prepared.bytes, playback);
        const totalCharacters = Math.max(1, prepared.messages.reduce((sum, item) => sum + Array.from(item).length, 0));
        const durationMs = encodedDuration ? encodedDuration * 1000 : prepared.bytes.length / (prepared.sampleRate * 2) * 1000;
        let passedCharacters = 0;
        prepared.messages.forEach((text, index) => {
            const delay = TTS_BUFFER_MS + 60 + durationMs * passedCharacters / totalCharacters;
            window.setTimeout(() => {
                if (sequenceId === state.speechSequenceId) appendSpeechMessage(text);
            }, delay);
            passedCharacters += Array.from(text).length;
        });
        playback.streamEnded = true;
        finishPlaybackIfDone(playback);
        if (!await finished || sequenceId !== state.speechSequenceId) return false;
        if (trackedSpeechId && state.activeTrackSpeechId === trackedSpeechId) {
            window.track?.speechEnded(trackedSpeechId, 'completed', { tts_bytes: prepared.bytes.length });
            emitSpeechLifecycle('playback_completed', { speechType:'opening', text:playback.text, ttsBytes:prepared.bytes.length });
            state.activeTrackSpeechId = null;
        }
        if (state.activeSpeechSequence?.id === sequenceId) state.activeSpeechSequence = null;
        const now = Date.now();
        state.openingAmbientDone = true;
        state.lastAmbientAt = now;
        state.policyState.lastAnySpokenAt = now;
        state.preparedOpening = null;
        prepareOpening();
        return true;
    }

    async function requestAmbientLine(type, extra = {}) {
        const { task, persona, roleContext } = getCompanionContext();
        const elapsedSeconds = Math.max(0, Math.floor(openingElapsedMs() / 1000));
        const response = await fetch((window.APP_BASE || '') + '/api/companion-observe', {
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
            if (!bytes && state.voiceAutoEnabled) return;
            const now = Date.now();
            state.openingAmbientDone = true;
            state.lastAmbientAt = now;
            if (bytes) state.policyState.lastAnySpokenAt = now;
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
            if (!bytes && state.voiceAutoEnabled) return;
            state.openingEventDone = true;
            state.lastEventOrDialogueAt = Date.now();
            if (bytes) state.policyState.lastAnySpokenAt = state.lastEventOrDialogueAt;
        } catch (error) {
            console.warn('Opening event failed:', error);
            if (openingElapsedMs() < 120000) addOpeningTimer(runOpeningEvent, 5000);
        }
    }

    async function announceSessionEvent(type) {
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        const memoryRequestSequence = beginMemoryRequest();
        try {
            const description = type === 'pause' ? '用户刚刚暂停了本次专注。'
                : type === 'resume' ? '用户暂停后重新恢复了本次专注。'
                    : '用户刚刚完成了本次专注。';
            const data = await requestMemoryEvent(type, description, { epoch: requestEpoch, turnId });
            const messages = normalizeMessages(data.messages, data.reaction);
            applyStoryMemory(data.memory, memoryRequestSequence);
            if (!messages.length) return 0;
            const bytes = await playMessageSequence(messages, { epoch:requestEpoch, turnId, performance:data.performance }, 1, type);
            if (bytes) appendWorkingMemory(createMemoryEvent('ai_speech', {
                elapsedSeconds: Math.floor(openingElapsedMs() / 1000), observation:`AI 对用户说：${messages.join('')}`,
                reaction:messages.join('\n'), confidence:1, delivered:true
            }));
            return bytes;
        } catch (error) {
            console.warn(`Session ${type} announcement failed:`, error);
            return 0;
        }
    }

    async function reactToStageTap() {
        if (!state.sessionActive || state.paused) return;
        state.stageTapCount += 1;
        if (state.stageTapTimer) window.clearTimeout(state.stageTapTimer);
        state.stageTapTimer = window.setTimeout(() => { state.stageTapCount = 0; }, 3000);
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        const memoryRequestSequence = beginMemoryRequest();
        const description = `用户在3秒内点击了角色${state.stageTapCount}次。`;
        try {
            const data = await requestMemoryEvent('stage_tap', description, { epoch:requestEpoch, turnId });
            const messages = normalizeMessages(data.messages, data.reaction);
            applyStoryMemory(data.memory, memoryRequestSequence);
            if (messages.length) {
                const bytes = await playMessageSequence(messages, { epoch:requestEpoch, turnId, performance:data.performance }, 1, 'stage_tap');
                if (bytes) appendWorkingMemory(createMemoryEvent('ai_speech', {
                    elapsedSeconds:Math.floor(openingElapsedMs() / 1000), observation:`AI 对用户说：${messages.join('')}`,
                    reaction:messages.join('\n'), confidence:1, delivered:true
                }));
            }
        } catch (error) {
            console.warn('Stage tap memory event failed:', error);
        }
    }

    async function requestMemoryEvent(eventType, eventDescription, ids = {}) {
        state.pipelineController?.abort();
        state.pipelineController = null;
        state.memoryEventController?.abort();
        const controller = new AbortController();
        state.memoryEventController = controller;
        const { task, persona, roleContext } = getCompanionContext();
        const elapsedSeconds = Math.max(0, Math.floor(openingElapsedMs() / 1000));
        appendWorkingMemory(createMemoryEvent('session', { elapsedSeconds, observation:eventDescription, confidence:1, delivered:true }));
        const response = await fetch((window.APP_BASE || '') + '/api/companion-observe', {
            method:'POST', headers:{ 'Content-Type':'application/json' }, signal:controller.signal,
            body:JSON.stringify({
                mode:'memory_event', eventType, eventDescription, task, persona, roleContext, elapsedSeconds,
                workingMemory:state.workingMemory.slice(-24), storyMemory:state.storyMemory,
                relationshipMemory:state.relationshipMemory, conversationHistory:state.dialogueHistory.slice(-8), ...ids
            })
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Memory event HTTP ${response.status}`);
        if (state.memoryEventController === controller) state.memoryEventController = null;
        return payload.data || {};
    }

    async function startVoiceInput() {
        if (!state.sessionActive || state.audioStream || state.voiceInFlight || !navigator.mediaDevices?.getUserMedia) return;
        state.voiceHeld = true;
        window.track?.interaction('voice_input_started');
        state.voiceCancelled = false;
        state.dialogueController?.abort();
        state.dialogueController = null;
        cancelReaction('用户开始说话');
        try {
            if (navigator.audioSession) {
                state.previousAudioSessionType = navigator.audioSession.type;
                try { navigator.audioSession.type = 'play-and-record'; } catch (_) {}
            }
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    channelCount: 1
                },
                video: false
            });
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
                if (recorder.cancelled) return;
                window.dispatchEvent(new CustomEvent('focus-voice-captured', { detail: { blob } }));
                await transcribeVoice(blob);
            }, { once: true });
            recorder.start();
            const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (Recognition) {
                const recognition = new Recognition();
                recognition.lang = 'zh-CN';
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.addEventListener('result', event => {
                    const text = [...event.results].map(result => result[0]?.transcript || '').join('').trim();
                    if (text) window.dispatchEvent(new CustomEvent('focus-voice-live', { detail:{ text } }));
                });
                recognition.addEventListener('end', () => { if (state.speechRecognition === recognition) state.speechRecognition = null; });
                try { recognition.start(); state.speechRecognition = recognition; } catch (_) {}
            }
            const { voiceButton } = elements();
            voiceButton?.classList.add('is-listening');
            setPresence('listening');
            voiceButton?.setAttribute('aria-label', '松开结束语音');
            setCaption('我在听……');
        } catch (error) {
            if (navigator.audioSession) {
                try { navigator.audioSession.type = state.previousAudioSessionType || 'playback'; } catch (_) {}
            }
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
            const response = await fetch((window.APP_BASE || '') + '/api/speech', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ audio })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Speech HTTP ${response.status}`);
            const text = payload?.data?.text?.trim();
            if (text) {
                window.track?.interaction('voice_input_result', { result: 'success', message_length: text.length });
                notify('语音识别完成');
                window.dispatchEvent(new CustomEvent('focus-voice-result', { detail: { text } }));
                await respondToVoice(text);
            } else {
                window.track?.interaction('voice_input_result', { result: 'no_speech' });
                setCaption('刚才没有听清，再说一次？');
                notify('没有识别到文字');
            }
        } catch (error) {
            window.track?.interaction('voice_input_result', { result: 'error' });
            console.warn('Voice transcription failed:', error);
            setCaption('刚才没听清，再试一次？');
            notify(error.message || '语音识别失败');
        } finally {
            state.voiceInFlight = false;
            voiceButton?.classList.remove('is-processing');
            if (voiceButton) voiceButton.setAttribute('aria-label', `和${voiceButton.dataset.roleName || '角色'}说话`);
        }
    }

    async function respondToVoice(text, options = {}) {
        if (!text) return;
        cancelReaction('用户主动发言');
        state.memoryEventController?.abort();
        state.memoryEventController = null;
        const memoryCommand = window.companionMemoryCommand?.parseMemoryCommand(text);
        if (memoryCommand?.type === 'forget_recent') {
            forgetRecentContext();
            const acknowledgement = '好，我不会记住刚才的内容。';
            appendConversationMessage(text, 'user');
            appendConversationMessage(acknowledgement, 'assistant');
            setCaption(acknowledgement);
            return;
        }
        const { caption } = elements();
        if (caption && caption.id !== 'ocMessageText' && !caption.querySelector('.bn-speech-message')) caption.replaceChildren();
        const requestEpoch = state.epoch;
        const turnId = ++state.turnId;
        const memoryRequestSequence = beginMemoryRequest();
        const controller = new AbortController();
        state.dialogueController = controller;
        const { task, persona, roleContext } = getCompanionContext();
        const elapsedSeconds = Math.max(0, Math.floor((Date.now() - (state.sessionStartedAt || Date.now())) / 1000));
        const scene = state.latestObservation && Date.now() - state.latestObservation.capturedAt <= 120000
            ? state.latestObservation.scene : '';
        const history = state.dialogueHistory.slice(-6);
        if (!options.hideUserMessage) {
            state.dialogueHistory.push({ role: 'user', content: text });
            appendWorkingMemory(createMemoryEvent('user_speech', { elapsedSeconds, observation: `用户说：${text}`, confidence: 1, delivered: true }));
            appendConversationMessage(text, 'user');
        }
        appendConversationMessage('正在想……', 'assistant', true);
        try {
            const response = await fetch((window.APP_BASE || '') + '/api/companion-observe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    mode: 'dialogue', text, task, persona, roleContext, elapsedSeconds, scene, history,
                    workingMemory: state.workingMemory.slice(-24), storyMemory: state.storyMemory,
                    relationshipMemory: state.relationshipMemory, epoch: requestEpoch, turnId
                })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(payload.error || `Dialogue HTTP ${response.status}`);
            if (requestEpoch !== state.epoch || state.voiceHeld || state.paused) return;
            const messages = normalizeMessages(payload.data?.messages, payload.data?.reaction);
            if (!messages.length) throw new Error('AI 没有生成回复');
            applyStoryMemory(payload.data?.memory, memoryRequestSequence);
            const reaction = messages.join('\n');
            state.dialogueHistory.push({ role: 'assistant', content: reaction });
            state.dialogueHistory = state.dialogueHistory.slice(-6);
            window.dispatchEvent(new CustomEvent('focus-dialogue-spoken', { detail: { text, reaction, messages } }));
            const bytes = await playMessageSequence(messages, { epoch: requestEpoch, turnId, performance: payload.data?.performance }, 1, options.speechType || 'dialogue');
            if (bytes) {
                state.lastEventOrDialogueAt = Date.now();
                state.policyState.lastAnySpokenAt = state.lastEventOrDialogueAt;
                appendWorkingMemory(createMemoryEvent('ai_speech', { elapsedSeconds, observation: `AI 对用户说：${reaction}`, reaction, confidence: 1, delivered: true }));
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

    function stopVoiceInput(cancel = false) {
        state.voiceCancelled = Boolean(cancel);
        state.voiceHeld = false;
        if (state.speechRecognition) {
            try { cancel ? state.speechRecognition.abort() : state.speechRecognition.stop(); } catch (_) {}
            state.speechRecognition = null;
        }
        const recorder = state.mediaRecorder;
        state.mediaRecorder = null;
        if (recorder && recorder.state !== 'inactive') {
            recorder.cancelled = Boolean(cancel);
            recorder.stop();
        }
        if (state.audioStream) {
            state.audioStream.getTracks().forEach(track => track.stop());
            state.audioStream = null;
        }
        if (navigator.audioSession) {
            const restoreType = state.previousAudioSessionType || 'playback';
            window.setTimeout(() => {
                try { navigator.audioSession.type = restoreType === 'auto' ? 'playback' : restoreType; } catch (_) {}
            }, 80);
        }
        const { voiceButton } = elements();
        voiceButton?.classList.remove('is-listening');
        if (state.sessionActive && !state.playback) setPresence('silent');
        if (voiceButton) voiceButton.setAttribute('aria-label', `和${voiceButton.dataset.roleName || '角色'}说话`);
    }

    function invalidateMemoryRequests() {
        state.pipelineController?.abort();
        state.dialogueController?.abort();
        state.memoryEventController?.abort();
        state.pipelineController = null;
        state.dialogueController = null;
        state.memoryEventController = null;
        state.memoryRequestSequence += 1;
        state.latestAppliedMemoryRequest = state.memoryRequestSequence;
    }

    function forgetRecentContext() {
        invalidateMemoryRequests();
        state.workingMemory = [];
        state.recentObservations = [];
        state.storyMemory = null;
        state.dialogueHistory = [];
        state.latestObservation = null;
    }

    window.focusCompanion = {
        startSession,
        stopSession,
        completeSession,
        startCamera,
        stopCamera,
        toggleCamera,
        analyzeCurrentFrame,
        startVoiceInput,
        stopVoiceInput,
        sendDialogue: text => respondToVoice(String(text || '').trim()),
        setPaused,
        configureMode,
        setVoiceAutoEnabled,
        isRelationshipMemoryEnabled: () => state.relationshipMemoryEnabled,
        getRelationshipMemory: () => state.relationshipMemory,
        setRelationshipMemoryEnabled: enabled => {
            state.relationshipMemoryEnabled = Boolean(enabled);
            localStorage.setItem('bnRelationshipMemoryEnabled', String(state.relationshipMemoryEnabled));
            if (!state.relationshipMemoryEnabled) state.relationshipMemory = null;
            else {
                try { state.relationshipMemory = JSON.parse(localStorage.getItem(RELATIONSHIP_MEMORY_KEY) || 'null'); }
                catch (_) { state.relationshipMemory = null; }
            }
            window.dispatchEvent(new CustomEvent('focus-relationship-memory-updated', { detail:{ relationshipMemory:state.relationshipMemory } }));
        },
        replaceRelationshipMemory: memory => {
            if (!memory || typeof memory !== 'object') return false;
            state.relationshipMemory = memory;
            localStorage.setItem(RELATIONSHIP_MEMORY_KEY, JSON.stringify(memory));
            window.dispatchEvent(new CustomEvent('focus-relationship-memory-updated', { detail:{ relationshipMemory:memory } }));
            return true;
        },
        clearRelationshipMemory: () => {
            state.relationshipMemory = null;
            localStorage.removeItem(RELATIONSHIP_MEMORY_KEY);
            window.dispatchEvent(new CustomEvent('focus-relationship-memory-updated', { detail:{ relationshipMemory:null } }));
        },
        forgetCurrentSessionMemory: forgetRecentContext,
        requestStrictCameraPermission,
        announceSessionEvent,
        reactToStageTap,
        prepareOpening,
        unlockAudio: ensureAudio,
        createSpeechTurn: () => ({ epoch: state.epoch, turnId: ++state.turnId }),
        speakMessages: (messages, turn, speechType = 'session_opening', onMessage) => playMessageSequence(messages, turn, 1, speechType, onMessage),
        markMeetingComplete: () => { state.preparedOpening = null; },
        previewVoice: voice => {
            const settings = typeof voice === 'string' ? { voiceType: voice } : (voice || {});
            cancelSpeechSequence('new_voice_preview');
            return playMessageSequence([
                settings.speechLanguage === 'en'
                    ? 'Ready? Let’s focus together. I’ll stay right here with you.'
                    : '准备好了吗？今天也一起专注吧。我就在这里陪你。'
            ], {
                epoch: state.epoch,
                turnId: ++state.turnId,
                ...settings
            }, 1, 'voice_preview').catch(error => {
                console.warn('Voice preview failed:', error);
                notify(error.message || '语音试听失败');
                return 0;
            });
        },
        isCameraEnabled: () => Boolean(state.stream)
    };

    window.toggleFocusCamera = toggleCamera;
    if (window.APP_BASE !== '/beta' && new URLSearchParams(location.search).get('mode') !== 'beta') window.setTimeout(prepareOpening, 0);
    window.addEventListener('pagehide', stopSession);
})();
