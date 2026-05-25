# 云同步功能文档

> ⚠️ **当前状态：云同步功能已暂时隐藏**（UI 和后台代码已注释，但完整保留）。
> 需要恢复时搜索 `[注释] 云同步` 取消注释即可。

## 概述

伴柠番茄钟使用 **Local-First** 架构实现多设备数据同步。所有数据先写入浏览器 localStorage，再后台同步到 Supabase（PostgreSQL）。用户通过 **同步码（手机号）** 在多台设备间共享数据，无需注册手机号或邮箱。

---

## 架构

```
用户操作 → localStorage（即时读写，始终是数据源）
                    ↓
              SyncManager（去抖 2 秒自动推送）
                    ↓
            Vercel API（Serverless Function）
                    ↓
              Supabase（PostgreSQL + REST API）
```

### 文件结构

| 文件 | 用途 |
|------|------|
| `api/_supabase.js` | 共享 Supabase REST 客户端（service_role key） |
| `api/auth.js` | 设备注册 + 同步码配对 |
| `api/sync.js` | 数据推/拉 API |
| `frontend/js/sync.js` | SyncManager 前端同步核心类 |
| `frontend/js/db.js` | IndexedDB 存储工具（用于头像等大体积数据） |
| `schema.sql` | Supabase 建表脚本 |

---

## 同步码机制

### 什么是同步码

同步码就是用户的 **手机号**（11 位数字），直接作为标识符存储在 Supabase 的 `users.sync_code` 列中。不支持手机号/微信/OAuth 登录，保持零注册门槛。

### 多设备配对

两台设备输入相同的手机号即可共享数据：

1. **第一台设备** 输入手机号 → 云端创建用户 → 全量推送本地数据
2. **第二台设备** 输入相同手机号 → 匹配到已有用户 → 全量拉取云端数据

### 更改同步码

点击首页云同步区的 **"更改"** 按钮，确认后输入新手机号：
- 旧同步码的云端数据保留，不再关联
- 新同步码如果是首次使用，本地数据全量推上去
- 新同步码如果已存在，从云端拉取数据

---

## 同步策略

### 数据流向

| 场景 | 行为 |
|------|------|
| 首次设置同步码 | 全量上传本地数据到云端 |
| 另一设备输入相同同步码 | 全量下载云端数据到本地 |
| 日常使用中 | 每次数据保存后 2 秒去抖推送增量变更 |
| 自动轮询 | 每 30 秒拉取云端增量变更 |
| 切回前台 | 自动触发拉取 |
| 离线 | 正常使用本地数据，恢复网络后自动推送 |
| 点击"立即同步" | 全量推送所有本地数据 → 拉取远端数据 |
| 冲突 | 最后写入者获胜（按更新时间戳） |

### 同步范围

| 同步到云端 | 仅本地（不同步） |
|------------|-----------------|
| OC 角色数据（名称、头像、性格、风格等） | API 密钥配置（apiProfiles） |
| 任务列表 | — |
| 专注统计（detailedStats） | — |
| 每日统计（dailyStats） | — |
| 聊天历史（各 OC 的 chatHistory_*） | — |
| 自定义风格、状态、礼物 | — |
| OC 头像图片（以 dataURL 形式存入 oc_data.data） | — |

---

## SyncManager API

全局实例：`window.syncManager`

| 方法 | 说明 |
|------|------|
| `init()` | 初始化，恢复状态，绑定事件，启动轮询 |
| `setSyncCode(code)` | 设置同步码，注册/配对，触发首次同步 |
| `disableSync()` | 停用同步，清除本地同步状态 |
| `enqueue(type, data)` | 加入同步队列（2 秒去抖） |
| `flush()` | 立即推送待处理队列 |
| `forceSync()` | 全量推送所有本地数据 + 拉取远端（供"立即同步"使用） |
| `pull()` | 拉取云端增量数据，合并到本地 |
| `onStatusChange(cb)` | 注册状态变更回调 |
| `getSyncInfo()` | 获取当前同步状态信息 |

### 状态说明

| 状态 | 含义 |
|------|------|
| `not_configured` | 未设置同步码 |
| `synced` | 已同步 |
| `syncing` | 同步中 |
| `offline` | 离线 |
| `error` | 同步出错 |

---

## 数据表结构（Supabase）

### users（用户身份）

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID PK | 自动生成 |
| sync_code | TEXT UNIQUE | 同步码（手机号，明文） |
| created_at | TIMESTAMPTZ | 注册时间 |
| last_sync_at | TIMESTAMPTZ | 最后同步时间 |

