# AI 聊天状态机修改说明

## 📋 修改概述

根据测试 HTML (`test-ai-chat.html`) 的逻辑，已将状态机机制应用到现有的专注页面聊天代码中。

**⚠️ 重要：前后端都已修改完成！**

## 🎯 核心改动

### 1. **frontend/js/chat.js** - 添加状态机和 Prompt 模板

#### 新增变量
```javascript
// 当前 Prompt 状态
let currentPromptState = 'idle';

// 杂念记录列表
let distractionList = [];

// System Prompt 模板（4个状态）
const systemPrompts = {
    idle: `...`,    // 空闲状态
    start: `...`,   // 专注状态
    break: `...`,   // 暂停状态
    finish: `...`   // 完成状态
};
```

#### 新增函数
- **`updatePromptState()`** - 根据番茄钟状态更新 Prompt 状态
- **`replaceVariables(template)`** - 替换模板中的变量
- **`formatDuration(seconds)`** - 格式化时间显示
- **`isDistraction(message)`** - 判断消息是否是杂念
- **`generateSystemPrompt()`** - 生成完整的 System Prompt
- **`setPromptStateToFinish()`** - 设置为完成状态
- **`clearDistractionList()`** - 清空杂念列表

#### 修改函数
- **`initChat()`** - 初始化时调用 `updatePromptState()`
- **`sendChatMessageToOC()`** - 使用新的 Prompt 生成逻辑

---

### 2. **frontend/js/api.js** - 适配前端生成的 System Prompt

#### 修改内容
**函数签名改变：**
```javascript
// 旧版本
async function sendChatMessage(message, ocProfile, currentState, chatHistory)

// 新版本
async function sendChatMessage(message, systemPrompt, chatHistory)
```

**参数变化：**
- ❌ 移除：`ocProfile`, `currentState`
- ✅ 新增：`systemPrompt`（前端生成的完整 Prompt）

**新增功能：**
- F12 控制台详细日志输出

---

### 3. **frontend/js/main.js** - 添加状态监听集成

#### 修改位置

**1. `startStopTimer()` - 开始番茄钟**
```javascript
if (typeof updatePromptState === 'function') {
    updatePromptState();
}
```

**2. `pauseResumeTimer()` - 暂停/继续番茄钟**
```javascript
// 暂停和继续时都会调用
if (typeof updatePromptState === 'function') {
    updatePromptState();
}
```

**3. `showPomodoroComplete()` - 番茄钟完成**
```javascript
if (typeof setPromptStateToFinish === 'function') {
    setPromptStateToFinish();
}

// 5秒后清空杂念列表
setTimeout(() => {
    if (typeof clearDistractionList === 'function') {
        clearDistractionList();
    }
}, 5000);
```

---

### 4. **api/chat.js** - 后端适配修改 ⚠️ **重要！**

#### 修改内容

**请求参数变化：**
```javascript
// 旧版本（后端自己生成 Prompt）
const {
    ocProfile,
    currentState,
    message,
    chatHistory
} = req.body;

// 新版本（接收前端生成的完整 Prompt）
const {
    systemPrompt,  // ✅ 直接接收前端生成的完整 Prompt
    message,
    chatHistory
} = req.body;
```

**移除的功能：**
- ❌ `buildChatSystemPrompt()` - 不再需要后端生成 Prompt
- ❌ `generateSuggestedActions()` - 暂时返回空数组
- ❌ `getTimerStatusText()` - 不再需要
- ❌ `getBeijingTime()` - 不再需要

**保留的功能：**
- ✅ `buildConversationHistory()` - 简化版本（移除 ocProfile 参数）
- ✅ `formatDuration()` - 保持不变
- ✅ `extractReply()` - 保持不变
- ✅ `callChatLLMAPI()` - 直接使用前端传来的 systemPrompt

**新增日志：**
```javascript
console.log('=== AI聊天 - 接收前端生成的 System Prompt ===');
console.log('System Prompt (前300字符):', systemPrompt.substring(0, 300) + '...');
console.log('用户消息:', message);
console.log('聊天历史条数:', chatHistory.length);
console.log('忽略历史:', ignoreHistory);
```

---

## 🔄 状态转换流程

```
┌──────────┐
│   Idle   │ ← 初始状态
└────┬─────┘
     │ 点击"开始专注"
     ↓
┌──────────┐
│  Start   │ ← 专注中
└────┬─────┘
     │ 点击"暂停"
     ↓
┌──────────┐
│  Break   │ ← 已暂停
└────┬─────┘
     │ 点击"继续" ────→ 返回 Start
     │
     │ 倒计时结束
     ↓
┌──────────┐
│  Finish  │ ← 已完成
└────┬─────┘
     │
     ↓
    Idle   ← 回到空闲
```

