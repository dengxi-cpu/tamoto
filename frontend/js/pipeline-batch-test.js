(() => {
  const $ = id => document.getElementById(id);
  const rows = [];
  const epoch = Date.now();
  let nextId = 0;
  let defaultPrompts = {};
  let promptOverrides = {};
  let editingPrompt = '';

  const safeJson = value => JSON.stringify(value ?? null, null, 2);
  const statusLabel = status => ({ idle:'待生成', running:'运行中', success:'完成', failed:'失败', skipped:'跳过' }[status] || status);
  const stage = (label, input = null) => ({ label, status:'idle', input, output:null, durationMs:null, error:'' });

  function selectedVoice() {
    const option = $('voice').selectedOptions[0];
    const provider = option?.dataset.provider || 'volcengine';
    return {
      voiceProvider:provider,
      voiceType:provider === 'elevenlabs' ? '' : option?.value || '',
      voiceId:provider === 'elevenlabs' ? option?.value || '' : '',
      voiceName:option?.textContent?.trim() || '当前声音',
      speechLanguage:$('language').value === 'en' ? 'en' : 'zh'
    };
  }

  function makeRow(file, image, width, height) {
    const id = ++nextId;
    return {
      id, file, image, width, height, status:'idle', startedAt:null, controller:null, audioUrl:'',
      stages: {
        vlm:stage('VLM 视觉编码', { image:{ name:file.name, type:file.type, width, height, payload:'[图片数据已省略]' } }),
        working:stage('Working Memory', { previousEvents:[], maxEvents:24, ttlSeconds:180 }),
        memory:stage('Memory LLM'), actor:stage('Actor LLM'), tts:stage('TTS 输出')
      }
    };
  }

  function badge(status) { return `<span class="badge ${status}">${status === 'running' ? '● ' : ''}${statusLabel(status)}</span>`; }
  function text(value, fallback = '等待生成') { return String(value || fallback); }
  function esc(value) { return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }

  function stageCell(item, key, summary) {
    const current = item.stages[key];
    const detail = current.status === 'failed' ? current.error : summary;
    return `<td><div class="cell ${current.status === 'idle' ? 'empty-cell' : ''}">${badge(current.status)}<div class="cell-main">${esc(text(detail))}</div>${current.status !== 'idle' ? `<button class="inspect" data-detail="${item.id}:${key}">查看输入 / 输出${current.durationMs != null ? ` · ${current.durationMs} ms` : ''}</button>` : ''}</div></td>`;
  }

  function render() {
    $('summary').textContent = `${rows.length} 条记录 · ${rows.filter(item => item.status === 'success').length} 条完成`;
    $('empty').hidden = rows.length > 0;
    $('rows').innerHTML = rows.map((item, index) => {
      const observation = item.stages.vlm.output || {};
      const memory = item.stages.memory.output || {};
      const actor = item.stages.actor.output || {};
      const tts = item.stages.tts;
      const audio = item.audioUrl ? `<audio controls preload="metadata" src="${item.audioUrl}"></audio><a class="download" href="${item.audioUrl}" download="tamoto-tts-${item.id}.${tts.output?.format === 'mp3' ? 'mp3' : 'wav'}">下载音频</a>` : '';
      return `<tr>
        <td class="index">${index + 1}</td>
        <td><img class="thumb" src="${item.image}" alt="${esc(item.file.name)}" data-image="${item.id}"><span class="shot-meta">${esc(item.file.name)}<br>${item.width}×${item.height}</span></td>
        ${stageCell(item,'vlm',observation.scene || observation.observation)}
        ${stageCell(item,'working',item.stages.working.output ? `接收视觉事件 · 当前 ${item.stages.working.output.eventCountAfterAppend} 条` : '')}
        ${stageCell(item,'memory',memory.responseIntent || memory.reason || (memory.shouldSpeak === false ? '决定保持沉默' : ''))}
        ${stageCell(item,'actor',actor.reaction || (item.stages.actor.status === 'skipped' ? '本轮策略决定不说话' : ''))}
        <td><div class="audio-box">${badge(tts.status)}${tts.error ? `<span>${esc(tts.error)}</span>` : audio || '<span class="cell-main">等待语音生成</span>'}${tts.status !== 'idle' ? `<button class="inspect" data-detail="${item.id}:tts">查看输入 / 输出${tts.durationMs != null ? ` · ${tts.durationMs} ms` : ''}</button>` : ''}</div></td>
        <td><div class="row-actions"><button class="run" data-run="${item.id}" ${item.status === 'running' ? 'disabled' : ''}>单独生成</button><button class="remove" data-remove="${item.id}" ${item.status === 'running' ? 'disabled' : ''}>删除</button></div></td>
      </tr>`;
    }).join('');
    $('runAll').disabled = !rows.length || rows.some(item => item.status === 'running');
  }

  function fileToJpeg(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('读取图片失败'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('无法解析图片'));
        image.onload = () => {
          const scale = Math.min(1, 1280 / image.naturalWidth, 1280 / image.naturalHeight);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve({ dataUrl:canvas.toDataURL('image/jpeg', .78), width:canvas.width, height:canvas.height });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function addFiles(fileList) {
    for (const file of [...fileList].filter(file => file.type.startsWith('image/'))) {
      try {
        const converted = await fileToJpeg(file);
        rows.push(makeRow(file, converted.dataUrl, converted.width, converted.height));
      } catch (error) { window.alert(`${file.name}：${error.message}`); }
    }
    render();
  }

  async function loadMockRow() {
    try {
      const response = await fetch('/frontend/assets/mock/focus-phone-sample.jpg', { cache:'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      await addFiles([new File([blob], '手机分心示例.jpg', { type:blob.type || 'image/jpeg' })]);
    } catch (error) { console.warn('示例截图加载失败:', error); }
  }

  function mark(item, key, status, values = {}) { Object.assign(item.stages[key], { status, ...values }); render(); }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${payload.stage ? `[${payload.stage}] ` : ''}${payload.error || `HTTP ${response.status}`}`);
    return payload.data || {};
  }

  function pcmToWav(pcm, sampleRate) {
    const buffer = new ArrayBuffer(44 + pcm.byteLength);
    const view = new DataView(buffer);
    const write = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0,'RIFF'); view.setUint32(4,36 + pcm.byteLength,true); write(8,'WAVE'); write(12,'fmt ');
    view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true); view.setUint32(24,sampleRate,true);
    view.setUint32(28,sampleRate * 2,true); view.setUint16(32,2,true); view.setUint16(34,16,true); write(36,'data'); view.setUint32(40,pcm.byteLength,true);
    new Uint8Array(buffer,44).set(new Uint8Array(pcm));
    return new Blob([buffer], { type:'audio/wav' });
  }

  async function generateTts(item, result) {
    const textValue = result.reaction || '';
    const input = { text:textValue, ...selectedVoice(), performance:result.performance || null, epoch, turnId:item.id, speechType:'visual' };
    if (!textValue) {
      mark(item,'tts','skipped',{ input, output:{ status:'skipped', reason:'Memory LLM 决定本轮不发言' } });
      return;
    }
    mark(item,'tts','running',{ input });
    const started = performance.now();
    const response = await fetch('/api/tts-stream', { method:'POST', headers:{'Content-Type':'application/json'}, signal:item.controller.signal, body:JSON.stringify(input) });
    if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || `TTS HTTP ${response.status}`); }
    const raw = await response.arrayBuffer();
    if (!raw.byteLength) throw new Error('TTS 没有返回音频');
    const format = response.headers.get('x-audio-format') || 'pcm_s16le';
    const sampleRate = Number(response.headers.get('x-audio-sample-rate')) || 24000;
    const blob = format === 'mp3' ? new Blob([raw], { type:'audio/mpeg' }) : pcmToWav(raw, sampleRate);
    if (item.audioUrl) URL.revokeObjectURL(item.audioUrl);
    item.audioUrl = URL.createObjectURL(blob);
    mark(item,'tts','success',{ durationMs:Math.round(performance.now() - started), output:{ status:'completed', bytes:raw.byteLength, format:format === 'mp3' ? 'mp3' : 'wav', sampleRate } });
  }

  async function run(item) {
    if (!item || item.status === 'running') return;
    item.status = 'running'; item.controller = new AbortController(); item.startedAt = performance.now();
    Object.values(item.stages).forEach(current => Object.assign(current,{ status:'idle', output:null, durationMs:null, error:'' }));
    mark(item,'vlm','running');
    const persona = $('persona').value.trim();
    const voice = selectedVoice();
    const request = { image:item.image, task:$('task').value.trim() || '保持专注学习', persona, roleContext:{ name:'TA', userTitle:'大小姐', relationship:'学习搭子', persona, ...voice }, epoch, turnId:item.id, elapsedSeconds:0, workingMemory:[], recentObservations:[], policyState:{}, promptOverrides };
    try {
      const result = await requestJson('/api/companion-observe', { method:'POST', headers:{'Content-Type':'application/json'}, signal:item.controller.signal, body:JSON.stringify(request) });
      mark(item,'vlm','success',{ durationMs:result.timings?.visionMs, output:result.observation });
      mark(item,'working','success',{ input:{ previousEvents:[], maxEvents:24, ttlSeconds:180 }, output:{ acceptedObservation:result.observation, eventCountBeforeAppend:0, eventCountAfterAppend:1 } });
      mark(item,'memory',result.memory?.degraded ? 'failed' : 'success',{ durationMs:result.timings?.memoryMs, input:{ observation:result.observation, workingMemory:[], task:request.task, elapsedSeconds:0, policyState:{} }, output:{ ...result.memory, decision:result.decision } });
      mark(item,'actor',result.decision?.shouldSpeak ? (result.messages?.length ? 'success' : 'failed') : 'skipped',{ durationMs:result.timings?.reactionMs, input:{ persona:request.persona, speechLanguage:voice.speechLanguage, task:request.task, memoryDecision:result.memory }, output:{ messages:result.messages || [], reaction:result.reaction || '', performance:result.performance || null } });
      try { await generateTts(item, result); } catch (error) { mark(item,'tts','failed',{ durationMs:Math.round(performance.now() - item.startedAt), error:error.message, output:{ status:'failed', error:error.message } }); }
      item.status = item.stages.tts.status === 'failed' ? 'failed' : 'success';
    } catch (error) {
      const active = Object.keys(item.stages).find(key => item.stages[key].status === 'running') || 'vlm';
      mark(item,active,'failed',{ error:error.name === 'AbortError' ? '请求已取消' : error.message, output:{ error:error.message } });
      item.status = 'failed';
    } finally { item.controller = null; render(); }
  }

  async function runAll() {
    $('runAll').disabled = true;
    for (const item of rows) await run(item);
    render();
  }

  function showDetail(id, key) {
    const item = rows.find(row => row.id === Number(id)); const current = item?.stages[key];
    if (!current) return;
    $('detailTitle').textContent = current.label; $('detailStageType').textContent = `${key.toUpperCase()} · ${statusLabel(current.status)}`;
    $('detailInput').textContent = safeJson(current.input); $('detailOutput').textContent = safeJson(current.output || (current.error ? { error:current.error } : null));
    $('detailDialog').showModal();
  }

  function openPrompt(key) {
    editingPrompt = key;
    const names = { vlm:'VLM 视觉编码', working:'Working Memory', memory:'Memory LLM', actor:'Actor LLM / 文案' };
    const readOnly = key === 'working';
    $('promptTitle').textContent = `${names[key]} · ${readOnly ? '运行规则' : '系统提示词'}`;
    $('promptHint').textContent = readOnly
      ? 'Working Memory 是确定性数据处理阶段，不调用模型，因此没有系统提示词。下面展示的是当前运行规则。'
      : '修改只作用于本批测页面的后续请求，不会改变正式监督模式。Actor 提示词中的 {{persona}} 会在请求时替换为上方角色人设。';
    $('promptText').value = promptOverrides[key] || defaultPrompts[key] || '正在读取后端默认值…';
    $('promptText').readOnly = readOnly;
    $('savePrompt').disabled = readOnly;
    $('resetPrompt').disabled = readOnly;
    $('promptDialog').showModal();
  }

  function savePrompt() {
    if (!editingPrompt || editingPrompt === 'working') return;
    const value = $('promptText').value.trim();
    if (!value) return window.alert('系统提示词不能为空');
    promptOverrides = { ...promptOverrides, [editingPrompt]:value };
    localStorage.setItem('tamotoBatchPromptOverrides', JSON.stringify(promptOverrides));
    $('promptDialog').close();
  }

  function resetPrompt() {
    if (!editingPrompt || editingPrompt === 'working') return;
    delete promptOverrides[editingPrompt];
    localStorage.setItem('tamotoBatchPromptOverrides', JSON.stringify(promptOverrides));
    $('promptText').value = defaultPrompts[editingPrompt] || '';
  }

  document.querySelectorAll('#files,[data-empty-upload],[data-add-upload]').forEach(input => input.addEventListener('change', event => { addFiles(event.target.files); event.target.value=''; }));
  $('runAll').addEventListener('click', runAll);
  $('clear').addEventListener('click', () => { rows.forEach(item => { item.controller?.abort(); if(item.audioUrl) URL.revokeObjectURL(item.audioUrl); }); rows.length=0; render(); });
  $('rows').addEventListener('click', event => {
    const detail = event.target.closest('[data-detail]'); if (detail) return showDetail(...detail.dataset.detail.split(':'));
    const runButton = event.target.closest('[data-run]'); if (runButton) return run(rows.find(item => item.id === Number(runButton.dataset.run)));
    const remove = event.target.closest('[data-remove]'); if (remove) { const index=rows.findIndex(item => item.id===Number(remove.dataset.remove)); if(index>=0){if(rows[index].audioUrl)URL.revokeObjectURL(rows[index].audioUrl);rows.splice(index,1);render();} return; }
    const image = event.target.closest('[data-image]'); if(image){const item=rows.find(row=>row.id===Number(image.dataset.image));$('largeImage').src=item.image;$('imageDialog').showModal();}
  });
  $('closeDetail').addEventListener('click', () => $('detailDialog').close());
  document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => openPrompt(button.dataset.prompt)));
  $('closePrompt').addEventListener('click', () => $('promptDialog').close());
  $('savePrompt').addEventListener('click', savePrompt);
  $('resetPrompt').addEventListener('click', resetPrompt);
  $('closeImage').addEventListener('click', () => $('imageDialog').close());
  $('imageDialog').addEventListener('click', event => { if(event.target === $('imageDialog')) $('imageDialog').close(); });

  try { promptOverrides = JSON.parse(localStorage.getItem('tamotoBatchPromptOverrides') || '{}') || {}; } catch (_) { promptOverrides = {}; }
  fetch('/api/companion-observe',{cache:'no-store'}).then(response=>response.json()).then(payload=>{ defaultPrompts=payload.data?.prompts||{}; }).catch(error=>console.warn('提示词读取失败:',error));
  fetch('/api/vision-health',{cache:'no-store'}).then(response=>response.json()).then(payload=>{
    const data=payload.data||{}; const ready=data.configured&&data.reactionConfigured&&data.ttsKeyConfigured&&data.ttsVoiceConfigured;
    $('health').className=`health ${ready?'ok':'bad'}`; $('health').querySelector('span').textContent=ready?'视觉、反应与 TTS 已配置':'部分后端能力尚未配置';
  }).catch(()=>{$('health').className='health bad';$('health').querySelector('span').textContent='后端健康检查失败';});
  render();
  loadMockRow();
})();
