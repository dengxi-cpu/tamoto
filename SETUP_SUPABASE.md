# Supabase 搭建 SOP

## 第一步：注册并创建项目

1. 打开 https://supabase.com ，点击 **Start your project**（右上角）
2. 用 GitHub 账号登录（如果没有，点 Sign Up 用邮箱注册）
3. 登录后点 **New Project**

### 填写项目信息

```
Name:            tamoto-pomodoro（或任意名字）
Database Password: 输入一个密码并记住它（至少8位）
Region:         选择 Tokyo 或 Singapore（离中国大陆最近）
Pricing Plan:   Free
```

4. 点 **Create new project**
5. 等待 1-3 分钟，直到项目初始化完成（页面会自动跳转）

---

## 第二步：拿到配置信息

项目创建完成后，左侧菜单点 **Project Settings**（齿轮图标）→ **API**

你会看到两个需要复制的内容：

### 1. Project URL（项目地址）

```
# 在 API Settings 页面的 Project URL 一栏
# 格式类似：https://xxxxxxxxxxxx.supabase.co
```

### 2. Service Role Key（服务角色密钥）

```
# 在 API Settings 页面的 Project API keys 区域
# 有一行叫 service_role key（注意不是 anon public 那个！）
# 点右侧 Copy 按钮复制
⚠️ 这个 key 有最高权限，不要泄露给前端代码
```

**把这两个值记到记事本里，第三步要用。**

---

## 第三步：执行建表 SQL

1. 左侧菜单点 **SQL Editor**（数据库图标）
2. 点 **New Query**（或 "+ New Query"）
3. 把项目根目录下 `schema.sql` 的**全部内容**粘贴进去

<details>
<summary>schema.sql 内容预览（共 48 行）</summary>

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE oc_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  detailed_stats JSONB DEFAULT '{}',
  daily_stats JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  data JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
</details>

4. 点 **Run**（或按 Ctrl+Enter 执行）
5. 等 2-3 秒，看到绿色 `Success. No rows returned` 表示成功

### 验证建表是否成功

左侧菜单点 **Table Editor** → 应该能看到 6 张表：
- `users`
- `oc_data`
- `tasks`
- `stats`
- `chat_history`
- `user_preferences`

---

## 第四步：配置 Vercel 环境变量

1. 打开你的 Vercel 项目：https://vercel.com/  → 找到你的项目
2. 点 **Settings** → **Environment Variables**
3. 添加两条变量：

```
Name:  SUPABASE_URL
Value: https://xxxxxxxxxxxx.supabase.co（第二步复制的 Project URL）

Name:  SUPABASE_SERVICE_ROLE_KEY  
Value: eyJhbGciOiJIUzI1NiIs...（第二步复制的 service_role key）
```

4. 点 **Save**
5. 回到 **Deployments** → 找到最新的 deployment → 点 ** Redeploy **（重新部署按钮）
   或者推送一次代码触发重新部署

---

## 验证是否生效

部署完成后，打开你的网站：

1. 进入 OC 卡片页
2. 你应该能看到 **"云同步未开启"** 面板
3. 输入一个同步码（比如 `9527`），点「启用」
4. 如果显示 **"云同步已启用"** → ✅ 全部配置成功
5. 如果控制台报错 → 检查环境变量是否复制正确

---

## 常见问题

### Q: 部署后还是显示"同步功能不可用"？
A: Vercel 环境变量没配好或没重新部署。检查 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 是否正确。

### Q: 可以用 anon public key 代替 service_role key 吗？
A: **不可以**。anon key 有 Row Level Security 限制，service_role key 才能绕过 RLS 直接操作数据库。

### Q: 本地开发怎么测试同步？
A: 在项目根目录新建 `.env` 文件：
```
SUPABASE_URL=你的URL
SUPABASE_SERVICE_ROLE_KEY=你的key
```
然后 `node server.js` 即可。服务端会自动读取环境变量。

### Q: 免费额度够 1000 用户吗？
A: 起步阶段够用 3-6 个月。当数据库接近 500MB 时升级到 Pro 计划（$25/月，8GB 数据库）。

### Q: 数据安全吗？
A: 用户的 API 密钥始终留在本地浏览器，不经过 Supabase。同步码经 SHA-256 哈希后存储，服务端无法反推原文。