---

## 🎨 System Prompt 特点

| 状态 | 特点 | 字数限制 | 杂念处理 |
|------|------|---------|---------|
| **Idle** | 自由闲聊、引导开始 | 无 | 不记录 |
| **Start** | 拒绝闲聊、简短回复 | 20字内 | ✅ 记录 |
| **Break** | 情感反馈、提醒杂念 | 无 | ✅ 提醒 |
| **Finish** | 夸奖慰问、提醒杂念 | 无 | ✅ 提醒 |

---

## 🔍 调试功能

### 前端 F12 控制台日志

**发送请求时（api.js）：**
```
================================================================================
📤 发送 AI 聊天请求
================================================================================
🔗 API URL: https://api.deepseek.com/v1/chat/completions
📋 请求方法: POST
🎯 模型: deepseek-chat
📝 用户消息: 好累啊，不想动
📄 System Prompt (前200字符):
# Role
**你扮演的角色是：猫娘小咪。**
当前用户 主人 处于"空闲状态"，还没有开始任务...
💬 聊天历史条数: 2
🚫 忽略历史: false
================================================================================
```

**收到响应时（api.js）：**
```
✅ AI 请求成功
⏱️ 请求耗时: 1234.56ms
💬 AI 回复内容:
喵~ 主人，要不要先做5分钟试试看？只要5分钟就好喵~
================================================================================
```

### 后端 Vercel 日志

```
=== AI聊天 - 接收前端生成的 System Prompt ===
System Prompt (前300字符): # Role
**你扮演的角色是：猫娘小咪。**
当前用户 主人 处于"空闲状态"...
用户消息: 好累啊，不想动
聊天历史条数: 2
忽略历史: false
=== 系统提示词结束 ===
```

---

## ⚠️ 注意事项

### 1. **向后兼容性**
- 保留了原有的 `currentState` 对象结构
- 不会影响其他使用 `currentState` 的功能

### 2. **状态同步**
- 每次发送消息前都会调用 `updatePromptState()`
- 确保番茄钟状态和 Prompt 状态一致

### 3. **杂念记录**
- 只在 `start`（专注）状态记录
- 包含关键词：提醒、记一下、别忘了、记住、待会、稍后、备忘
- 在 `break`/`finish` 状态会提醒用户处理

### 4. **错误处理**
- 如果 Prompt 生成失败，显示错误消息
- API 调用失败时有详细的错误提示

### 5. **前后端协作** ⚠️ **重要**
- **前端**：负责生成完整的 System Prompt
- **后端**：直接使用前端传来的 Prompt，不再生成
- 两者必须同步修改，否则会出错

---

## 🧪 测试建议

### 测试场景

**1. 空闲状态 (Idle)**
- 打开页面，不启动番茄钟
- 发送消息："好累啊，不想动"
- 预期：AI 自由闲聊，鼓励开始

**2. 专注状态 (Start)**
- 启动番茄钟
- 发送消息："哎呀，那个剧更新了！"
- 预期：AI 简短回复（20字内），要求回归任务

**3. 暂停状态 (Break)**
- 暂停番茄钟
- 发送消息："刚才记了什么？"
- 预期：AI 提醒杂念列表，轻松聊天

**4. 完成状态 (Finish)**
- 等待番茄钟完成
- 发送消息："终于完成了！"
- 预期：AI 给予夸奖，提醒杂念列表

---

## 📝 部署检查清单

### 前端部署
- ✅ `frontend/js/chat.js` 已修改
- ✅ `frontend/js/api.js` 已修改
- ✅ `frontend/js/main.js` 已修改

### 后端部署 ⚠️ **必须同步部署！**
- ✅ `api/chat.js` 已修改
- ⚠️ 需要重新部署到 Vercel/服务器

### 部署步骤
1. 提交前端代码到 Git
2. 提交后端代码到 Git
3. 等待 Vercel 自动部署后端
4. 清除浏览器缓存
5. 测试所有 4 种状态

---

## ✅ 修改完成

所有修改已完成！**前后端都需要同步部署！**

**修改文件清单：**

**前端（frontend/js/）：**
- ✅ `chat.js`
- ✅ `api.js`
- ✅ `main.js`

**后端（api/）：**
- ✅ `chat.js`

**测试工具：**
- `test-ai-chat.html` (可独立测试)

---

**修改日期：** 2026-01-26
**文档版本：** v2.0 (包含后端修改)