### oc_data（OC 角色数据）

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID PK | 自动生成 |
| user_id | UUID FK → users | 所属用户 |
| data | JSONB | 完整的 OC 列表数组（含头像 dataURL） |
| updated_at | TIMESTAMPTZ | 最后更新 |

### tasks（任务列表）

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID PK | 自动生成 |
| user_id | UUID FK → users | 所属用户 |
| data | JSONB | 任务列表数据 |
| updated_at | TIMESTAMPTZ | 最后更新 |

### stats（专注统计）

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID PK | 自动生成 |
| user_id | UUID FK → users | 所属用户 |
| detailed_stats | JSONB | 详细统计 |
| daily_stats | JSONB | 每日统计 |
| updated_at | TIMESTAMPTZ | 最后更新 |

### chat_history（聊天记录）

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID PK | 自动生成 |
| user_id | UUID FK → users | 所属用户 |
| data | JSONB | 聊天历史对象 |
| updated_at | TIMESTAMPTZ | 最后更新 |

### user_preferences（用户偏好）

| 列 | 类型 | 说明 |
|----|------|------|
| id | UUID PK | 自动生成 |
| user_id | UUID FK → users UNIQUE | 所属用户 |
| data | JSONB | 偏好配置 |
| updated_at | TIMESTAMPTZ | 最后更新 |

---

## 头像同步机制

OC 头像分三步实现跨设备同步：

1. **保存时**：`persistOCData()` 将 OC 头像 dataURL 存入 IndexedDB，localStorage 中存 `idxdb:oc_<id>` 引用
2. **推送时**：`_resolveAvatars()` 从 IndexedDB 读出 dataURL，替换引用，推送到 Supabase（`oc_data.data[].avatar`）
3. **拉取时**：`_mergeData()` 判断 `avatar` 是 `data:` 开头，就存回 IndexedDB，本地存 `idxdb:` 引用

IndexedDB 数据库名 `OCAvatarDB`，对象存储 `avatars`。

---

## 本地开发

### 环境变量

项目根目录新建 `.env` 文件：

```
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ...
```

### 启动

```bash
node server.js
```

访问 `http://localhost:3000`

---

## Vercel 部署

### 环境变量

在 Vercel 项目 Settings → Environment Variables 中添加：

| Name | Value |
|------|-------|
| `SUPABASE_URL` | 你的 Supabase Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 你的 service_role key |

⚠️ 必须用 **service_role key**（不是 anon public key），否则无法写入数据库。

### 重新部署

```bash
npx vercel@latest --prod
```

或在 Vercel Dashboard → Deployments → 最新 commit → Redeploy。

---

## 开发历史与变更记录

### 初始实现
- 使用 SHA-256(`deviceId + "::" + 同步码`) 作为身份标识
- 同步码不存明文，只存哈希

### 2025-xx-xx：移除 deviceId
- 原因是同一同步码在不同设备产生不同哈希，无法跨设备同步
- 改为 SHA-256(同步码) 作为身份标识

### 2025-xx-xx：移除哈希，使用明文手机号
- 用户希望直接在 Supabase Table Editor 看到同步码
- `users` 表列名从 `identity_hash` 改为 `sync_code`
- 同步码直接存明文手机号

### 2025-xx-xx：添加自动轮询
- 新增 `POLL_INTERVAL = 30s`，每 30 秒自动拉取远端变更
- 页面切回前台时自动拉取

### 2025-xx-xx：修复头像同步
- `persistOCData()` 新增将头像 dataURL 存入 IndexedDB
- `_resolveAvatars()` 推送前从 IndexedDB 读取 dataURL
- 拉取后 `_mergeData()` 将 dataURL 存回 IndexedDB

### 2025-xx-xx：更改同步码功能
- 新增"更改"按钮，允许更换同步码
- 调用 `disableSync()` → 输入新码 → `setSyncCode()`

### 2025-05-25：同步功能隐藏 + 头像圆形裁切
- 云同步功能全部注释隐藏（UI 面板、sync.js 脚本、JS 函数、CSS）
- 搜索 `[注释] 云同步` 可一键恢复
- 新增 OC 头像圆形裁切功能（OC 设置页上传照片后弹出圆形裁切框）
- 支持拖动调整位置、滑块缩放，裁切结果与专注页圆形头像一致
- 裁切使用 Canvas 渲染，输出 512×512 正方形图片

### 2025-xx-xx：修复错误处理
- API 在 upsert 失败时现在返回 HTTP 500（之前返回 200 静默吞掉错误）
- `syncNow` 改为 `forceSync()` 全量推送，不依赖待发送队列
- 新增 `SyncManager.forceSync()` 方法
