(function () {
  'use strict';

  const state = {
    tab: 'home',
    captionIndex: 0,
    captionTimer: null,
    refreshTimer: null,
    chatObserver: null,
    toastTimer: null,
    voiceAudio: null,
    voiceLoopTimer: null,
    lastVoiceTake: 0,
    voiceTake: Number(localStorage.getItem('bnVoiceTake')) || 1
  };

  const captions = [
    '翻了页书，继续陪你。',
    '刚喝了口水，你也记得喝。',
    '我就在旁边，不用管我。',
    '调了下坐姿，你继续忙。',
    '外面好像安静下来了。'
  ];

  const fallbackAvatar = 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=300&h=300&fit=crop&crop=face';

  function currentOC() {
    if (typeof ocData !== 'undefined' && Array.isArray(ocData) && ocData.length) {
      return ocData[currentOCIndex] || ocData[0];
    }
    return { name: '你的 TA', userTitle: '你', avatar: fallbackAvatar, relationship: '学习搭子' };
  }

  function escapeText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDate() {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    }).format(new Date()).replace(/星期/, ' · 星期');
  }

  function renderShell() {
    const app = document.createElement('main');
    app.id = 'bnApp';
    app.className = 'bn-app';
    app.innerHTML = `
      <section class="bn-screen is-active" data-bn-screen="home">
        <div class="bn-home-top">
          <div><div class="bn-eyebrow"><span class="bn-dot"></span>伴柠番茄钟</div><div class="bn-date" id="bnDate"></div></div>
          <div class="bn-online"><i></i>TA 在等你</div>
        </div>
        <div class="bn-hero">
          <div class="bn-polaroid"><img id="bnHomeAvatar" alt="OC 头像"></div>
          <div><h1 class="bn-greeting" id="bnGreeting"></h1><p class="bn-greeting-sub" id="bnGreetingSub"></p></div>
        </div>
        <button class="bn-primary" type="button" data-bn-go="focus">🍅&nbsp; 开始专注</button>
        <div class="bn-card bn-story"><div class="bn-story-icon">🎁</div><div><p id="bnStoryText"></p><button type="button" data-bn-action="gifts">看看 TA 准备了什么 →</button></div></div>
        <div class="bn-section-head"><h2>今日完成</h2><span id="bnTaskCount">0 件</span></div>
        <div class="bn-card bn-task-list" id="bnTaskList"></div>
        <div class="bn-section-head"><h2>收到的礼物</h2><button type="button" data-bn-action="gifts">查看全部</button></div>
        <div class="bn-gifts" id="bnGiftList"></div>
      </section>

      <section class="bn-screen" data-bn-screen="focus">
        <div id="bnFocusSetup">
          <div class="bn-eyebrow"><span class="bn-dot"></span>专注</div>
          <div class="bn-segment"><button class="is-active" type="button">准备开始</button><button type="button" data-bn-action="show-running">专注中</button></div>
          <label class="bn-field-label">专注时长</label>
          <div class="bn-durations">
            <button class="bn-duration" data-bn-minutes="10"><b>10</b><small>短专注</small></button>
            <button class="bn-duration is-active" data-bn-minutes="25"><b>25</b><small>标准</small></button>
            <button class="bn-duration" data-bn-minutes="50"><b>50</b><small>深度</small></button>
            <button class="bn-duration" data-bn-minutes="custom"><b>···</b><small>自定义</small></button>
          </div>
          <label class="bn-field-label" for="bnTaskInput">这次想完成什么</label>
          <input class="bn-task-input" id="bnTaskInput" maxlength="60" placeholder="例如：复习英语单词">
          <label class="bn-field-label">TA 现在陪你做什么</label>
          <div class="bn-statuses">
            <button class="bn-status is-active" data-bn-status="学习" data-bn-icon="📚">📚 学习</button>
            <button class="bn-status" data-bn-status="工作" data-bn-icon="💼">💼 工作</button>
            <button class="bn-status" data-bn-status="冒险" data-bn-icon="🗺️">🗺️ 冒险</button>
            <button class="bn-status" data-bn-status="逛街" data-bn-icon="🛍️">🛍️ 逛街</button>
            <button class="bn-status" data-bn-status="玩游戏" data-bn-icon="🎮">🎮 玩游戏</button>
            <button class="bn-status" data-bn-status="自定义" data-bn-icon="✨">＋ 更多</button>
          </div>
          <div class="bn-focus-hint" id="bnFocusHint"></div>
          <button class="bn-primary" type="button" data-bn-action="start-focus">开始专注 →</button>
        </div>
      </section>

      <section class="bn-screen bn-focus-running" data-bn-screen="running">
        <div class="bn-stage"><img class="bn-stage-img" id="bnStageImage" alt="OC 陪伴场景"></div>
        <div class="bn-call-top"><span><i></i><span id="bnCallName"></span> · 陪伴中</span><button class="bn-close-focus" type="button" data-bn-action="stop-focus">×</button></div>
        <div class="bn-call-task" id="bnCallTask">📖 专注中</div>
        <div class="bn-caption" id="bnCaption"></div>
        <div class="bn-call-bottom">
          <div class="bn-call-time" id="bnTimer">25:00</div><div class="bn-call-sub">剩余专注时间</div>
          <div class="bn-controls">
            <button class="bn-control" type="button" data-bn-go="chat" aria-label="切到聊天">💬</button>
            <button class="bn-control is-primary" id="bnPause" type="button" data-bn-action="pause-focus" aria-label="暂停">⏸</button>
            <button class="bn-control" type="button" data-bn-action="next-caption" aria-label="换一句陪伴语">↻</button>
            <button class="bn-control" type="button" data-bn-action="play-voice" aria-label="播放陪伴语音">🔊</button>
          </div>
        </div>
      </section>

      <section class="bn-screen" data-bn-screen="chat">
        <div class="bn-chat-head"><img class="bn-avatar" id="bnChatAvatar" alt="OC"><div><h1 id="bnChatName"></h1><p>你的学习搭子 · 在线</p></div></div>
        <div class="bn-chat-messages" id="bnChatMessages"></div>
        <form class="bn-chat-form" id="bnChatForm"><input id="bnChatInput" autocomplete="off" placeholder="说点什么…"><button type="submit" aria-label="发送">↑</button></form>
      </section>

      <section class="bn-screen" data-bn-screen="oc">
        <div class="bn-eyebrow"><span class="bn-dot"></span>我的 TA</div>
        <div class="bn-card bn-id-card">
          <div class="bn-polaroid"><img id="bnOCAvatar" alt="当前 OC"></div>
          <div><h1 id="bnOCName"></h1><p id="bnOCRelation"></p><div class="bn-traits"><span>温柔守护型</span><span>陪伴者</span></div></div>
          <button class="bn-edit" type="button" data-bn-action="edit-oc" aria-label="编辑角色">✎</button>
        </div>
        <div class="bn-section-head"><h2>我的角色</h2><span id="bnOCCount"></span></div>
        <div class="bn-oc-pool" id="bnOCPool"></div>
        <div class="bn-section-head"><h2>相处设置</h2><span>偶尔调整就好</span></div>
        <div class="bn-card bn-accordion">
          <div class="bn-acc"><button class="bn-acc-head" type="button"><span class="bn-acc-icon">🎭</span><span class="bn-acc-copy"><b>性格与人设</b><small>语气风格、专属人设描述</small></span><span>⌄</span></button><div class="bn-acc-body">温柔守护、成熟包容，以及你为 TA 写下的完整人物设定。 <button class="bn-link-button" data-bn-action="edit-oc">编辑</button></div></div>
          <div class="bn-acc"><button class="bn-acc-head" type="button"><span class="bn-acc-icon">🎁</span><span class="bn-acc-copy"><b>礼物设置</b><small>完成任务时随机送出</small></span><span>⌄</span></button><div class="bn-acc-body">学习、工作、休息等不同状态可以拥有独立礼物。 <button class="bn-link-button" data-bn-action="edit-oc">管理</button></div></div>
          <div class="bn-acc"><button class="bn-acc-head" type="button"><span class="bn-acc-icon">⏰</span><span class="bn-acc-copy"><b>提醒管理</b><small>系统通知和定时提醒</small></span><span>⌄</span></button><div class="bn-acc-body">保留现有 Web Push、提醒时间和通知权限设置。 <button class="bn-link-button" data-bn-action="advanced">管理</button></div></div>
          <div class="bn-acc"><button class="bn-acc-head" type="button"><span class="bn-acc-icon">🔊</span><span class="bn-acc-copy"><b>陪伴语音</b><small>ElevenLabs v3 候选音色</small></span><span>⌄</span></button><div class="bn-acc-body">试听并选择当前 OC 的固定音色。<div class="bn-voice-options"><button class="bn-voice-option" type="button" data-bn-voice="1">候选 1</button><button class="bn-voice-option" type="button" data-bn-voice="2">候选 2</button><button class="bn-voice-option" type="button" data-bn-voice="3">候选 3</button></div><div class="bn-voice-note">点击即可试听并保存；开始专注时会播放所选语音。</div></div></div>
        </div>
        <button class="bn-advanced" type="button" data-bn-action="advanced">高级设置</button>
      </section>

      <nav class="bn-tabbar" aria-label="主导航">
        <button class="bn-tab is-active" type="button" data-bn-go="home"><b>🏠</b>首页</button>
        <button class="bn-tab" type="button" data-bn-go="focus"><b>🍅</b>专注</button>
        <button class="bn-tab" type="button" data-bn-go="chat"><b>💬</b>聊天</button>
        <button class="bn-tab" type="button" data-bn-go="oc"><b>🎀</b>我的 TA</button>
      </nav>
      <div class="bn-toast" id="bnToast"></div>
    `;
    document.body.insertBefore(app, document.body.firstChild);
    const legacyBack = document.createElement('button');
    legacyBack.id = 'bnLegacyBack';
    legacyBack.className = 'bn-legacy-back';
    legacyBack.type = 'button';
    legacyBack.textContent = '← 返回新版界面';
    document.body.appendChild(legacyBack);
  }

  function switchTab(tab) {
    if (tab === 'focus' && (isTimerRunning || isPaused)) tab = 'running';
    if (tab === 'focus' && typeof goToFocus === 'function' && !isTimerRunning && !isPaused) goToFocus();
    if (tab === 'chat') prepareChat();
    state.tab = tab;
    document.querySelectorAll('[data-bn-screen]').forEach(el => el.classList.toggle('is-active', el.dataset.bnScreen === tab));
    document.querySelectorAll('.bn-tab').forEach(el => el.classList.toggle('is-active', el.dataset.bnGo === (tab === 'running' ? 'focus' : tab)));
    document.getElementById('bnApp').classList.toggle('is-running', tab === 'running');
    refreshUI();
  }

  function showLegacy(pageId) {
    const app = document.getElementById('bnApp');
    app.hidden = true;
    document.body.classList.add('bn-show-legacy');
    if (typeof showPage === 'function') showPage(pageId);
  }

  function returnFromLegacy() {
    document.body.classList.remove('bn-show-legacy');
    document.getElementById('bnApp').hidden = false;
    switchTab('home');
  }

  function setDuration(value, button) {
    let minutes = value;
    if (value === 'custom') {
      const input = prompt('请输入专注分钟数（1–120）', String(typeof selectedMinutes !== 'undefined' ? selectedMinutes : 25));
      if (input == null) return;
      minutes = Number(input);
      if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) return toast('请输入 1–120 之间的分钟数');
      button.querySelector('b').textContent = minutes;
      button.querySelector('small').textContent = '自定义';
    } else minutes = Number(value);
    selectedMinutes = minutes;
    currentTime = minutes * 60;
    if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
    document.querySelectorAll('.bn-duration').forEach(el => el.classList.toggle('is-active', el === button));
    refreshUI();
  }

  function setStatus(button) {
    let name = button.dataset.bnStatus;
    if (name === '自定义') {
      const custom = prompt('TA 现在陪你做什么？', '阅读');
      if (!custom || !custom.trim()) return;
      name = custom.trim().slice(0, 10);
      button.textContent = `✨ ${name}`;
    }
    currentStatus = { name, icon: button.dataset.bnIcon || '✨' };
    isStatusSelected = true;
    document.querySelectorAll('.bn-status').forEach(el => el.classList.toggle('is-active', el === button));
    document.getElementById('bnFocusHint').textContent = '';
  }

  function syncTaskInput() {
    const input = document.getElementById('bnTaskInput');
    const name = input.value.trim() || '专注任务';
    const matched = typeof tasks !== 'undefined' ? tasks.find(item => item.title === name) : null;
    currentTask = matched
      ? { name: matched.title, status: matched.status === 'completed' ? '已完成' : '进行中', color: 'blue' }
      : { name, status: '进行中', color: 'blue' };
  }

  function startFocus() {
    syncTaskInput();
    if (!isStatusSelected) {
      const first = document.querySelector('.bn-status[data-bn-status="学习"]');
      setStatus(first);
    }
    if (typeof startStopTimer === 'function') startStopTimer();
    if (isTimerRunning || isPaused) {
      startVoiceLoop();
      switchTab('running');
      startCaptions();
    } else {
      document.getElementById('bnFocusHint').textContent = '请选择 TA 当前的陪伴状态';
    }
  }

  function stopFocusSession() {
    if (!confirm('结束这次专注吗？')) return;
    stopVoiceLoop();
    if (typeof stopTimer === 'function') stopTimer();
    stopCaptions();
    switchTab('focus');
  }

  function pauseFocus() {
    if (typeof pauseResumeTimer === 'function') pauseResumeTimer();
    if (isPaused) stopVoiceLoop();
    else if (isTimerRunning) startVoiceLoop();
    refreshTimer();
  }

  function nextCaption() {
    state.captionIndex = (state.captionIndex + 1) % captions.length;
    document.getElementById('bnCaption').textContent = captions[state.captionIndex];
  }

  function voiceUrl(take) {
    return `/frontend/audio/oc-reminders/gentle-male-v3-take-${String(take).padStart(2, '0')}.mp3`;
  }

  function playSelectedVoice(isPreview, take = state.voiceTake) {
    if (!state.voiceAudio) {
      state.voiceAudio = document.createElement('audio');
      state.voiceAudio.id = 'bnVoicePlayer';
      state.voiceAudio.preload = 'auto';
      state.voiceAudio.setAttribute('playsinline', '');
      state.voiceAudio.setAttribute('webkit-playsinline', '');
      state.voiceAudio.style.position = 'fixed';
      state.voiceAudio.style.width = '1px';
      state.voiceAudio.style.height = '1px';
      state.voiceAudio.style.opacity = '0';
      state.voiceAudio.style.pointerEvents = 'none';
      document.body.appendChild(state.voiceAudio);
    }
    state.voiceAudio.pause();
    state.voiceAudio.currentTime = 0;
    const nextUrl = new URL(voiceUrl(take), location.href).href;
    if (state.voiceAudio.src !== nextUrl) {
      state.voiceAudio.src = nextUrl;
      state.voiceAudio.load();
    }
    state.voiceAudio.volume = 0.9;
    state.voiceAudio.play().then(() => {
      if (isPreview) toast(`正在试听语音 ${take}`);
    }).catch(error => {
      console.warn('陪伴语音播放失败:', error);
      toast('浏览器拦截了播放，请再点一次 🔊');
    });
    return state.voiceAudio;
  }

  function startVoiceLoop() {
    stopVoiceLoop();
    // 必须保持在“开始专注”的用户点击调用栈中，以解锁同一个播放器。
    playRandomVoice();
  }

  function randomVoiceTake() {
    const choices = [1, 2, 3].filter(take => take !== state.lastVoiceTake);
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function playRandomVoice() {
    if (!isTimerRunning || isPaused) return;
    const take = randomVoiceTake();
    state.lastVoiceTake = take;
    const audio = playSelectedVoice(false, take);
    audio.addEventListener('ended', scheduleNextVoice, { once: true });
    audio.addEventListener('error', scheduleNextVoice, { once: true });
  }

  function scheduleNextVoice() {
    if (!isTimerRunning || isPaused) return;
    clearTimeout(state.voiceLoopTimer);
    const delay = 30000 + Math.floor(Math.random() * 20001);
    state.voiceLoopTimer = setTimeout(playRandomVoice, delay);
    console.log(`下一条陪伴语将在 ${Math.round(delay / 1000)} 秒后播放`);
  }

  function stopVoiceLoop() {
    if (state.voiceLoopTimer) clearTimeout(state.voiceLoopTimer);
    state.voiceLoopTimer = null;
    if (state.voiceAudio) {
      state.voiceAudio.pause();
      state.voiceAudio.currentTime = 0;
    }
  }

  function selectVoice(take) {
    state.voiceTake = take;
    localStorage.setItem('bnVoiceTake', String(take));
    updateVoiceButtons();
    playSelectedVoice(true);
  }

  function updateVoiceButtons() {
    document.querySelectorAll('[data-bn-voice]').forEach(button => {
      button.classList.toggle('is-active', Number(button.dataset.bnVoice) === state.voiceTake);
    });
  }

  function startCaptions() {
    stopCaptions();
    nextCaption();
    state.captionTimer = setInterval(nextCaption, 18000);
  }

  function stopCaptions() {
    if (state.captionTimer) clearInterval(state.captionTimer);
    state.captionTimer = null;
  }

  function prepareChat() {
    if (typeof updateChatContext === 'function') updateChatContext();
    if (typeof loadChatHistory === 'function') loadChatHistory();
    mirrorChat();
  }

  function mirrorChat() {
    const source = document.getElementById('chatMessages');
    const target = document.getElementById('bnChatMessages');
    if (!source || !target) return;
    const messages = Array.from(source.querySelectorAll('.chat-message'));
    if (!messages.length) {
      target.innerHTML = `<div class="bn-bubble-row"><img class="bn-bubble-avatar" src="${escapeText(currentOC().avatar || fallbackAvatar)}" alt=""><div class="bn-bubble">我在。想说什么就说，不用先想清楚。</div></div>`;
      return;
    }
    target.innerHTML = messages.map(message => {
      const mine = message.classList.contains('user');
      const content = message.querySelector('.chat-message-bubble');
      const text = content ? content.textContent : message.textContent;
      return `<div class="bn-bubble-row${mine ? ' is-me' : ''}">${mine ? '' : `<img class="bn-bubble-avatar" src="${escapeText(currentOC().avatar || fallbackAvatar)}" alt="">`}<div class="bn-bubble">${escapeText(text)}</div></div>`;
    }).join('');
    target.scrollTop = target.scrollHeight;
  }

  function submitChat(event) {
    event.preventDefault();
    const newInput = document.getElementById('bnChatInput');
    const oldInput = document.getElementById('chatInput');
    const message = newInput.value.trim();
    if (!message || !oldInput) return;
    oldInput.value = message;
    newInput.value = '';
    if (typeof sendChatMessageToOC === 'function') sendChatMessageToOC();
    setTimeout(mirrorChat, 30);
  }

  function renderTasks() {
    const list = document.getElementById('bnTaskList');
    const source = typeof tasks !== 'undefined' && Array.isArray(tasks) ? tasks : [];
    const completed = source.filter(item => item.status === 'completed');
    document.getElementById('bnTaskCount').textContent = `${completed.length} 件`;
    if (!source.length) {
      list.innerHTML = '<div class="bn-empty">今天还没有任务，先从一次专注开始吧。</div>';
      return;
    }
    list.innerHTML = source.slice(0, 5).map(item => `<label class="bn-task"><input type="checkbox" data-bn-task-id="${Number(item.id)}" ${item.status === 'completed' ? 'checked' : ''}><span>${escapeText(item.title)}</span><time>${item.status === 'completed' ? '已完成' : '待完成'}</time></label>`).join('');
  }

  function renderGifts() {
    const list = document.getElementById('bnGiftList');
    const gifts = typeof dailyStats !== 'undefined' && Array.isArray(dailyStats.gifts) ? dailyStats.gifts : [];
    const defaults = ['🏆|学习冠军奖杯', '🍰|奖励小蛋糕', '💌|手写小纸条', '🌙|晚安星星'];
    const items = (gifts.length ? gifts : defaults).slice(0, 4).map(item => {
      const value = typeof item === 'string' ? item : (item.name || item.gift || '🎁|神秘礼物');
      const match = String(value).match(/^(\p{Extended_Pictographic})?\s*[|｜]?\s*(.*)$/u);
      return { icon: match && match[1] ? match[1] : '🎁', label: match && match[2] ? match[2] : String(value) };
    });
    list.innerHTML = items.map(item => `<div class="bn-card bn-gift"><b>${escapeText(item.icon)}</b><span>${escapeText(item.label)}</span></div>`).join('');
  }

  function renderOCPool() {
    const pool = document.getElementById('bnOCPool');
    const list = typeof ocData !== 'undefined' && Array.isArray(ocData) ? ocData : [];
    document.getElementById('bnOCCount').textContent = `${list.length} 个角色`;
    pool.innerHTML = list.map((oc, index) => `<button class="bn-oc-item" type="button" data-bn-oc-index="${index}"><img src="${escapeText(oc.avatar || fallbackAvatar)}" alt=""><span>${escapeText(oc.name || '未命名')}</span></button>`).join('') + '<button class="bn-oc-add" type="button" data-bn-action="new-oc">＋</button>';
  }

  function selectOC(index) {
    currentOCIndex = index;
    localStorage.setItem('currentOCIndex', String(index));
    if (typeof updateCurrentOC === 'function') updateCurrentOC(index);
    refreshUI();
  }

  function refreshTimer() {
    const timer = document.getElementById('bnTimer');
    if (!timer) return;
    const seconds = typeof currentTime === 'number' ? Math.max(0, currentTime) : 0;
    const minutes = Math.floor(seconds / 60);
    timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    const paused = typeof isPaused !== 'undefined' && isPaused;
    document.getElementById('bnPause').textContent = paused ? '▶' : '⏸';
    document.getElementById('bnCallTask').textContent = `${currentStatus && currentStatus.icon ? currentStatus.icon : '📖'} ${currentTask && currentTask.name ? currentTask.name : '专注中'}`;
  }

  function refreshUI() {
    if (state.tab === 'running' && !isTimerRunning && !isPaused) {
      stopCaptions();
      stopVoiceLoop();
      switchTab('focus');
      return;
    }
    const oc = currentOC();
    const name = oc.name || '你的 TA';
    const title = oc.userTitle || '你';
    const avatar = oc.avatar || fallbackAvatar;
    document.getElementById('bnDate').textContent = formatDate();
    document.getElementById('bnHomeAvatar').src = avatar;
    document.getElementById('bnGreeting').textContent = `早安，${title}！`;
    document.getElementById('bnGreetingSub').textContent = `${name}已经在这里，等你一起专注。`;
    const completed = typeof tasks !== 'undefined' ? tasks.filter(item => item.status === 'completed').length : 0;
    document.getElementById('bnStoryText').innerHTML = `今天你们一起完成了 <b>${completed}</b> 件事，${escapeText(name)}还悄悄准备了一份礼物。`;
    ['bnChatAvatar', 'bnOCAvatar'].forEach(id => document.getElementById(id).src = avatar);
    document.getElementById('bnChatName').textContent = name;
    document.getElementById('bnOCName').textContent = name;
    document.getElementById('bnOCRelation').textContent = `${oc.relationship || '你的学习搭子'} · 称呼你「${title}」`;
    document.getElementById('bnCallName').textContent = name;
    renderTasks();
    renderGifts();
    renderOCPool();
    refreshTimer();
  }

  async function loadPrototypeScene() {
    const target = document.getElementById('bnStageImage');
    try {
      const response = await fetch('/%E4%BC%B4%E6%9F%A0%E7%95%AA%E8%8C%84%E9%92%9F_%E4%BA%A7%E5%93%81%E5%8E%9F%E5%9E%8B.html');
      if (!response.ok) throw new Error('prototype not found');
      const html = await response.text();
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const image = parsed.querySelector('.callstage-img');
      if (!image || !image.getAttribute('src')) throw new Error('scene not found');
      target.src = image.getAttribute('src');
    } catch (error) {
      target.src = currentOC().avatar || fallbackAvatar;
      console.warn('原型 Base64 场景图加载失败，已回退到 OC 头像。', error);
    }
  }

  function toast(message) {
    const el = document.getElementById('bnToast');
    el.textContent = message;
    el.classList.add('is-show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => el.classList.remove('is-show'), 2200);
  }

  function bindEvents() {
    document.getElementById('bnApp').addEventListener('click', event => {
      const go = event.target.closest('[data-bn-go]');
      if (go) return switchTab(go.dataset.bnGo);
      const duration = event.target.closest('[data-bn-minutes]');
      if (duration) return setDuration(duration.dataset.bnMinutes, duration);
      const status = event.target.closest('[data-bn-status]');
      if (status) return setStatus(status);
      const voice = event.target.closest('[data-bn-voice]');
      if (voice) return selectVoice(Number(voice.dataset.bnVoice));
      const task = event.target.closest('[data-bn-task-id]');
      if (task && typeof toggleTaskStatus === 'function') {
        toggleTaskStatus(Number(task.dataset.bnTaskId), event);
        setTimeout(refreshUI, 20);
        return;
      }
      const oc = event.target.closest('[data-bn-oc-index]');
      if (oc) return selectOC(Number(oc.dataset.bnOcIndex));
      const action = event.target.closest('[data-bn-action]');
      if (!action) return;
      const type = action.dataset.bnAction;
      if (type === 'start-focus') startFocus();
      if (type === 'show-running') (isTimerRunning || isPaused) ? switchTab('running') : toast('还没有正在进行的专注');
      if (type === 'stop-focus') stopFocusSession();
      if (type === 'pause-focus') pauseFocus();
      if (type === 'next-caption') nextCaption();
      if (type === 'play-voice') playSelectedVoice(false);
      if (type === 'gifts' && typeof showGiftModal === 'function') showGiftModal();
      if (type === 'edit-oc') { if (typeof editOC === 'function') editOC(currentOCIndex); showLegacy('ocSettingPage'); }
      if (type === 'new-oc') { if (typeof createNewOC === 'function') createNewOC(); showLegacy('ocSettingPage'); }
      if (type === 'advanced') showLegacy('homePage');
    });
    document.querySelectorAll('.bn-acc-head').forEach(button => button.addEventListener('click', () => button.parentElement.classList.toggle('is-open')));
    document.getElementById('bnChatForm').addEventListener('submit', submitChat);
    document.getElementById('bnLegacyBack').addEventListener('click', returnFromLegacy);
    document.getElementById('bnTaskInput').addEventListener('change', syncTaskInput);
    const source = document.getElementById('chatMessages');
    if (source) {
      state.chatObserver = new MutationObserver(mirrorChat);
      state.chatObserver.observe(source, { childList: true, subtree: true, characterData: true });
    }
  }

  function wrapLegacyNavigation() {
    const originalBackHome = typeof goBackToHome === 'function' ? goBackToHome : null;
    if (originalBackHome) {
      goBackToHome = function () { originalBackHome(); returnFromLegacy(); };
    }
    const originalBackCards = typeof goBackToOCCards === 'function' ? goBackToOCCards : null;
    if (originalBackCards) {
      goBackToOCCards = function () { originalBackCards(); document.body.classList.add('bn-show-legacy'); };
    }
  }

  function init() {
    renderShell();
    document.body.classList.add('bn-ui-active');
    document.querySelectorAll('body > div:not(#bnApp) .floating, body > div:not(#bnApp) .sparkle').forEach(element => {
      element.style.display = 'none';
    });
    bindEvents();
    wrapLegacyNavigation();
    loadPrototypeScene();
    setTimeout(() => {
      if (!isStatusSelected) setStatus(document.querySelector('.bn-status[data-bn-status="学习"]'));
      refreshUI();
      prepareChat();
      updateVoiceButtons();
      const requested = new URLSearchParams(location.search).get('page');
      if (isTimerRunning || isPaused) switchTab('running');
      else if (['home', 'focus', 'chat', 'oc'].includes(requested)) switchTab(requested);
    }, 120);
    state.refreshTimer = setInterval(refreshUI, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
