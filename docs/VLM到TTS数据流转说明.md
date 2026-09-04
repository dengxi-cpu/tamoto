# VLM 到 TTS 数据流转说明

本文说明专注陪伴正式链路中，一张摄像头截图如何逐步变成可播放语音，以及每一步到底把哪些数据传给了下一步。

## 1. 先看结论

VLM 的输出不会直接交给 TTS。真实链路是：

```text
浏览器截图
  │ image（Base64 JPEG）
  ▼
POST /api/companion-observe
  │
  ├─ VLM：图片 → observation（客观视觉观察）
  │
  ├─ Memory LLM：observation + 历史记忆 → memory（是否说话、表达意图）
  │
  ├─ 代码策略层：memory.shouldSpeak + 8 秒间隔 → decision.shouldSpeak
  │
  └─ Actor LLM：memory → reaction（台词）+ performance（表演参数）
  │
  ▼
浏览器收到 companion-observe 的完整 JSON
  │
  ├─ decision.shouldSpeak = false：结束，不调用 TTS
  │
  └─ decision.shouldSpeak = true：取 reaction/messages + performance
       │
       ▼
     POST /api/tts-stream
       │ text + performance + voice 配置
       ▼
     ElevenLabs / 火山 TTS
       │ PCM 24 kHz 音频字节流
       ▼
     浏览器 Web Audio 分块排播
```

这里存在两个独立的 HTTP 请求：

1. 浏览器请求 `/api/companion-observe`，完成 VLM、Memory、Actor，返回文字结果。
2. 浏览器再请求 `/api/tts-stream`，把 Actor 文字结果变成音频。

因此，`companion-observe` 后端并没有直接调用 TTS；连接 Actor 和 TTS 的“胶水”在浏览器的 `focus-companion.js` 中。

## 2. 本轮请求从浏览器进入后端

浏览器在 `runObservation()` 中截取摄像头画面，并向 `/api/companion-observe` 发送：

```json
{
  "image": "data:image/jpeg;base64,...",
  "task": "背单词",
  "persona": "角色人设",
  "roleContext": { "voiceProvider": "...", "voiceId": "..." },
  "epoch": 123,
  "turnId": 4,
  "sessionStartedAt": "ISO 时间",
  "elapsedSeconds": 60,
  "recentObservations": [],
  "workingMemory": [],
  "storyMemory": {},
  "relationshipMemory": {},
  "conversationHistory": [],
  "policyState": {}
}
```

这些字段的用途：

| 字段 | 去向 | 作用 |
| --- | --- | --- |
| `image` | VLM | 当前帧图片 |
| `task`、`persona` | Memory、Actor | 当前任务和角色表达约束 |
| `workingMemory` | Memory | 最近最多 24 条事件；Memory 实际截取最近 10 条组成提示词 |
| `storyMemory` | Memory | 当前会话的长期故事摘要 |
| `relationshipMemory` | Memory、Actor | 跨会话关系记忆 |
| `conversationHistory` | Memory | 最近最多 8 条对话 |
| `policyState.lastAnySpokenAt` | 代码策略层 | 判断是否满足最短发言间隔 |
| `epoch`、`turnId` | 返回结果、TTS | 标识本次会话和轮次，避免过期音频串台 |

入口代码：`frontend/js/focus-companion.js` 的观察请求，以及 `api/companion-observe.js` 的请求清洗逻辑。

## 3. VLM：图片变成结构化 observation

`runCompanionPipeline()` 首先执行：

```js
const observation = await describeScene(image, promptOverrides.vlm);
```

VLM 读取 `image`，返回类似：

```json
{
  "observation": "用户低头注视并操作手中的手机",
  "scene": "用户低头注视并操作手中的手机",
  "visibleFacts": {
    "phone": true,
    "gaze": "phone",
    "hands": "holding",
    "position": "seated",
    "phoneInteraction": "scrolling"
  },
  "state": "PHONE",
  "confidence": 0.93,
  "phoneVisible": true
}
```

代码还会拿上一条历史观察生成 `observation.changes`：

```json
{
  "changes": [
    "上一轮：用户正在书写",
    "现在：用户低头注视并操作手机"
  ]
}
```

### VLM → Memory 的字段交接

VLM 输出的整个 `observation` 对象直接作为 `runMemoryLLM()` 的 `observation` 参数传入，没有经过序列化中转：

```js
runMemoryLLM({
  observation,
  task,
  persona,
  elapsedSeconds,
  workingMemory,
  storyMemory,
  relationshipMemory,
  conversationHistory
})
```

Memory LLM 提示词中的“最新视觉观察”来自：

| Memory 提示词字段 | 来源 |
| --- | --- |
| `latest.state` | `observation.state` |
| `latest.observation` | `observation.observation`，为空时回退 `scene` |
| `latest.visibleFacts` | `observation.visibleFacts` |
| `latest.phoneVisible` | `observation.phoneVisible` |
| `latest.confidence` | `observation.confidence` |
| `latest.changes` | `observation.changes` |

