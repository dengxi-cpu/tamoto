(function () {
  'use strict';

  const isBetaMode = new URLSearchParams(location.search).get('mode') === 'beta';

  const state = {
    tab: 'home',
    captionIndex: 0,
    captionTimer: null,
    refreshTimer: null,
    chatObserver: null,
    toastTimer: null,
    rainAudio: null,
    rainEnabled: localStorage.getItem('bnRainEnabled') !== 'false',
    betaBackground: '',
    betaMeetingTask: ''
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
      <section class="bn-screen bn-beta-setup${isBetaMode ? ' is-active' : ''}" data-bn-screen="beta-setup">
        <div class="bn-beta-heading">
          <div class="bn-eyebrow"><span class="bn-dot"></span>伴柠内测</div>
          <h1>先让我认识 TA</h1>
          <p>只设置陪伴需要的内容，之后随时可以回来修改。</p>
        </div>
        <form class="bn-beta-form" id="bnBetaRoleForm">
          <label class="bn-beta-background" for="bnBetaBackgroundInput">
            <img id="bnBetaBackgroundPreview" alt="TA 的背景预览">
            <span><b>上传 TA 的背景</b><small>建议使用竖图，作为专注时的主画面</small></span>
            <em>更换图片</em>
          </label>
          <input id="bnBetaBackgroundInput" type="file" accept="image/*" hidden>

          <label class="bn-beta-field"><span>TA 的名字</span><input id="bnBetaName" maxlength="20" placeholder="TA 叫什么？" required></label>
          <label class="bn-beta-field"><span>TA 怎么叫你</span><input id="bnBetaUserTitle" maxlength="20" list="bnBetaTitleOptions" placeholder="例如：大小姐、宝宝、姐姐" required></label>
          <datalist id="bnBetaTitleOptions"><option value="大小姐"><option value="宝宝"><option value="姐姐"><option value="同学"></datalist>
          <label class="bn-beta-field"><span>你们的关系</span><select id="bnBetaRelationship"><option>恋人</option><option>朋友</option><option selected>学习搭子</option><option>家人</option><option value="自定义">自定义</option></select></label>
          <label class="bn-beta-field bn-beta-custom-relation" id="bnBetaCustomRelationWrap" hidden><span>自定义关系</span><input id="bnBetaCustomRelationship" maxlength="20" placeholder="写下你们的关系"></label>
          <label class="bn-beta-field"><span>TA 的人设</span><textarea id="bnBetaPersona" maxlength="3000" rows="7" placeholder="直接粘贴完整人设。可以写性格、说话习惯、相处方式，以及希望 TA 怎么陪你。"></textarea></label>

          <fieldset class="bn-beta-voices"><legend>音色选择</legend><button class="bn-beta-voice is-active" type="button" data-bn-beta-voice="zh_male_ruyayichen_saturn_bigtts" aria-pressed="true"><i>▶</i><span><b>温柔男声</b><small>当前已接入 · 实时 AI 语音</small></span><em>已选择</em></button></fieldset>
          <p class="bn-beta-note">更多真实可用音色会在验证豆包接口后加入，不放置无法播放的假选项。</p>
          <div class="bn-focus-hint" id="bnBetaRoleHint"></div>
          <button class="bn-primary" type="submit">保存并见面 →</button>
        </form>
      </section>

      <section class="bn-screen bn-beta-meeting" data-bn-screen="beta-meeting">
        <img class="bn-beta-meeting-bg" id="bnBetaMeetingBackground" alt="TA 的陪伴背景">
        <div class="bn-beta-meeting-shade"></div>
        <button class="bn-beta-meeting-back" type="button" data-bn-action="beta-edit-role">‹ 修改角色</button>
        <div class="bn-beta-meeting-name"><i></i><span id="bnBetaMeetingName"></span> · 在这里</div>
        <div class="bn-beta-meeting-panel">
          <div class="bn-beta-meeting-caption" id="bnBetaMeetingCaption"></div>
          <form class="bn-beta-task-form" id="bnBetaMeetingForm" hidden>
            <input id="bnBetaMeetingTask" maxlength="60" autocomplete="off" placeholder="这次想完成什么？" required>
            <button type="submit" aria-label="发送任务">↑</button>
          </form>
          <button class="bn-beta-start-together" id="bnBetaStartTogether" type="button" data-bn-action="beta-start-together" hidden>一起开始</button>
        </div>
      </section>

      <section class="bn-screen${isBetaMode ? '' : ' is-active'}" data-bn-screen="home">
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
        <div class="bn-stage">
          <img class="bn-stage-img" id="bnStageImage" alt="OC 陪伴场景">
          <div class="bn-camera-preview" id="bnCameraPreview" hidden>
            <video id="bnCameraVideo" autoplay muted playsinline aria-label="你的摄像头预览"></video>
            <span>我</span>
          </div>
        </div>
        <div class="bn-call-top"><span><i></i><span id="bnCallName"></span> · 陪伴中</span><button class="bn-close-focus" type="button" data-bn-action="stop-focus">×</button></div>
        <div class="bn-call-task" id="bnCallTask">📖 专注中</div>
        <div class="bn-caption" id="bnCaption"></div>
        <div class="bn-call-bottom">
          <div class="bn-call-time" id="bnTimer">25:00</div><div class="bn-call-sub">剩余专注时间</div>
          <div class="bn-controls">
            <button class="bn-control" id="bnCameraBtn" type="button" data-bn-action="toggle-camera" aria-pressed="false" aria-label="开启视频" title="开启视频">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </button>
            <button class="bn-control" id="bnVoiceInputBtn" type="button" aria-label="按住说话" title="按住说话">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8"/></svg>
            </button>
            <button class="bn-control is-primary" id="bnPause" type="button" data-bn-action="pause-focus" aria-label="暂停">⏸</button>
            <button class="bn-control" id="bnRainBtn" type="button" data-bn-action="toggle-rain" aria-pressed="true" aria-label="关闭雨声" title="关闭雨声">🌧️</button>
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
          <div class="bn-acc"><button class="bn-acc-head" type="button"><span class="bn-acc-icon">🔊</span><span class="bn-acc-copy"><b>陪伴语音</b><small>AI 实时语音</small></span><span>⌄</span></button><div class="bn-acc-body">事件提醒、氛围陪伴和语音对话都会使用当前角色的实时 AI 语音。</div></div>
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
  }

  function switchTab(tab) {
    if (tab === 'focus' && (isTimerRunning || isPaused)) tab = 'running';
    if (tab === 'chat') prepareChat();
    if (tab === 'focus') window.focusCompanion?.prepareOpening();
    state.tab = tab;
    document.querySelectorAll('[data-bn-screen]').forEach(el => el.classList.toggle('is-active', el.dataset.bnScreen === tab));
    document.querySelectorAll('.bn-tab').forEach(el => el.classList.toggle('is-active', el.dataset.bnGo === (tab === 'running' ? 'focus' : tab)));
    document.getElementById('bnApp').classList.toggle('is-running', tab === 'running');
    refreshUI();
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
      switchTab('running');
      startRain();
    } else {
      document.getElementById('bnFocusHint').textContent = '请选择 TA 当前的陪伴状态';
    }
  }

  function stopFocusSession() {
    if (!confirm('结束这次专注吗？')) return;
    stopRain(true);
    if (typeof stopTimer === 'function') stopTimer();
    stopCaptions();
    switchTab('focus');
  }

  function pauseFocus() {
    if (typeof pauseResumeTimer === 'function') pauseResumeTimer();
    window.focusCompanion?.setPaused(Boolean(isPaused));
    if (isPaused) stopRain(false);
    else startRain();
    refreshTimer();
  }

  function populateBetaRoleForm() {
    if (!isBetaMode) return;
    const oc = currentOC();
    state.betaBackground = oc.avatar || fallbackAvatar;
    document.getElementById('bnBetaBackgroundPreview').src = state.betaBackground;
    document.getElementById('bnBetaName').value = oc.name || '';
    document.getElementById('bnBetaUserTitle').value = oc.userTitle || '大小姐';
    const relation = oc.relationship || '学习搭子';
    const select = document.getElementById('bnBetaRelationship');
    const standard = Array.from(select.options).some(option => option.value === relation && relation !== '自定义');
    select.value = standard ? relation : '自定义';
    document.getElementById('bnBetaCustomRelationship').value = standard ? '' : relation;
    document.getElementById('bnBetaCustomRelationWrap').hidden = standard;
    document.getElementById('bnBetaPersona').value = oc.characterDescription || '';
  }

  function compressBetaBackground(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('图片格式无法识别'));
        image.onload = () => {
          const maxSide = 1440;
          const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d', { alpha: false });
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleBetaBackground(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('请选择图片文件');
    if (file.size > 15 * 1024 * 1024) return toast('图片不能超过 15MB');
    try {
      state.betaBackground = await compressBetaBackground(file);
      document.getElementById('bnBetaBackgroundPreview').src = state.betaBackground;
    } catch (error) {
      console.warn('Beta background processing failed:', error);
      toast(error.message || '图片处理失败');
    }
  }

  async function saveBetaRole(event) {
    event.preventDefault();
    window.focusCompanion?.unlockAudio().catch(() => {});
    const hint = document.getElementById('bnBetaRoleHint');
    const name = document.getElementById('bnBetaName').value.trim();
    const userTitle = document.getElementById('bnBetaUserTitle').value.trim();
    const relationSelect = document.getElementById('bnBetaRelationship').value;
    const relationship = relationSelect === '自定义'
      ? document.getElementById('bnBetaCustomRelationship').value.trim()
      : relationSelect;
    if (!name || !userTitle || !relationship) {
      hint.textContent = '请把名字、称呼和关系填写完整';
      return;
    }
    const existing = currentOC();
    const next = {
      ...existing,
      id: existing.id || Date.now(),
      name,
      avatar: state.betaBackground || existing.avatar || fallbackAvatar,
      userTitle,
      relationship,
      characterDescription: document.getElementById('bnBetaPersona').value.trim(),
      voiceType: 'zh_male_ruyayichen_saturn_bigtts',
      selected: true
    };
    ocData[currentOCIndex] = next;
    try {
      if (next.avatar.startsWith('data:') && typeof saveAvatarData === 'function') {
        await saveAvatarData(`oc_${next.id}`, next.avatar);
      }
      if (typeof persistOCData === 'function') persistOCData();
      else localStorage.setItem('ocData', JSON.stringify(ocData));
      localStorage.setItem('currentOCIndex', String(currentOCIndex));
      localStorage.setItem('bnBetaRoleConfigured', 'true');
      if (typeof updateCurrentOC === 'function') updateCurrentOC(currentOCIndex);
      hint.textContent = '';
      refreshUI();
      toast('角色已保存');
      await showBetaMeeting();
    } catch (error) {
      console.warn('Beta role save failed:', error);
      hint.textContent = '保存失败，请重试';
    }
  }

  function betaPersona(oc) {
    return `${oc.name || 'TA'}，与用户的关系是${oc.relationship || '学习搭子'}。完整人设：${oc.characterDescription || '温柔陪伴用户'}。需要称呼时只叫用户“${oc.userTitle || '大小姐'}”，不要每句话都称呼。`;
  }

  async function showBetaMeeting() {
    const oc = currentOC();
    switchTab('beta-meeting');
    document.getElementById('bnBetaMeetingBackground').src = oc.avatar || fallbackAvatar;
    document.getElementById('bnBetaMeetingName').textContent = oc.name || 'TA';
    const caption = document.getElementById('bnBetaMeetingCaption');
    const form = document.getElementById('bnBetaMeetingForm');
    const startButton = document.getElementById('bnBetaStartTogether');
    const input = document.getElementById('bnBetaMeetingTask');
    form.hidden = true;
    startButton.hidden = true;
    input.value = '';
    state.betaMeetingTask = '';
    const question = `${oc.userTitle || '大小姐'}，今天想做什么？`;
    caption.textContent = '';
    try {
      const turn = window.focusCompanion?.createSpeechTurn();
      const bytes = turn
        ? await window.focusCompanion.speakMessages([question], turn, 'session_opening', message => { caption.textContent = message; })
        : 0;
      if (!bytes) caption.textContent = question;
    } catch (error) {
      console.warn('Meeting question TTS failed:', error);
      caption.textContent = question;
    }
    form.hidden = false;
    input.focus();
  }

  async function submitBetaMeetingTask(event) {
    event.preventDefault();
    const input = document.getElementById('bnBetaMeetingTask');
    const form = document.getElementById('bnBetaMeetingForm');
    const caption = document.getElementById('bnBetaMeetingCaption');
    const startButton = document.getElementById('bnBetaStartTogether');
    const task = input.value.trim();
    if (!task) return;
    state.betaMeetingTask = task;
    form.hidden = true;
    caption.textContent = 'TA 正在想…';
    const turn = window.focusCompanion?.createSpeechTurn() || { epoch: Date.now(), turnId: 1 };
    let messages = ['好，我陪你开始。'];
    try {
      const oc = currentOC();
      const response = await fetch('/api/companion-observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'session_opening', task, persona: betaPersona(oc), epoch: turn.epoch, turnId: turn.turnId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Opening HTTP ${response.status}`);
      messages = Array.isArray(payload.data?.messages) && payload.data.messages.length
        ? payload.data.messages.slice(0, 1)
        : messages;
    } catch (error) {
      console.warn('Meeting response generation failed:', error);
    }
    try {
      const bytes = await window.focusCompanion?.speakMessages(messages, turn, 'session_opening', message => { caption.textContent = message; });
      if (!bytes) caption.textContent = messages[0];
    } catch (error) {
      console.warn('Meeting response TTS failed:', error);
      caption.textContent = messages[0];
    }
    startButton.hidden = false;
  }

  function startBetaFocus() {
    const task = state.betaMeetingTask || '专注任务';
    selectedMinutes = 25;
    currentTime = 25 * 60;
    document.getElementById('bnTaskInput').value = task;
    document.querySelectorAll('.bn-duration').forEach(button => button.classList.toggle('is-active', button.dataset.bnMinutes === '25'));
    window.focusCompanion?.markMeetingComplete();
    startFocus();
  }

  function ensureRainAudio() {
    if (state.rainAudio) return state.rainAudio;
    const audio = new Audio('/frontend/audio/ambient/rain-cc0.mp3');
    audio.id = 'bnRainPlayer';
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.08;
    state.rainAudio = audio;
    return audio;
  }

  function updateRainButton() {
    const button = document.getElementById('bnRainBtn');
    if (!button) return;
    button.classList.toggle('rain-active', state.rainEnabled);
    button.setAttribute('aria-pressed', String(state.rainEnabled));
    button.setAttribute('aria-label', state.rainEnabled ? '关闭雨声' : '开启雨声');
    button.title = state.rainEnabled ? '关闭雨声' : '开启雨声';
    button.textContent = state.rainEnabled ? '🌧️' : '☁️';
  }

  function startRain() {
    updateRainButton();
    if (!state.rainEnabled || !isTimerRunning || isPaused) return;
    ensureRainAudio().play().catch(error => {
      console.warn('雨声播放失败:', error);
      toast('点一下雨声按钮即可播放');
    });
  }

  function stopRain(reset) {
    if (!state.rainAudio) return;
    state.rainAudio.pause();
    if (reset) state.rainAudio.currentTime = 0;
  }

  function toggleRain() {
    state.rainEnabled = !state.rainEnabled;
    localStorage.setItem('bnRainEnabled', String(state.rainEnabled));
    if (state.rainEnabled) startRain();
    else stopRain(false);
    updateRainButton();
  }

  function nextCaption() {
    state.captionIndex = (state.captionIndex + 1) % captions.length;
    document.getElementById('bnCaption').textContent = captions[state.captionIndex];
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
      stopRain(true);
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
    updateRainButton();
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
      const betaVoice = event.target.closest('[data-bn-beta-voice]');
      if (betaVoice) {
        window.focusCompanion?.previewVoice();
        toast('正在试听温柔男声');
        return;
      }
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
      if (type === 'toggle-camera' && window.focusCompanion) window.focusCompanion.toggleCamera();
      if (type === 'next-caption') nextCaption();
      if (type === 'toggle-rain') toggleRain();
      if (type === 'beta-edit-role') {
        populateBetaRoleForm();
        switchTab('beta-setup');
      }
      if (type === 'beta-start-together') startBetaFocus();
      if (type === 'gifts' && typeof showGiftModal === 'function') showGiftModal();
      if (type === 'edit-oc' || type === 'new-oc' || type === 'advanced') {
        toast('该功能正在迁移到新界面');
      }
    });
    document.querySelectorAll('.bn-acc-head').forEach(button => button.addEventListener('click', () => button.parentElement.classList.toggle('is-open')));
    document.getElementById('bnChatForm').addEventListener('submit', submitChat);
    document.getElementById('bnTaskInput').addEventListener('change', syncTaskInput);
    document.getElementById('bnBetaRoleForm').addEventListener('submit', saveBetaRole);
    document.getElementById('bnBetaMeetingForm').addEventListener('submit', submitBetaMeetingTask);
    document.getElementById('bnBetaBackgroundInput').addEventListener('change', event => handleBetaBackground(event.target.files?.[0]));
    document.getElementById('bnBetaRelationship').addEventListener('change', event => {
      document.getElementById('bnBetaCustomRelationWrap').hidden = event.target.value !== '自定义';
    });
    const voiceButton = document.getElementById('bnVoiceInputBtn');
    if (voiceButton && window.focusCompanion) {
      voiceButton.addEventListener('pointerdown', event => {
        event.preventDefault();
        voiceButton.setPointerCapture?.(event.pointerId);
        window.focusCompanion.startVoiceInput();
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
        voiceButton.addEventListener(type, event => {
          event.preventDefault();
          window.focusCompanion.stopVoiceInput();
        });
      });
      voiceButton.addEventListener('contextmenu', event => event.preventDefault());
    }
    const source = document.getElementById('chatMessages');
    if (source) {
      state.chatObserver = new MutationObserver(mirrorChat);
      state.chatObserver.observe(source, { childList: true, subtree: true, characterData: true });
    }
  }

  function init() {
    renderShell();
    document.body.classList.add('bn-ui-active');
    if (isBetaMode) document.body.classList.add('bn-beta-mode');
    document.querySelectorAll('body > div:not(#bnApp) .floating, body > div:not(#bnApp) .sparkle').forEach(element => {
      element.style.display = 'none';
    });
    bindEvents();
    loadPrototypeScene();
    setTimeout(() => {
      if (!isStatusSelected) setStatus(document.querySelector('.bn-status[data-bn-status="学习"]'));
      refreshUI();
      prepareChat();
      const requested = new URLSearchParams(location.search).get('page');
      if (isTimerRunning || isPaused) switchTab('running');
      else if (isBetaMode) {
        populateBetaRoleForm();
        switchTab('beta-setup');
      }
      else if (['home', 'focus', 'chat', 'oc'].includes(requested)) switchTab(requested);
    }, 120);
    state.refreshTimer = setInterval(refreshUI, 1000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
