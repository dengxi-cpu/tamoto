# API 接入说明

> 番茄钟陪伴项目当前接入的所有外部 API 清单，含服务商、用途、环境变量、调用端点与余额查看地址。
>
> 更新时间：2026-08-30

## 一、总览

| # | 服务商 | 用途 | 环境变量 | 是否有余额页 |
|---|--------|------|----------|:---:|
| 1 | DeepSeek | 文本对话 / 提醒解析 / 陪伴反应生成 | `DEEPSEEK_API_KEY` | ✅ |
| 2 | 火山引擎 · 语音（豆包语音 openspeech） | 语音识别 ASR + 语音合成 TTS | `SPEECH_API_KEY`、`TTS_API_KEY` 等 | ✅ |
| 3 | 火山引擎 · 方舟（Ark） | 视觉模型：摄像头画面分析（豆包 Seed 2.0 Lite） | `VISION_API_KEY`、`VISION_API_URL`、`VISION_MODEL` | ✅ |
| 4 | Supabase | 数据库 / 存储 / 专注记录同步 | `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| 5 | Vercel | 部署平台（非 LLM API） | `VERCEL_*` | ✅ |
| 6 | Web Push（VAPID） | 浏览器通知推送 | `VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY` | ❌（免费协议） |

## 二、DeepSeek

- **用途**：AI 对话、专注提醒的语义解析、陪伴反应引擎（场景分类、人设对话、开场白、体面待办生成）
- **环境变量**：`DEEPSEEK_API_KEY`
- **调用端点**：`https://api.deepseek.com/chat/completions`
- **模型**：`deepseek-chat`
- **代码位置**：[api/chat.js](api/chat.js)、[api/reminder-parse.js](api/reminder-parse.js)、[lib/companion-pipeline.js](lib/companion-pipeline.js)

### 余额查看
- 控制台用量页：<https://platform.deepseek.com/usage>（登录后左侧「用量信息」，可见余额 / 累计消费 / Token）
- 接口直查：`GET https://api.deepseek.com/user/balance`，请求头 `Authorization: Bearer <API Key>`

## 三、火山引擎

> 语音（openspeech）与方舟视觉都属于火山引擎账户体系，**余额共用一个账户**，在火山引擎「费用中心」查看。

### 3.1 语音识别 ASR（豆包语音）
- **用途**：把用户录音转成文字
- **环境变量**：`SPEECH_API_KEY`、`SPEECH_API_URL`（未设则用默认）、`SPEECH_RESOURCE_ID`（默认 `volc.bigasr.auc_turbo`）
- **调用端点**：`https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash`
- **代码位置**：[api/speech.js](api/speech.js)

### 3.2 语音合成 TTS（豆包语音 / seed-tts）
- **用途**：陪伴播报、语音朗读
- **环境变量**：`TTS_API_KEY`（未设时回退用 `SPEECH_API_KEY`）、`TTS_API_URL`、`TTS_RESOURCE_ID`（默认 `seed-tts-2.0`）、`TTS_VOICE_TYPE`
- **调用端点**：`https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse`
- **代码位置**：[api/tts-stream.js](api/tts-stream.js)

### 3.3 视觉模型 Vision（火山方舟 Ark · 豆包 Seed 2.0 Lite）
- **用途**：摄像头画面分析，识别学习 / 玩手机 / 离开 / 休息等状态
- **环境变量**：`VISION_API_KEY`、`VISION_API_URL`、`VISION_MODEL`
- **服务商**：火山引擎 · 火山方舟（Ark）
- **模型**：`doubao-seed-2-0-lite-*`（视觉版，具体版本号以方舟控制台为准）
- **调用端点**（OpenAI 兼容）：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- **代码位置**：[api/vision.js](api/vision.js)、[lib/companion-pipeline.js](lib/companion-pipeline.js)
- **密钥获取**：方舟控制台 → 左侧「API Key 管理」→ 创建

### 火山引擎 · 控制台与余额
- 主控制台：<https://console.volcengine.com>
- 语音 API Key 管理（新版）：<https://console.volcengine.com/speech/new/setting/apikeys>
- 方舟（Ark）控制台：<https://console.volcengine.com/ark>
- **余额页**：登录后右上角「费用」→ 费用中心「账户总览」查看「可用余额」（<https://console.volcengine.com/finance/cost/>）；欠费会立即停服，建议开余额预警

## 四、Supabase

- **用途**：专注记录存储、数据同步
- **环境变量**：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`
- **项目 URL**：`https://xnzachvoyqottmylflmt.supabase.co`
- **代码位置**：[api/_supabase.js](api/_supabase.js)

### 用量 / 账单查看
- 项目控制台：<https://supabase.com/dashboard/project/xnzachvoyqottmylflmt>
- 账单与用量：<https://supabase.com/dashboard/project/xnzachvoyqottmylflmt/settings/billing>
- 免费额度用尽后会暂停项目，注意「Usage」页的配额预警

## 五、Vercel（部署平台）

- **用途**：Serverless 部署（`api/*.js`），非 LLM API，但有独立账单
- **项目**：`tamoto-main`
- **用量 / 账单**：<https://vercel.com/dashboard/usage>、<https://vercel.com/dashboard/billing>

## 六、Web Push（VAPID）

- **用途**：浏览器通知推送，免费协议
- **环境变量**：`VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`
- 无充值 / 余额，无需管理

## 七、余额速查表

| 服务 | 打开就能看余额的网址 |
|------|----------------------|
| DeepSeek | <https://platform.deepseek.com/usage> |
| 火山引擎（语音 + 方舟视觉） | <https://console.volcengine.com/finance/cost/>（费用中心「账户总览」） |
| Supabase | <https://supabase.com/dashboard/project/xnzachvoyqottmylflmt/settings/billing> |
| Vercel | <https://vercel.com/dashboard/usage> / <https://vercel.com/dashboard/billing> |

## 八、注意事项

- 所有密钥仅存在于 `.env.local` / Vercel 环境变量中，不要提交进 git。
- DeepSeek 与火山引擎均为**预充值**模式，余额不足会返回 429 / 401，注意监控。
- 火山引擎语音（openspeech）与方舟（ark）密钥不通用，分别创建。
- 方舟模型 ID 会随版本更新，以控制台「模型广场」显示为准。
