(function () {
  'use strict';

  const isBetaMode = location.pathname === '/beta' || new URLSearchParams(location.search).get('mode') === 'beta';

  const state = {
    tab: 'home',
    captionIndex: 0,
    captionTimer: null,
    refreshTimer: null,
    chatObserver: null,
    toastTimer: null,
    rainAudio: null,
    pianoAudio: null,
    bgmMode: ['rain', 'piano', 'muted'].includes(localStorage.getItem('bnBgmMode'))
      ? localStorage.getItem('bnBgmMode')
      : (localStorage.getItem('bnRainEnabled') === 'false' ? 'muted' : 'rain'),
    betaBackground: '',
    betaMeetingTask: '',
    bodyDoubleActivity: '看书',
    bodyDoubleTodos: [],
    composerLayoutHeight: 0,
    composerViewportHandler: null,
    composerUnlockTimer: null,
    composerCloseTimer: null,
    betaMeetingLayoutHeight: 0,
    betaMeetingViewportHandler: null,
    betaMeetingUnlockTimer: null,
    betaSetupLayoutHeight: 0,
    betaSetupViewportHandler: null,
    betaSetupUnlockTimer: null,
    betaCrop: null
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
        <img class="bn-beta-scene" id="bnBetaBackgroundPreview" alt="TA 的完整陪伴场景">
        <div class="bn-beta-scene-shade"></div>
        <div class="bn-beta-role-presence">
          <strong id="bnBetaHeroName">TA</strong>
          <span>你的专注伙伴 · 已陪伴 20 天</span>
          <small><i></i>在等你</small>
        </div>
        <div class="bn-beta-role-bubble">来了？<br>书已经拿好了，<br>今天也一起？</div>
        <label class="bn-beta-image-change" for="bnBetaBackgroundInput">更换角色</label>
        <input id="bnBetaBackgroundInput" type="file" accept="image/*" hidden>
        <div class="bn-beta-crop" id="bnBetaCrop" hidden>
          <div class="bn-beta-crop-sheet" role="dialog" aria-modal="true" aria-labelledby="bnBetaCropTitle">
            <header><button type="button" data-bn-action="beta-cancel-crop">取消</button><strong id="bnBetaCropTitle">调整角色画面</strong><button type="button" data-bn-action="beta-apply-crop">使用图片</button></header>
            <p>拖动图片调整位置，画面比例与专注页一致</p>
            <div class="bn-beta-crop-frame" id="bnBetaCropFrame"><img id="bnBetaCropImage" alt="待裁切的角色图片"></div>
            <label class="bn-beta-crop-zoom"><span>缩放</span><input id="bnBetaCropZoom" type="range" min="1" max="3" step="0.01" value="1" aria-label="缩放角色图片"></label>
          </div>
        </div>
        <form class="bn-beta-form" id="bnBetaRoleForm">
          <section class="bn-beta-glass-card">
            <div class="bn-beta-card-grabber" aria-hidden="true"><i></i></div>
            <div class="bn-beta-tabs" role="tablist" aria-label="角色设置">
              <button class="is-active" type="button" role="tab" aria-selected="true" data-bn-beta-tab="partner">伙伴设定</button>
              <button type="button" role="tab" aria-selected="false" data-bn-beta-tab="voice">声音设定</button>
            </div>
            <div class="bn-beta-tab-stage">
              <div class="bn-beta-tab-panel is-active" data-bn-beta-panel="partner" role="tabpanel">
                <div class="bn-beta-name-grid">
                  <label class="bn-beta-field"><span>TA 的名字</span><input id="bnBetaName" maxlength="20" placeholder="TA 叫什么？" required></label>
                  <label class="bn-beta-field"><span>TA 怎么称呼你</span><input id="bnBetaUserTitle" maxlength="20" list="bnBetaTitleOptions" placeholder="例如：宝宝" required></label>
                </div>
                <datalist id="bnBetaTitleOptions"><option value="大小姐"><option value="宝宝"><option value="姐姐"><option value="同学"></datalist>
                <div class="bn-beta-relation-block"><span>你的关系</span>
                  <div class="bn-beta-segments" role="group" aria-label="你的关系">
                    <button type="button" data-bn-beta-relation="恋人">恋人</button><button type="button" data-bn-beta-relation="朋友">朋友</button><button type="button" data-bn-beta-relation="暧昧">暧昧</button><button type="button" data-bn-beta-relation="搭子">搭子</button><button type="button" data-bn-beta-relation="自定义">自定义</button>
                  </div>
                  <select id="bnBetaRelationship" hidden><option>恋人</option><option>朋友</option><option>暧昧</option><option>搭子</option><option value="自定义">自定义</option></select>
                </div>
                <label class="bn-beta-field bn-beta-custom-relation" id="bnBetaCustomRelationWrap" hidden><span>自定义关系</span><input id="bnBetaCustomRelationship" maxlength="20" placeholder="写下你们的关系"></label>
                <label class="bn-beta-field bn-beta-persona-field"><span>TA 的人设</span><textarea id="bnBetaPersona" maxlength="3000" rows="3" placeholder="写下 TA 的性格、说话习惯和陪伴方式。"></textarea><button type="button" data-bn-action="beta-improve-persona">✦ AI 完善</button></label>
              </div>
              <div class="bn-beta-tab-panel" data-bn-beta-panel="voice" role="tabpanel" aria-hidden="true">
                <div class="bn-beta-voice-chips" role="group" aria-label="声音气质">
                  <button class="bn-beta-voice is-active" type="button" data-bn-beta-voice="zh_male_ruyayichen_saturn_bigtts" aria-pressed="true"><span><b>温柔低沉</b></span></button>
                  <button class="bn-beta-voice" type="button" data-bn-beta-voice="zh_male_m191_uranus_bigtts" aria-pressed="false"><span><b>清冷沉稳</b></span></button>
                  <button class="bn-beta-voice" type="button" data-bn-beta-voice="zh_male_taocheng_uranus_bigtts" aria-pressed="false"><span><b>温暖治愈</b></span></button>
                  <button class="bn-beta-voice" type="button" data-bn-beta-voice="zh_male_liufei_uranus_bigtts" aria-pressed="false"><span><b>慵懒自然</b></span></button>
                </div>
                <div class="bn-beta-voice-preview">
                  <button type="button" data-bn-action="beta-preview-voice" aria-label="试听当前声音"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.2 5.7v12.6c0 .9 1 1.45 1.78.98l9.42-6.3a1.16 1.16 0 000-1.96l-9.42-6.3A1.16 1.16 0 008.2 5.7z"/></svg></button>
                  <div><b id="bnBetaVoiceName">温柔低沉</b><small>“我在，慢慢来。”</small></div>
                  <div class="bn-beta-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
                  <button type="button" data-bn-action="beta-next-voice">更换 ›</button>
                </div>
                <p class="bn-beta-note">声音会应用到见面、氛围、事件和对话。</p>
              </div>
            </div>
          </section>
          <button class="bn-beta-card-restore" type="button" data-bn-action="beta-show-settings">显示设置</button>
          <div class="bn-focus-hint" id="bnBetaRoleHint"></div>
          <button class="bn-beta-primary" type="submit"><strong>和<span id="bnBetaCtaName">TA</span>一起开始专注</strong><small>25 min · 番茄钟</small></button>
        </form>
      </section>

      <section class="bn-screen bn-beta-meeting" data-bn-screen="beta-meeting">
        <img class="bn-beta-meeting-bg" id="bnBetaMeetingBackground" alt="TA 的陪伴背景">
        <div class="bn-beta-meeting-shade"></div>
        <button class="bn-beta-meeting-back" type="button" data-bn-action="beta-edit-role">‹ 返回</button>
        <div class="bn-beta-meeting-name"><i></i><span id="bnBetaMeetingName"></span> · 在这里</div>
        <div class="bn-beta-meeting-panel">
          <div class="bn-beta-meeting-caption" id="bnBetaMeetingCaption"></div>
          <form class="bn-beta-task-form" id="bnBetaMeetingForm" hidden>
            <input id="bnBetaMeetingTask" maxlength="60" autocomplete="off" placeholder="这次想完成什么？" required>
            <button type="submit" aria-label="发送任务"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/></svg></button>
          </form>
          <div class="bn-beta-body-double" id="bnBetaBodyDouble" hidden>
            <label for="bnBetaBodyDoubleInput">这次 TA 会做什么</label>
            <div><input id="bnBetaBodyDoubleInput" maxlength="40" value="看书" placeholder="例如：看书"><button type="button" data-bn-action="roll-body-double" aria-label="随机换一个">↻</button></div>
          </div>
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
          <div class="bn-camera-preview is-placeholder" id="bnCameraPreview" data-camera-state="camera-off" role="button" tabindex="0" aria-label="点击开启摄像头，可拖动或双指缩放">
            <video id="bnCameraVideo" autoplay muted playsinline aria-label="你的摄像头预览"></video>
            <div class="bn-camera-placeholder" aria-hidden="true">
              <svg class="bn-camera-person" viewBox="0 0 32 32"><circle cx="16" cy="11" r="5"/><path d="M7.5 27c.7-6 4-9 8.5-9s7.8 3 8.5 9"/></svg>
              <svg class="bn-camera-off-icon" viewBox="0 0 24 24"><path d="M4 7.5A2.5 2.5 0 016.5 5h8A2.5 2.5 0 0117 7.5v9a2.5 2.5 0 01-2.5 2.5h-8A2.5 2.5 0 014 16.5v-9zM17 10l4-2v8l-4-2M3 3l18 18"/></svg>
              <span class="bn-camera-loader"></span>
            </div>
          </div>
        </div>
        <div class="bn-focus-overlay">
          <div class="bn-focus-top-row">
            <div class="bn-focus-companion-block">
              <div class="bn-call-top"><span><span id="bnCallName"></span> · 专注陪伴中 <b aria-hidden="true">›</b></span><small>和你一起，慢慢把它完成</small></div>
              <div class="bn-call-task" id="bnCallTask">📖 专注中</div>
              <div class="bn-body-double-card" id="bnBodyDoubleCard" hidden><header><span id="bnBodyDoubleName">TA</span><small>也在专注</small></header><div id="bnBodyDoubleList"></div></div>
            </div>
            <div class="bn-focus-top-right"><button class="bn-bgm-pill" id="bnRainBtn" type="button" data-bn-action="toggle-rain" aria-pressed="true"></button></div>
          </div>
          <div class="bn-dialogue-row"><div class="bn-caption" id="bnCaption"></div></div>
          <div class="bn-call-bottom">
            <div class="bn-call-time" id="bnTimer">25:00</div><div class="bn-call-sub" id="bnCallSub">专注中<span>·</span>和角色一起</div>
            <div class="bn-controls">
              <button class="bn-control" id="bnVoiceInputBtn" type="button" aria-label="和 TA 说话" title="轻触打字 · 长按说话">
                <svg class="bn-dialogue-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14a2.5 2.5 0 012.5 2.5v7a2.5 2.5 0 01-2.5 2.5h-7.2L6.5 21v-3.5H5A2.5 2.5 0 012.5 15V8A2.5 2.5 0 015 5.5zM7.5 11.5h.01M12 11.5h.01M16.5 11.5h.01"/></svg>
              </button>
              <div class="bn-dialogue-tip" id="bnDialogueTip" hidden>长按说话 · 轻触打字</div>
              <div class="bn-voice-status" id="bnVoiceStatus" hidden>松开发送</div>
              <button class="bn-control is-primary" id="bnPause" type="button" aria-label="短按暂停，长按结束" title="短按暂停 · 长按结束"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg></button>
              <button class="bn-control" id="bnCameraBtn" type="button" data-bn-action="toggle-camera" aria-pressed="false" aria-label="开启视频" title="开启视频">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 10l4.55-2.28A1 1 0 0121 8.62v6.76a1 1 0 01-1.45.9L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
            </div>
          </div>
        </div>
        <div class="bn-chat-composer-layer" id="bnChatSheetLayer" hidden>
          <button class="bn-chat-composer-dismiss" type="button" aria-label="收起文字输入"></button>
          <form class="bn-focus-chat-form bn-floating-composer" id="bnFocusChatForm">
            <input id="bnFocusChatInput" maxlength="200" autocomplete="off" enterkeyhint="send" placeholder="和角色说点什么……">
            <button type="submit" aria-label="发送" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/></svg></button>
          </form>
        </div>
        <div class="bn-end-confirm" id="bnEndConfirm" hidden>
          <div class="bn-end-confirm-card" role="dialog" aria-modal="true" aria-labelledby="bnEndConfirmTitle">
            <div class="bn-end-confirm-icon">⏹</div>
            <h2 id="bnEndConfirmTitle">确认结束专注？</h2>
            <p>当前专注进度会在这里结束。</p>
            <div><button type="button" data-bn-action="cancel-end-focus">继续专注</button><button class="is-danger" type="button" data-bn-action="confirm-end-focus">确认结束</button></div>
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
      startBgm();
    } else {
      document.getElementById('bnFocusHint').textContent = '请选择 TA 当前的陪伴状态';
    }
  }

  function stopFocusSession() {
    showEndConfirm(false);
    stopBgm(true);
    if (typeof stopTimer === 'function') stopTimer();
    stopCaptions();
    returnFromFocusSession();
  }

  function syncBetaFocusBackground(avatar) {
    if (!isBetaMode) return;
    const target = document.getElementById('bnStageImage');
    const source = avatar || currentOC().avatar || state.betaBackground || fallbackAvatar;
    if (target && target.getAttribute('src') !== source) target.src = source;
  }

  function returnFromFocusSession() {
    if (isBetaMode) {
      populateBetaRoleForm();
      switchTab('beta-setup');
      return;
    }
    switchTab('focus');
  }

  function pauseFocus() {
    if (typeof pauseResumeTimer === 'function') pauseResumeTimer();
    window.focusCompanion?.setPaused(Boolean(isPaused));
    if (isPaused) stopBgm(false);
    else startBgm();
    refreshTimer();
  }

  function showEndConfirm(show = true) {
    const modal = document.getElementById('bnEndConfirm');
    if (!modal) return;
    modal.hidden = !show;
  }

  function setBetaTab(tabName) {
    document.querySelectorAll('[data-bn-beta-tab]').forEach(button => {
      const active = button.dataset.bnBetaTab === tabName;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('[data-bn-beta-panel]').forEach(panel => {
      const active = panel.dataset.bnBetaPanel === tabName;
      panel.classList.toggle('is-active', active);
      panel.setAttribute('aria-hidden', String(!active));
    });
  }

  function setupBetaCardDismiss() {
    const form = document.getElementById('bnBetaRoleForm');
    const card = form?.querySelector('.bn-beta-glass-card');
    const handle = card?.querySelector('.bn-beta-card-grabber');
    if (!form || !card || !handle) return;
    let gesture = null;

    handle.addEventListener('pointerdown', event => {
      if (event.button !== undefined && event.button !== 0) return;
      gesture = { id:event.pointerId, startY:event.clientY, lastY:event.clientY, lastAt:performance.now(), velocity:0, dragging:false };
      handle.setPointerCapture?.(event.pointerId);
    });
    handle.addEventListener('pointermove', event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const delta = Math.max(0, event.clientY - gesture.startY);
      const now = performance.now();
      gesture.velocity = (event.clientY - gesture.lastY) / Math.max(1, now - gesture.lastAt) * 1000;
      gesture.lastY = event.clientY;
      gesture.lastAt = now;
      if (!gesture.dragging && delta < 10) return;
      gesture.dragging = true;
      card.classList.add('is-dragging');
      card.style.setProperty('--bn-beta-card-drag', `${delta}px`);
      event.preventDefault();
    });
    const finishGesture = event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const delta = Math.max(0, event.clientY - gesture.startY);
      const dismiss = gesture.dragging && (delta > Math.min(96, card.offsetHeight * .26) || gesture.velocity > 520);
      card.classList.remove('is-dragging');
      card.style.removeProperty('--bn-beta-card-drag');
      form.classList.toggle('is-card-hidden', dismiss);
      gesture = null;
    };
    handle.addEventListener('pointerup', finishGesture);
    handle.addEventListener('pointercancel', finishGesture);
  }

  function setupBetaMeetingKeyboard() {
    const meeting = document.querySelector('.bn-beta-meeting');
    const panel = meeting?.querySelector('.bn-beta-meeting-panel');
    const viewport = window.visualViewport;
    if (!meeting || !panel) return;

    const updatePosition = () => {
      if (!meeting.classList.contains('is-keyboard-active')) return;
      const viewportOffset = viewport ? Math.max(0, viewport.offsetTop) : 0;
      const visibleBottom = viewport ? viewport.height + viewportOffset : window.innerHeight;
      const keyboardInset = Math.max(0, state.betaMeetingLayoutHeight - visibleBottom);
      panel.style.setProperty('--bn-beta-keyboard-inset', `${Math.round(keyboardInset)}px`);
      meeting.style.setProperty('--bn-beta-viewport-offset', `${Math.round(viewportOffset)}px`);
    };
    const lock = () => {
      window.clearTimeout(state.betaMeetingUnlockTimer);
      if (!meeting.classList.contains('is-keyboard-active')) {
        state.betaMeetingLayoutHeight = Math.round(meeting.getBoundingClientRect().height || window.innerHeight);
        meeting.style.setProperty('--bn-beta-meeting-height', `${state.betaMeetingLayoutHeight}px`);
        meeting.classList.add('is-keyboard-active');
        document.body.classList.add('bn-beta-meeting-keyboard');
      }
      if (!state.betaMeetingViewportHandler) {
        state.betaMeetingViewportHandler = updatePosition;
        viewport?.addEventListener('resize', updatePosition);
        viewport?.addEventListener('scroll', updatePosition);
      }
      updatePosition();
    };
    const unlock = () => {
      state.betaMeetingUnlockTimer = window.setTimeout(() => {
        if (meeting.contains(document.activeElement) && document.activeElement?.matches('input,textarea')) return;
        viewport?.removeEventListener('resize', state.betaMeetingViewportHandler);
        viewport?.removeEventListener('scroll', state.betaMeetingViewportHandler);
        state.betaMeetingViewportHandler = null;
        meeting.classList.remove('is-keyboard-active');
        document.body.classList.remove('bn-beta-meeting-keyboard');
        meeting.style.removeProperty('--bn-beta-meeting-height');
        meeting.style.removeProperty('--bn-beta-viewport-offset');
        panel.style.removeProperty('--bn-beta-keyboard-inset');
      }, 260);
    };

    meeting.addEventListener('pointerdown', event => {
      if (event.target.matches('input,textarea')) lock();
    }, true);
    meeting.addEventListener('focusin', event => {
      if (!event.target.matches('input,textarea')) return;
      lock();
      window.requestAnimationFrame(updatePosition);
    });
    meeting.addEventListener('focusout', event => {
      if (event.target.matches('input,textarea')) unlock();
    });
  }

  function setupBetaSetupKeyboard() {
    const setup = document.querySelector('.bn-beta-setup');
    const form = document.getElementById('bnBetaRoleForm');
    const viewport = window.visualViewport;
    if (!setup || !form) return;

    const updatePosition = () => {
      if (!setup.classList.contains('is-keyboard-active')) return;
      const viewportOffset = viewport ? Math.max(0, viewport.offsetTop) : 0;
      const visibleBottom = viewport ? viewport.height + viewportOffset : window.innerHeight;
      const keyboardInset = Math.max(0, state.betaSetupLayoutHeight - visibleBottom);
      setup.style.setProperty('--bn-beta-setup-height', `${state.betaSetupLayoutHeight}px`);
      setup.style.setProperty('--bn-beta-setup-viewport-offset', `${Math.round(viewportOffset)}px`);
      form.style.setProperty('--bn-beta-setup-keyboard-inset', `${Math.round(keyboardInset)}px`);
    };
    const lock = () => {
      window.clearTimeout(state.betaSetupUnlockTimer);
      if (!setup.classList.contains('is-keyboard-active')) {
        state.betaSetupLayoutHeight = Math.round(setup.getBoundingClientRect().height || window.innerHeight);
        setup.classList.add('is-keyboard-active');
        document.body.classList.add('bn-beta-setup-keyboard');
      }
      if (!state.betaSetupViewportHandler) {
        state.betaSetupViewportHandler = updatePosition;
        viewport?.addEventListener('resize', updatePosition);
        viewport?.addEventListener('scroll', updatePosition);
      }
      updatePosition();
    };
    const unlock = () => {
      state.betaSetupUnlockTimer = window.setTimeout(() => {
        if (form.contains(document.activeElement) && document.activeElement?.matches('input,textarea')) return;
        viewport?.removeEventListener('resize', state.betaSetupViewportHandler);
        viewport?.removeEventListener('scroll', state.betaSetupViewportHandler);
        state.betaSetupViewportHandler = null;
        setup.classList.remove('is-keyboard-active');
        document.body.classList.remove('bn-beta-setup-keyboard');
        setup.style.removeProperty('--bn-beta-setup-height');
        setup.style.removeProperty('--bn-beta-setup-viewport-offset');
        form.style.removeProperty('--bn-beta-setup-keyboard-inset');
      }, 260);
    };

    form.addEventListener('pointerdown', event => {
      if (event.target.matches('input,textarea')) lock();
    }, true);
    form.addEventListener('focusin', event => {
      if (!event.target.matches('input,textarea')) return;
      lock();
      window.requestAnimationFrame(updatePosition);
    });
    form.addEventListener('focusout', event => {
      if (event.target.matches('input,textarea')) unlock();
    });
  }

  function setBetaRelationship(value) {
    const select = document.getElementById('bnBetaRelationship');
    if (!select) return;
    select.value = value;
    document.querySelectorAll('[data-bn-beta-relation]').forEach(button => {
      const active = button.dataset.bnBetaRelation === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.getElementById('bnBetaCustomRelationWrap').hidden = value !== '自定义';
  }

  function updateBetaIdentity() {
    const name = document.getElementById('bnBetaName')?.value.trim() || 'TA';
    document.getElementById('bnBetaHeroName').textContent = name;
    document.getElementById('bnBetaCtaName').textContent = name;
  }

  function improveBetaPersona() {
    const textarea = document.getElementById('bnBetaPersona');
    if (!textarea) return;
    const name = document.getElementById('bnBetaName')?.value.trim() || 'TA';
    const selectedRelationship = document.getElementById('bnBetaRelationship')?.value || '伙伴';
    const relationship = selectedRelationship === '自定义'
      ? (document.getElementById('bnBetaCustomRelationship')?.value.trim() || '伙伴')
      : selectedRelationship;
    if (!textarea.value.trim()) {
      textarea.value = `${name}安静温柔，会自然关注我的状态。作为我的${relationship}，平时陪我各自做事，只有在我分心太久时才轻声提醒。`;
    } else if (!/陪|提醒|状态/.test(textarea.value)) {
      textarea.value = `${textarea.value.trim()} 会留意我的状态，在我需要时温柔陪伴，并在分心太久时自然提醒。`;
    }
    textarea.focus({ preventScroll:true });
    toast('已帮你完善陪伴方式');
  }

  function previewSelectedBetaVoice() {
    const selected = document.querySelector('[data-bn-beta-voice].is-active');
    if (!selected) return;
    window.focusCompanion?.previewVoice(selected.dataset.bnBetaVoice);
    toast(`正在试听${selected.querySelector('b')?.textContent || '当前声音'}`);
  }

  function selectNextBetaVoice() {
    const voices = Array.from(document.querySelectorAll('[data-bn-beta-voice]'));
    if (!voices.length) return;
    const activeIndex = voices.findIndex(button => button.classList.contains('is-active'));
    voices[(activeIndex + 1) % voices.length].click();
  }

  function populateBetaRoleForm() {
    if (!isBetaMode) return;
    const oc = currentOC();
    state.betaBackground = oc.avatar || fallbackAvatar;
    document.getElementById('bnBetaBackgroundPreview').src = state.betaBackground;
    document.getElementById('bnBetaName').value = oc.name || '';
    document.getElementById('bnBetaUserTitle').value = oc.userTitle || '大小姐';
    const relation = oc.relationship === '学习搭子' ? '搭子' : (oc.relationship || '搭子');
    const select = document.getElementById('bnBetaRelationship');
    const standard = Array.from(select.options).some(option => option.value === relation && relation !== '自定义');
    setBetaRelationship(standard ? relation : '自定义');
    document.getElementById('bnBetaCustomRelationship').value = standard ? '' : relation;
    document.getElementById('bnBetaPersona').value = oc.characterDescription || '';
    document.querySelectorAll('[data-bn-beta-voice]').forEach(button => {
      const active = button.dataset.bnBetaVoice === (oc.voiceType || 'zh_male_ruyayichen_saturn_bigtts');
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      const label = button.querySelector('em');
      if (label) label.textContent = active ? '已选择' : '选择';
      if (active) document.getElementById('bnBetaVoiceName').textContent = button.querySelector('b')?.textContent || '当前声音';
    });
    updateBetaIdentity();
    setBetaTab('partner');
  }

  function readBetaCropImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error || new Error('图片读取失败'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('图片格式无法识别'));
        image.onload = () => resolve(image);
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function renderBetaCrop() {
    const crop = state.betaCrop;
    if (!crop) return;
    const { frame, preview } = crop;
    const renderedWidth = crop.baseWidth * crop.zoom;
    const renderedHeight = crop.baseHeight * crop.zoom;
    const maxX = Math.max(0, (renderedWidth - frame.clientWidth) / 2);
    const maxY = Math.max(0, (renderedHeight - frame.clientHeight) / 2);
    crop.x = Math.max(-maxX, Math.min(maxX, crop.x));
    crop.y = Math.max(-maxY, Math.min(maxY, crop.y));
    preview.style.width = `${crop.baseWidth}px`;
    preview.style.height = `${crop.baseHeight}px`;
    preview.style.transform = `translate(-50%,-50%) translate(${crop.x}px,${crop.y}px) scale(${crop.zoom})`;
  }

  function closeBetaCrop() {
    document.getElementById('bnBetaCrop').hidden = true;
    document.body.classList.remove('bn-beta-crop-open');
    document.getElementById('bnBetaBackgroundInput').value = '';
    state.betaCrop = null;
  }

  async function openBetaCrop(file) {
    const image = await readBetaCropImage(file);
    const modal = document.getElementById('bnBetaCrop');
    const frame = document.getElementById('bnBetaCropFrame');
    const preview = document.getElementById('bnBetaCropImage');
    const zoom = document.getElementById('bnBetaCropZoom');
    const aspect = Math.max(.42, Math.min(.8, window.innerWidth / window.innerHeight));
    const frameWidth = Math.min(window.innerWidth - 48, window.innerHeight * .64 * aspect);
    frame.style.width = `${Math.round(frameWidth)}px`;
    frame.style.aspectRatio = String(aspect);
    modal.hidden = false;
    document.body.classList.add('bn-beta-crop-open');
    preview.src = image.src;
    const baseScale = Math.max(frame.clientWidth / image.naturalWidth, frame.clientHeight / image.naturalHeight);
    state.betaCrop = {
      image, frame, preview, zoom:1, x:0, y:0,
      baseScale,
      baseWidth:image.naturalWidth * baseScale,
      baseHeight:image.naturalHeight * baseScale
    };
    zoom.value = '1';
    renderBetaCrop();
  }

  function applyBetaCrop() {
    const crop = state.betaCrop;
    if (!crop) return;
    const scale = crop.baseScale * crop.zoom;
    const sourceWidth = crop.frame.clientWidth / scale;
    const sourceHeight = crop.frame.clientHeight / scale;
    const sourceX = (crop.image.naturalWidth - sourceWidth) / 2 - crop.x / scale;
    const sourceY = (crop.image.naturalHeight - sourceHeight) / 2 - crop.y / scale;
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = Math.max(1, Math.round(1080 / (crop.frame.clientWidth / crop.frame.clientHeight)));
    canvas.getContext('2d', { alpha:false }).drawImage(
      crop.image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height
    );
    state.betaBackground = canvas.toDataURL('image/jpeg', .84);
    document.getElementById('bnBetaBackgroundPreview').src = state.betaBackground;
    closeBetaCrop();
    toast('角色画面已更新');
  }

  function setupBetaCrop() {
    const frame = document.getElementById('bnBetaCropFrame');
    const zoom = document.getElementById('bnBetaCropZoom');
    let drag = null;
    frame.addEventListener('pointerdown', event => {
      if (!state.betaCrop) return;
      drag = { id:event.pointerId, startX:event.clientX, startY:event.clientY, x:state.betaCrop.x, y:state.betaCrop.y };
      frame.setPointerCapture?.(event.pointerId);
      frame.classList.add('is-dragging');
    });
    frame.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId || !state.betaCrop) return;
      state.betaCrop.x = drag.x + event.clientX - drag.startX;
      state.betaCrop.y = drag.y + event.clientY - drag.startY;
      renderBetaCrop();
    });
    const stop = event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      frame.classList.remove('is-dragging');
    };
    frame.addEventListener('pointerup', stop);
    frame.addEventListener('pointercancel', stop);
    zoom.addEventListener('input', event => {
      if (!state.betaCrop) return;
      state.betaCrop.zoom = Number(event.target.value);
      renderBetaCrop();
    });
  }

  async function handleBetaBackground(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('请选择图片文件');
    if (file.size > 15 * 1024 * 1024) return toast('图片不能超过 15MB');
    try {
      await openBetaCrop(file);
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
      voiceType: document.querySelector('[data-bn-beta-voice].is-active')?.dataset.bnBetaVoice || 'zh_male_ruyayichen_saturn_bigtts',
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
    return `与用户的关系是${oc.relationship || '学习搭子'}。完整人设：${oc.characterDescription || '温柔陪伴用户'}。需要称呼时只叫用户“${oc.userTitle || '大小姐'}”，不要每句话都称呼。`;
  }

  function betaRoleContext(oc) {
    return {
      name: oc.name || 'TA',
      userTitle: oc.userTitle || '大小姐',
      relationship: oc.relationship || '学习搭子',
      persona: oc.characterDescription || '温柔陪伴用户',
      voiceType: oc.voiceType || 'zh_male_ruyayichen_saturn_bigtts'
    };
  }

  async function showBetaMeeting() {
    const oc = currentOC();
    switchTab('beta-meeting');
    document.getElementById('bnBetaMeetingBackground').src = oc.avatar || fallbackAvatar;
    document.getElementById('bnBetaMeetingName').textContent = oc.name || 'TA';
    const caption = document.getElementById('bnBetaMeetingCaption');
    const form = document.getElementById('bnBetaMeetingForm');
    const startButton = document.getElementById('bnBetaStartTogether');
    const bodyDouble = document.getElementById('bnBetaBodyDouble');
    const input = document.getElementById('bnBetaMeetingTask');
    form.hidden = true;
    startButton.hidden = true;
    bodyDouble.hidden = true;
    input.value = '';
    state.betaMeetingTask = '';
    state.bodyDoubleTodos = [];
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
        body: JSON.stringify({ mode: 'session_opening', task, persona: betaPersona(oc), roleContext: betaRoleContext(oc), epoch: turn.epoch, turnId: turn.turnId })
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
    document.getElementById('bnBetaBodyDouble').hidden = false;
  }

  async function startBetaFocus() {
    const task = state.betaMeetingTask || '专注任务';
    const activityInput = document.getElementById('bnBetaBodyDoubleInput');
    const startButton = document.getElementById('bnBetaStartTogether');
    const activity = activityInput?.value.trim() || '看书';
    state.bodyDoubleActivity = activity;
    startButton.disabled = true;
    startButton.textContent = 'TA 正在安排自己的计划…';
    try {
      const oc = currentOC();
      const response = await fetch('/api/companion-observe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'body_double_plan', activity, durationMinutes: 25, persona: betaPersona(oc), roleContext: betaRoleContext(oc) })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || '计划生成失败');
      state.bodyDoubleTodos = Array.isArray(payload.data?.todos) ? payload.data.todos : [];
    } catch (error) {
      console.warn('Body double plan failed:', error);
      state.bodyDoubleTodos = [{ id: 1, title: `${activity}一会儿`, minutes: 8 }, { id: 2, title: `继续${activity}`, minutes: 9 }, { id: 3, title: '简单整理一下', minutes: 8 }];
    } finally {
      startButton.disabled = false;
      startButton.textContent = '一起开始';
    }
    selectedMinutes = 25;
    currentTime = 25 * 60;
    document.getElementById('bnTaskInput').value = task;
    document.querySelectorAll('.bn-duration').forEach(button => button.classList.toggle('is-active', button.dataset.bnMinutes === '25'));
    window.focusCompanion?.markMeetingComplete();
    startFocus();
    renderBodyDoublePlan();
  }

  function rollBodyDouble() {
    const choices = ['看书', '整理读书笔记', '处理工作邮件', '写今天的日记', '学习一门新课程', '整理桌面资料'];
    const input = document.getElementById('bnBetaBodyDoubleInput');
    if (input) input.value = choices[Math.floor(Math.random() * choices.length)];
  }

  function renderBodyDoublePlan() {
    const card = document.getElementById('bnBodyDoubleCard');
    const list = document.getElementById('bnBodyDoubleList');
    if (!card || !list) return;
    card.hidden = false;
    const companionName = currentOC().name || 'TA';
    const totalMinutes = Math.max(1, Number(selectedMinutes) || 25);
    const elapsedMinutes = Math.max(0, Math.min(totalMinutes, (totalMinutes * 60 - (Number(currentTime) || 0)) / 60));
    const userProgress = Math.round((elapsedMinutes / totalMinutes) * 100);
    const taskName = currentTask?.name || '专注任务';
    document.getElementById('bnBodyDoubleName').textContent = '专注进度';
    let companionTask = `陪你${currentStatus?.name || currentStatus?.status || '专注'}`;
    let companionDone = 0;
    let cumulative = 0;
    let activeTaskFound = false;
    state.bodyDoubleTodos.forEach(todo => {
      cumulative += Number(todo.minutes) || 0;
      if (elapsedMinutes >= cumulative) companionDone += 1;
      else if (!activeTaskFound) {
        companionTask = todo.title;
        activeTaskFound = true;
      }
    });
    const companionTotal = Math.max(1, state.bodyDoubleTodos.reduce((sum, todo) => sum + (Number(todo.minutes) || 0), 0) || totalMinutes);
    const companionElapsed = Math.floor(Math.min(companionTotal, elapsedMinutes));
    const companionProgress = Math.round((companionElapsed / companionTotal) * 100);
    list.innerHTML = `
      <div class="bn-focus-progress-row"><span class="bn-task-dot"></span><span class="bn-task-person">${escapeText(companionName)}</span><span class="bn-task-label">${escapeText(companionTask)}</span><time><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><circle class="is-value" cx="10" cy="10" r="7" pathLength="100" stroke-dasharray="${companionProgress} 100"/></svg>${companionElapsed}/${companionTotal}</time></div>
      <div class="bn-focus-progress-row"><span class="bn-task-dot"></span><span class="bn-task-person">你</span><span class="bn-task-label">${escapeText(taskName)}</span><time><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7"/><circle class="is-value" cx="10" cy="10" r="7" pathLength="100" stroke-dasharray="${userProgress} 100"/></svg>${Math.floor(elapsedMinutes)}/${totalMinutes}</time></div>`;
  }

  function ensureRainAudio() {
    if (state.rainAudio) return state.rainAudio;
    const audio = new Audio('/frontend/audio/ambient/rain-cc0.mp3');
    audio.id = 'bnRainPlayer';
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.03;
    state.rainAudio = audio;
    return audio;
  }

  function ensurePianoAudio() {
    if (state.pianoAudio) return state.pianoAudio;
    const audio = new Audio('/frontend/audio/ambient/cafe-calm-piano-cc-by.mp3');
    audio.id = 'bnPianoPlayer';
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.03;
    state.pianoAudio = audio;
    return audio;
  }

  function updateRainButton() {
    const button = document.getElementById('bnRainBtn');
    if (!button) return;
    const config = state.bgmMode === 'rain'
      ? { name: 'rainning', label: '当前背景音乐：雨声；点击切换轻音乐', title: 'rainning · 点击切换' }
      : state.bgmMode === 'piano'
        ? { name: 'lo-fi', label: '当前背景音乐：轻音乐；点击静音', title: 'lo-fi · 点击静音' }
        : { name: '静音', label: '背景音乐已静音；点击开启雨声', title: '静音 · 点击开启雨声' };
    button.classList.toggle('rain-active', state.bgmMode !== 'muted');
    button.setAttribute('aria-pressed', String(state.bgmMode !== 'muted'));
    button.setAttribute('aria-label', config.label);
    button.title = config.title;
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${state.bgmMode === 'muted' ? '<path d="M11 5L6.5 9H3v6h3.5l4.5 4V5zM16 9l5 6M21 9l-5 6"/>' : '<path d="M9 18V5l11-2v13M9 9l11-2M6.5 21C4.6 21 3 20 3 18.5S4.6 16 6.5 16 10 17 10 18.5 8.4 21 6.5 21zM17.5 19c-1.9 0-3.5-1-3.5-2.5s1.6-2.5 3.5-2.5 3.5 1 3.5 2.5-1.6 2.5-3.5 2.5z"/>'}</svg><span>${config.name}</span>`;
  }

  function startBgm() {
    updateRainButton();
    stopBgm(false);
    if (!isTimerRunning || isPaused) return;
    if (state.bgmMode === 'muted') {
      const keepAliveAudio = ensureRainAudio();
      keepAliveAudio.volume = 0.0001;
      keepAliveAudio.play().catch(error => console.warn('iOS 音频会话保活失败:', error));
      window.focusCompanion?.unlockAudio().catch(() => {});
      return;
    }
    const audio = state.bgmMode === 'piano' ? ensurePianoAudio() : ensureRainAudio();
    audio.volume = 0.03;
    audio.play().catch(error => {
      console.warn('背景音乐播放失败:', error);
      toast('点一下背景音乐按钮即可播放');
    });
  }

  function stopBgm(reset) {
    [state.rainAudio, state.pianoAudio].filter(Boolean).forEach(audio => {
      audio.pause();
      if (reset) audio.currentTime = 0;
    });
  }

  function cycleBgm() {
    state.bgmMode = state.bgmMode === 'rain' ? 'piano' : state.bgmMode === 'piano' ? 'muted' : 'rain';
    localStorage.setItem('bnBgmMode', state.bgmMode);
    window.focusCompanion?.unlockAudio().catch(() => {});
    startBgm();
    updateRainButton();
  }

  function toggleFocusChat(forceOpen) {
    const layer = document.getElementById('bnChatSheetLayer');
    if (!layer) return;
    const currentlyOpen = !layer.hidden && !layer.classList.contains('is-closing');
    const opening = typeof forceOpen === 'boolean' ? forceOpen : !currentlyOpen;
    const running = document.querySelector('.bn-focus-running');
    const viewport = window.visualViewport;
    window.clearTimeout(state.composerUnlockTimer);
    window.clearTimeout(state.composerCloseTimer);
    if (opening) {
      layer.hidden = false;
      layer.classList.remove('is-closing');
      layer.classList.add('is-open');
      state.composerLayoutHeight = Math.round(running?.getBoundingClientRect().height || window.innerHeight);
      running?.style.setProperty('--bn-focus-locked-height', `${state.composerLayoutHeight}px`);
      document.body.classList.add('bn-composer-open');
      const updatePosition = () => {
        const visibleBottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
        const keyboardInset = Math.max(0, state.composerLayoutHeight - visibleBottom);
        layer.style.setProperty('--bn-keyboard-inset', `${Math.round(keyboardInset)}px`);
      };
      state.composerViewportHandler = updatePosition;
      viewport?.addEventListener('resize', updatePosition);
      viewport?.addEventListener('scroll', updatePosition);
      updatePosition();
      const input = document.getElementById('bnFocusChatInput');
      input?.focus({ preventScroll:true });
      window.setTimeout(() => input?.focus({ preventScroll:true }), 80);
    } else {
      layer.classList.remove('is-open');
      layer.classList.add('is-closing');
      document.getElementById('bnFocusChatInput')?.blur();
      if (state.composerViewportHandler) {
        viewport?.removeEventListener('resize', state.composerViewportHandler);
        viewport?.removeEventListener('scroll', state.composerViewportHandler);
        state.composerViewportHandler = null;
      }
      state.composerUnlockTimer = window.setTimeout(() => {
        running?.style.removeProperty('--bn-focus-locked-height');
        document.body.classList.remove('bn-composer-open');
        layer.style.removeProperty('--bn-keyboard-inset');
      }, 320);
      state.composerCloseTimer = window.setTimeout(() => {
        layer.hidden = true;
        layer.classList.remove('is-closing');
      }, 190);
    }
  }

  const focusChatStorageKey = 'bnFocusChatHistoryV1';

  function readFocusChatHistory() {
    try {
      const history = JSON.parse(localStorage.getItem(focusChatStorageKey) || '[]');
      return Array.isArray(history) ? history.slice(-100) : [];
    } catch (_) { return []; }
  }

  function appendFocusChatHistory(role, text) {
    const content = String(text || '').trim();
    if (!content) return;
    const history = readFocusChatHistory();
    const previous = history[history.length - 1];
    if (!previous || previous.role !== role || previous.text !== content) {
      history.push({ role, text:content, at:Date.now() });
      localStorage.setItem(focusChatStorageKey, JSON.stringify(history.slice(-100)));
    }
    renderFocusChatHistory();
  }

  function renderFocusChatHistory() {
    const list = document.getElementById('bnFocusChatHistory');
    if (!list) return;
    const history = readFocusChatHistory();
    list.innerHTML = history.length
      ? history.map(item => `<div class="is-${item.role}">${escapeText(item.text)}</div>`).join('')
      : '<p>现在还没有对话，和 TA 说点什么吧。</p>';
    list.scrollTop = list.scrollHeight;
  }

  function setupCameraDrag() {
    const preview = document.getElementById('bnCameraPreview');
    const stage = preview?.parentElement;
    if (!preview || !stage) return;
    const storageKey = 'bnCameraPreviewPosition';
    let drag = null;
    const pointers = new Map();
    let pinch = null;

    const pointerDistance = () => {
      const [first, second] = [...pointers.values()];
      return first && second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
    };

    const savePreview = () => {
      const maxLeft = Math.max(1, stage.clientWidth - preview.offsetWidth);
      const maxTop = Math.max(1, stage.clientHeight - preview.offsetHeight);
      localStorage.setItem(storageKey, JSON.stringify({
        x: Math.max(0, Math.min(1, preview.offsetLeft / maxLeft)),
        y: Math.max(0, Math.min(1, preview.offsetTop / maxTop)),
        width: preview.offsetWidth
      }));
    };

    const applySavedPosition = () => {
      if (preview.hidden) return;
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;
        if (Number.isFinite(saved.width)) preview.style.width = `${Math.max(68, Math.min(128, saved.width))}px`;
        const maxLeft = Math.max(0, stage.clientWidth - preview.offsetWidth);
        const maxTop = Math.max(0, stage.clientHeight - preview.offsetHeight);
        preview.style.left = `${Math.round(Math.max(0, Math.min(1, saved.x)) * maxLeft)}px`;
        preview.style.top = `${Math.round(Math.max(0, Math.min(1, saved.y)) * maxTop)}px`;
        preview.style.right = 'auto';
        preview.style.bottom = 'auto';
      } catch (_) {}
    };

    preview.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      const stageRect = stage.getBoundingClientRect();
      const previewRect = preview.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: previewRect.left - stageRect.left,
        top: previewRect.top - stageRect.top,
        moved: false
      };
      pointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
      if (pointers.size === 2) pinch = { distance:pointerDistance(), width:preview.offsetWidth };
      preview.setPointerCapture?.(event.pointerId);
      preview.classList.add('is-dragging');
      event.preventDefault();
    });

    preview.addEventListener('pointermove', event => {
      if (!pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x:event.clientX, y:event.clientY });
      if (pointers.size >= 2 && pinch) {
        const width = Math.max(68, Math.min(128, pinch.width * pointerDistance() / Math.max(1, pinch.distance)));
        preview.style.width = `${Math.round(width)}px`;
        const maxLeft = Math.max(0, stage.clientWidth - preview.offsetWidth);
        const maxTop = Math.max(0, stage.clientHeight - preview.offsetHeight);
        preview.style.left = `${Math.min(maxLeft, preview.offsetLeft)}px`;
        preview.style.top = `${Math.min(maxTop, preview.offsetTop)}px`;
        event.preventDefault();
        return;
      }
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 6) drag.moved = true;
      const maxLeft = Math.max(0, stage.clientWidth - preview.offsetWidth);
      const maxTop = Math.max(0, stage.clientHeight - preview.offsetHeight);
      const left = Math.max(0, Math.min(maxLeft, drag.left + event.clientX - drag.startX));
      const top = Math.max(0, Math.min(maxTop, drag.top + event.clientY - drag.startY));
      preview.style.left = `${Math.round(left)}px`;
      preview.style.top = `${Math.round(top)}px`;
      preview.style.right = 'auto';
      preview.style.bottom = 'auto';
      event.preventDefault();
    });

    const finishDrag = event => {
      if (!pointers.has(event.pointerId)) return;
      const tapped = event.type === 'pointerup' && pointers.size === 1 && drag?.pointerId === event.pointerId && !drag.moved;
      pointers.delete(event.pointerId);
      if (drag?.pointerId === event.pointerId) drag = null;
      pinch = null;
      if (pointers.size === 1) {
        const [pointerId, point] = pointers.entries().next().value;
        drag = { pointerId, startX:point.x, startY:point.y, left:preview.offsetLeft, top:preview.offsetTop, moved:true };
      } else {
        preview.classList.remove('is-dragging');
      }
      savePreview();
      if (tapped) window.focusCompanion?.toggleCamera();
    };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => preview.addEventListener(type, finishDrag));
    preview.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      window.focusCompanion?.toggleCamera();
    });
    new MutationObserver(applySavedPosition).observe(preview, { attributes: true, attributeFilter: ['hidden'] });
    window.addEventListener('resize', applySavedPosition);
    window.requestAnimationFrame(applySavedPosition);
  }

  async function submitFocusChat(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = document.getElementById('bnFocusChatInput');
    const button = form.querySelector('button[type="submit"]');
    const text = input?.value.trim();
    if (!text || !window.focusCompanion?.sendDialogue) return;
    input.value = '';
    button.disabled = true;
    appendFocusChatHistory('user', text);
    toggleFocusChat(false);
    input.disabled = true;
    button.disabled = true;
    try {
      await window.focusCompanion.sendDialogue(text);
    } finally {
      input.disabled = false;
      button.disabled = !input.value.trim();
      if (!document.getElementById('bnChatSheetLayer')?.hidden) input.focus({ preventScroll:true });
    }
  }

  function updateFocusChatSendState(event) {
    const input = event.currentTarget;
    const button = document.querySelector('#bnFocusChatForm button[type="submit"]');
    if (button) button.disabled = !input.value.trim();
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
    document.getElementById('bnPause').innerHTML = paused
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5l11 7-11 7V5z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
    document.getElementById('bnCallTask').textContent = `${currentStatus && currentStatus.icon ? currentStatus.icon : '📖'} ${currentTask && currentTask.name ? currentTask.name : '专注中'}`;
    renderBodyDoublePlan();
  }

  function refreshUI() {
    if (state.tab === 'running' && !isTimerRunning && !isPaused) {
      stopCaptions();
      stopBgm(true);
      switchTab('focus');
      return;
    }
    const oc = currentOC();
    const name = oc.name || '你的 TA';
    const title = oc.userTitle || '你';
    const avatar = oc.avatar || fallbackAvatar;
    syncBetaFocusBackground(avatar);
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
    document.getElementById('bnCallSub').innerHTML = `专注中<span>·</span>和 ${escapeText(name)} 一起`;
    const focusChatInput = document.getElementById('bnFocusChatInput');
    focusChatInput.placeholder = `和${name}说点什么……`;
    const dialogueButton = document.getElementById('bnVoiceInputBtn');
    dialogueButton.dataset.roleName = name;
    if (!dialogueButton.matches('.is-listening,.is-processing')) dialogueButton.setAttribute('aria-label', `和${name}说话`);
    dialogueButton.title = `和${name}说话 · 轻触打字 · 长按说话`;
    renderTasks();
    renderGifts();
    renderOCPool();
    refreshTimer();
  }

  async function loadPrototypeScene() {
    const target = document.getElementById('bnStageImage');
    if (isBetaMode) {
      syncBetaFocusBackground();
      return;
    }
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
    window.addEventListener('tamoto:focus-complete', () => {
      if (!isBetaMode) return;
      stopBgm(true);
      stopCaptions();
      returnFromFocusSession();
    });
    document.getElementById('bnApp').addEventListener('click', event => {
      const go = event.target.closest('[data-bn-go]');
      if (go) return switchTab(go.dataset.bnGo);
      const betaTab = event.target.closest('[data-bn-beta-tab]');
      if (betaTab) return setBetaTab(betaTab.dataset.bnBetaTab);
      const betaRelation = event.target.closest('[data-bn-beta-relation]');
      if (betaRelation) return setBetaRelationship(betaRelation.dataset.bnBetaRelation);
      const duration = event.target.closest('[data-bn-minutes]');
      if (duration) return setDuration(duration.dataset.bnMinutes, duration);
      const status = event.target.closest('[data-bn-status]');
      if (status) return setStatus(status);
      const betaVoice = event.target.closest('[data-bn-beta-voice]');
      if (betaVoice) {
        document.querySelectorAll('[data-bn-beta-voice]').forEach(button => {
          const active = button === betaVoice;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', String(active));
          const label = button.querySelector('em');
          if (label) label.textContent = active ? '已选择' : '选择';
        });
        document.getElementById('bnBetaVoiceName').textContent = betaVoice.querySelector('b')?.textContent || '当前声音';
        window.focusCompanion?.previewVoice(betaVoice.dataset.bnBetaVoice);
        toast(`正在试听${betaVoice.querySelector('b')?.textContent || '男声'}`);
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
      if (type === 'toggle-camera' && window.focusCompanion) window.focusCompanion.toggleCamera();
      if (type === 'next-caption') nextCaption();
      if (type === 'toggle-rain') cycleBgm();
      if (type === 'toggle-focus-chat') toggleFocusChat();
      if (type === 'close-chat-sheet') toggleFocusChat(false);
      if (type === 'cancel-end-focus') showEndConfirm(false);
      if (type === 'confirm-end-focus') stopFocusSession();
      if (type === 'beta-edit-role') {
        populateBetaRoleForm();
        switchTab('beta-setup');
      }
      if (type === 'beta-show-settings') document.getElementById('bnBetaRoleForm')?.classList.remove('is-card-hidden');
      if (type === 'beta-cancel-crop') closeBetaCrop();
      if (type === 'beta-apply-crop') applyBetaCrop();
      if (type === 'beta-start-together') startBetaFocus();
      if (type === 'roll-body-double') rollBodyDouble();
      if (type === 'beta-improve-persona') improveBetaPersona();
      if (type === 'beta-preview-voice') previewSelectedBetaVoice();
      if (type === 'beta-next-voice') selectNextBetaVoice();
      if (type === 'gifts' && typeof showGiftModal === 'function') showGiftModal();
      if (type === 'edit-oc' || type === 'new-oc' || type === 'advanced') {
        toast('该功能正在迁移到新界面');
      }
    });
    document.querySelectorAll('.bn-acc-head').forEach(button => button.addEventListener('click', () => button.parentElement.classList.toggle('is-open')));
    document.getElementById('bnChatForm').addEventListener('submit', submitChat);
    document.getElementById('bnFocusChatForm').addEventListener('submit', submitFocusChat);
    document.getElementById('bnFocusChatInput').addEventListener('input', updateFocusChatSendState);
    document.querySelector('.bn-chat-composer-dismiss').addEventListener('click', () => toggleFocusChat(false));
    document.getElementById('bnTaskInput').addEventListener('change', syncTaskInput);
    document.getElementById('bnBetaRoleForm').addEventListener('submit', saveBetaRole);
    document.getElementById('bnBetaMeetingForm').addEventListener('submit', submitBetaMeetingTask);
    document.getElementById('bnBetaBackgroundInput').addEventListener('change', event => handleBetaBackground(event.target.files?.[0]));
    document.getElementById('bnBetaRelationship').addEventListener('change', event => {
      setBetaRelationship(event.target.value);
    });
    document.getElementById('bnBetaName').addEventListener('input', updateBetaIdentity);
    const voiceButton = document.getElementById('bnVoiceInputBtn');
    if (voiceButton && window.focusCompanion) {
      let dialogueGesture = null;
      voiceButton.addEventListener('pointerdown', event => {
        event.preventDefault();
        voiceButton.setPointerCapture?.(event.pointerId);
        dialogueGesture = { id:event.pointerId, startY:event.clientY, recording:false, cancel:false, timer:null };
        voiceButton.classList.add('is-pressed');
        dialogueGesture.timer = window.setTimeout(() => {
          if (!dialogueGesture) return;
          dialogueGesture.recording = true;
          voiceButton.classList.add('is-listening');
          document.getElementById('bnVoiceStatus').hidden = false;
          window.focusCompanion.startVoiceInput();
          navigator.vibrate?.(24);
        }, 320);
      });
      voiceButton.addEventListener('pointermove', event => {
        if (!dialogueGesture || dialogueGesture.id !== event.pointerId || !dialogueGesture.recording) return;
        dialogueGesture.cancel = dialogueGesture.startY - event.clientY > 56;
        voiceButton.classList.toggle('is-cancelling', dialogueGesture.cancel);
        document.getElementById('bnVoiceStatus').textContent = dialogueGesture.cancel ? '松开取消' : '松开发送';
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => {
        voiceButton.addEventListener(type, event => {
          if (!dialogueGesture || dialogueGesture.id !== event.pointerId) return;
          event.preventDefault();
          window.clearTimeout(dialogueGesture.timer);
          const { recording, cancel } = dialogueGesture;
          dialogueGesture = null;
          voiceButton.classList.remove('is-pressed','is-listening','is-cancelling');
          document.getElementById('bnVoiceStatus').hidden = true;
          document.getElementById('bnVoiceStatus').textContent = '松开发送';
          if (recording) window.focusCompanion.stopVoiceInput(cancel || type !== 'pointerup');
          else if (type === 'pointerup') toggleFocusChat(true);
        });
      });
      voiceButton.addEventListener('contextmenu', event => event.preventDefault());
    }
    window.addEventListener('focus-voice-result', event => appendFocusChatHistory('user', event.detail?.text));
    window.addEventListener('focus-voice-live', event => {
      const status = document.getElementById('bnVoiceStatus');
      if (status && !status.hidden) status.textContent = event.detail?.text || '松开发送';
    });
    window.addEventListener('focus-dialogue-spoken', event => appendFocusChatHistory('assistant', event.detail?.reaction));
    const pauseButton = document.getElementById('bnPause');
    if (pauseButton) {
      let holdTimer = null;
      let longPressed = false;
      const cancelHold = () => {
        if (holdTimer) window.clearTimeout(holdTimer);
        holdTimer = null;
      };
      pauseButton.addEventListener('pointerdown', event => {
        event.preventDefault();
        longPressed = false;
        pauseButton.setPointerCapture?.(event.pointerId);
        pauseButton.classList.add('is-holding');
        holdTimer = window.setTimeout(() => {
          longPressed = true;
          pauseButton.classList.remove('is-holding');
          navigator.vibrate?.(40);
          showEndConfirm(true);
        }, 800);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => pauseButton.addEventListener(type, event => {
        event.preventDefault();
        const shouldPause = type === 'pointerup' && !longPressed && Boolean(holdTimer);
        cancelHold();
        pauseButton.classList.remove('is-holding');
        if (shouldPause) pauseFocus();
      }));
      pauseButton.addEventListener('contextmenu', event => event.preventDefault());
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
    setupBetaCardDismiss();
    setupBetaSetupKeyboard();
    setupBetaCrop();
    setupBetaMeetingKeyboard();
    setupCameraDrag();
    if (localStorage.getItem('bnDialogueTipSeen') !== 'true') {
      const tip = document.getElementById('bnDialogueTip');
      tip.hidden = false;
      localStorage.setItem('bnDialogueTipSeen', 'true');
      window.setTimeout(() => tip.classList.add('is-leaving'), 2400);
      window.setTimeout(() => { tip.hidden = true; }, 3000);
    }
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