## 4. Working Memory：它不是本轮的一次模型调用

Working Memory 是浏览器内存中的事件数组，不是独立 LLM，也没有单独的网络请求。

当前实现里，本轮最新 `observation` 与旧 `workingMemory` 是两个并列入参，一起交给 Memory LLM：

```text
旧 workingMemory ───────┐
                       ├─→ Memory LLM
本轮 observation ──────┘
```

需要特别注意：本轮视觉事件不是先加入 `workingMemory` 再运行 Memory。它会在 `/api/companion-observe` 返回浏览器之后才写回 `state.workingMemory`，供下一轮使用。

写回的事件大致为：

```json
{
  "type": "vision",
  "observedAt": "ISO 时间",
  "elapsedSeconds": 60,
  "state": "PHONE",
  "observation": "用户低头注视并操作手中的手机",
  "changes": [],
  "confidence": 0.93,
  "reaction": "Phone down. Back to the next word."
}
```

所以 Working Memory 形成了一个跨帧反馈环：

```text
第 N 帧的 observation + reaction
              │
              ▼
       写入 workingMemory
              │
              ▼
作为历史上下文进入第 N+1 帧的 Memory LLM
```

## 5. Memory LLM：观察变成“是否开口”和导演意图

Memory LLM 不直接写台词。它接收当前视觉观察和历史上下文，返回结构化 `memory`，核心字段例如：

```json
{
  "shouldSpeak": true,
  "responseIntent": "短促提醒用户放下手机并回到当前单词",
  "actorActionType": "request",
  "expectsUserResponse": true,
  "intendedUserAction": "放下手机，继续背下一个单词",
  "interactionOutcome": {
    "type": "ignored_previous_request",
    "evidence": "连续两帧仍在操作手机",
    "confidence": 0.91
  },
  "expressionStrategy": {},
  "characterState": {},
  "storyMemory": {},
  "evidenceEventIds": ["vision-40"]
}
```

随后代码策略层计算最终发言决策：

```js
const shouldSpeak = memory.shouldSpeak && speechIntervalSatisfied;
```

也就是说，即使 Memory 给出 `shouldSpeak: true`，如果距上次发言不足 8 秒，最终仍会变成 `decision.shouldSpeak: false`，Actor 和 TTS 都不会执行。

### Memory → Actor 的字段交接

只有 `decision.shouldSpeak === true` 时才调用 Actor：

```js
runActorLLM({
  persona,
  task,
  memoryDecision: memory,
  relationshipMemory,
  outputLanguage
})
```

关键点是：完整的 `memory` 对象被改名为 `memoryDecision` 传给 Actor。Actor 主要消费 `responseIntent`、`interactionOutcome`、`characterState`、`expressionStrategy`、`intendedUserAction`、`avoidRepetition` 等字段。

## 6. Actor LLM：导演意图变成可朗读台词

Actor LLM 不再判断该不该说，只把 Memory 的导演结果演成台词。输出类似：

```json
{
  "text": "[firmly] Phone down. Next word.",
  "performance": {
    "emotion": "firm",
    "intensity": 0.55,
    "pace": "normal",
    "pauseBefore": 150
  }
}
```

后端会把 `text` 清洗、按句拆成 `messages`，并拼成 `reaction`：

```js
messages = ["[firmly] Phone down.", "Next word."];
reaction = messages.join('\n');
```

`/api/companion-observe` 最终一次性返回：

```json
{
  "observation": {},
  "memory": {},
  "decision": { "shouldSpeak": true },
  "messages": ["[firmly] Phone down.", "Next word."],
  "reaction": "[firmly] Phone down.\nNext word.",
  "performance": {
    "emotion": "firm",
    "intensity": 0.55,
    "pace": "normal",
    "pauseBefore": 150
  }
}
```

## 7. Actor → TTS：真正的前后端接力点

浏览器收到上述结果后执行：

```js
const messages = normalizeMessages(result.messages, result.reaction);

if (result.decision.shouldSpeak && messages.length) {
  await playMessageSequence(messages, result, 2, 'visual');
}
```

`playMessageSequence()` 会逐条调用 `playStreamingTts()`。后者发起第二个请求：

```json
POST /api/tts-stream
{
  "text": "[firmly] Phone down.",
  "epoch": 123,
  "turnId": 4,
  "speechType": "visual",
  "voiceType": "火山音色 ID",
  "voiceProvider": "elevenlabs 或 volcengine",
  "voiceId": "ElevenLabs voice_id",
  "speechLanguage": "en",
  "performance": {
    "emotion": "firm",
    "intensity": 0.55,
    "pace": "normal",
    "pauseBefore": 150
  }
}
```

字段映射如下：

