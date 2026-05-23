# Vercel 环境变量配置 + 重新部署 SOP

## 前提

你已经有 Vercel 项目，是从 GitHub 仓库自动部署的。现在只需要加两条环境变量然后重新部署。

---

## 第一步：打开 Vercel 项目

1. 打开 https://vercel.com 并用 GitHub 登录
2. 在 **Overview** 页面会看到你的项目列表，找到你的番茄钟项目，点进去

> 如果找不到：看右上角头像 → 点你的名字 → 下面会出现项目列表

---

## 第二步：进入 Settings → Environment Variables

1. 在项目页面顶部，点 **Settings**（设置）选项卡
2. 左侧菜单点 **Environment Variables**（环境变量）

![示意图] 页面布局大概是：

```
[Overview] [Deployments] [Analytics] [Settings]   ← 顶部选项卡
                                              [Environment Variables]  ← 左侧菜单
```

---

## 第三步：添加第一条变量

在 Environment Variables 页面：

1. **Name** 输入：`SUPABASE_URL`
2. **Value** 输入：你从 Supabase 复制的 Project URL（格式类似 `https://xxxxxxxxxxxx.supabase.co`）
3. **Environments** 勾选：**Production**（默认就是，不用改）
4. 点 **Add**

---

## 第四步：添加第二条变量

1. 再点 **Add New**（或 + Add Environment Variable）
2. **Name** 输入：`SUPABASE_SERVICE_ROLE_KEY`
3. **Value** 输入：你从 Supabase 复制的 service_role key（一长串字符）
4. **Environments** 勾选：**Production**
5. 点 **Add**

添加完成后，列表应该像这样：

```
SUPABASE_URL                https://xxxx.supabase.co           Production
SUPABASE_SERVICE_ROLE_KEY   eyJhbGciOiJ...                    Production
```

---

## 第五步：重新部署

有两种方式，选一种即可：

### 方式 A：从 Vercel 后台触发（最简单）

1. 点顶部的 **Deployments** 选项卡
2. 找到最近的一次部署（最上面那条）
3. 右侧点 **...**（三个点）
4. 点 **Redeploy** → 弹出确认框点 **Redeploy**

> 等 1-2 分钟，状态变成 **Ready** 就完成了。

### 方式 B：推送代码触发（如果同时修改了代码）

```bash
# 在本地项目目录执行：
git add .
git commit -m "添加云同步支持"
git push origin main
```

Vercel 检测到 GitHub 有新的推送会自动触发部署。

---

## 第六步：验证

部署完成后，打开你的网站：

1. 进入 OC 卡片页
2. 你应该能看到 **"云同步未开启"** 的提示面板
3. 输入一个同步码（比如 `9527`），点「启用」
4. 如果显示 **"云同步已启用！"** → ✅ 配置成功

---

## 如果出错了

### 控制台报错 / 启用同步失败
打开浏览器开发者工具（F12 → Console），看错误信息。

常见原因：
| 错误 | 原因 | 解决 |
|------|------|------|
| `数据库未配置` | 环境变量没生效 | 检查变量名拼写，确认已重新部署 |
| `用户未注册` | identity_hash 传输出错 | 检查 SUPABASE_SERVICE_ROLE_KEY 是否复制的 service_role（不是 anon） |
| 403 / Unauthorized | API 密钥错误 | 重新复制 service_role key 再试 |

### 需要紧急回滚
在 Vercel → Deployments → 找到上一个可用的部署 → 点 ... → **Redeploy**，就会恢复到旧版本。