| TTS 请求字段 | 上一步来源 |
| --- | --- |
| `text` | Actor 的单条 `message`；本质来自 Actor `text` |
| `performance` | Actor 的 `performance` |
| `voiceProvider`、`voiceType`、`voiceId`、`speechLanguage` | 当前角色 `roleContext`，不是 VLM/Actor 生成 |
| `epoch`、`turnId` | 本轮 pipeline 标识 |
| `speechType` | 前端指定为 `visual` |

因此最核心的数据传递可以浓缩为：

```text
VLM observation
  → Memory memory
  → Actor text
  → 后端返回 reaction/messages
  → 前端取单条 message 放进 TTS 的 text
  → 音频字节流
```

## 8. TTS：文字与表演参数变成音频

`/api/tts-stream` 根据 `voiceProvider` 分为两条路径。

### ElevenLabs

- `text` 原样发送，因此 Actor 生成的 `[firmly]` 等 Audio Tags 会被保留。
- `performance.intensity` 被映射到 ElevenLabs 的 `style`。
- 模型固定使用 `eleven_v3`。
- 上游直接返回 `pcm_24000`。

### 火山 TTS

- `text` 发送给 `seed-tts-2.0`。
- `performance.pace` 映射为 `speech_rate`：`slow=-15`、`normal=0`、`fast=15`。
- `performance.intensity` 映射为 `loudness_rate`。
- 火山返回 SSE，其中 Base64 音频被后端解码成 PCM。

两条路径最终都向浏览器返回：

```text
Content-Type: application/octet-stream
X-Audio-Format: pcm_s16le
X-Audio-Sample-Rate: 24000
X-Companion-Epoch: 当前 epoch
X-Companion-Turn-Id: 当前 turnId
```

## 9. 浏览器如何播放流式音频

浏览器通过 `response.body.getReader()` 持续读取音频块：

```js
const reader = response.body.getReader();
const { value } = await reader.read();
schedulePcmChunk(value, playback);
```

每个 PCM 块被转换并排入 Web Audio 时间线，不需要等完整音频下载完成。播放对象同时保存 `epoch`；如果会话已经切换、暂停或被更高优先级语音打断，就会终止旧流，防止过期语音继续播放。

## 10. 一条具体数据的完整旅行

以“用户从写字变为玩手机”为例：

```text
① VLM
observation.state = "PHONE"
observation.observation = "用户正在操作手机"
observation.confidence = 0.93

② Memory LLM
读取当前 observation + 上一轮 workingMemory
memory.shouldSpeak = true
memory.responseIntent = "拉回当前任务"
memory.intendedUserAction = "放下手机，继续下一个单词"

③ 代码策略层
8 秒发言间隔已满足
decision.shouldSpeak = true

④ Actor LLM
memory 作为 memoryDecision 传入
输出 text = "[firmly] Phone down. Next word."
输出 performance = { intensity: 0.55, pace: "normal" }

⑤ /api/companion-observe 返回浏览器
reaction = "[firmly] Phone down. Next word."
performance = { intensity: 0.55, pace: "normal" }

⑥ 浏览器调用 /api/tts-stream
text = reaction/message
performance = Actor performance
voiceId = 当前角色音色

⑦ TTS 返回 PCM 字节
浏览器 schedulePcmChunk() 分块播放

⑧ 上下文回写
本轮 observation + reaction 写入 workingMemory
下一帧 Memory LLM 能知道“刚才已经提醒过什么”
```

## 11. 相关代码位置

| 环节 | 文件 | 关键函数 |
| --- | --- | --- |
| 截图、观察请求、上下文回写 | `frontend/js/focus-companion.js` | `runObservation()` |
| Actor 结果转 TTS 请求 | `frontend/js/focus-companion.js` | `playMessageSequence()`、`playStreamingTts()` |
| API 入口与参数清洗 | `api/companion-observe.js` | `handler()` |
| VLM → Memory → Actor | `lib/companion-pipeline.js` | `runCompanionPipeline()` |
| VLM 输出 | `lib/companion-pipeline.js` | `describeScene()` |
| Memory 输入组装 | `lib/companion-pipeline.js` | `runMemoryLLM()` |
| Actor 输入组装 | `lib/companion-pipeline.js` | `runActorLLM()` |
| TTS 供应商请求与音频透传 | `api/tts-stream.js` | `handler()` |

## 12. 最容易产生误解的四点

1. **VLM 不直接连接 TTS。** VLM 只生成事实观察；真正传给 TTS 的文字来自 Actor。
2. **Memory LLM 不写台词。** 它输出是否说话、说话意图和表演策略；Actor 才写最终口语。
3. **`companion-observe` 不生成音频。** 它返回 JSON；浏览器收到 JSON 后另发 `/api/tts-stream` 请求。
4. **Working Memory 是跨帧反馈环，不是本轮中间模型。** 本轮结果在后端返回后写回浏览器状态，主要影响下一轮。
