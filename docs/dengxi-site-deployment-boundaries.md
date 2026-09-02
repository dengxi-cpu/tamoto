# dengxi.site 部署边界与防误改说明

最后确认时间：2026-08-31（Asia/Shanghai）

## 已启用的保护

2026-08-31 已完成以下设置：

- Vercel 项目 `tamoto-gnbh` 已断开 Git 连接。向 GitHub 推送代码不会自动重新部署根站。
- GitHub 分支 `dengxi-site` 已启用保护：必须通过 Pull Request、规则对管理员生效、禁止强制推送、禁止删除分支，并要求解决 PR 对话后才能合并。
- 当前保护规则不要求其他账号批准，避免唯一维护者无法完成必要的经典站维护。
- 只读核对时，Vercel 项目 `tamoto-main` 也未连接 Git。因此目前推送 `main` 本身不会自动发布 Beta；Beta 需要继续使用现有的手动或 CLI 部署流程。

## 当前线上结构

`dengxi.site` 的根站与 Beta 在代码和部署上分开维护：

| 线上地址 | Vercel 项目 | Git 分支 | 内容 |
| --- | --- | --- | --- |
| `https://dengxi.site/` | `tamoto-gnbh` | `dengxi-site` | 已冻结的经典老 UI |
| `https://dengxi.site/beta/` | 实际内容来自 `tamoto-main` | `main` | 持续开发的 Beta UI |

根站项目 `tamoto-gnbh` 的 `vercel.json` 保留以下代理关系：

```text
/beta        -> /beta/
/beta/       -> https://tamoto-main.vercel.app/beta/
/beta/:path* -> https://tamoto-main.vercel.app/beta/:path*
```

因此，访问者仍然使用同一个域名，但 `/beta/` 的页面和资源由另一个 Vercel 项目提供。

## 经典 UI 的基准

- 经典老 UI 的 Git 基准：`b3e9b68`
- 保留 `/beta` 代理并恢复经典 UI 的提交：`0bee581`
- `dengxi-site` 分支当前应以 `0bee581` 及其必要维护提交为准。

`0bee581` 的最终文件树相对 `b3e9b68`，只有 `vercel.json` 多出 `/beta` 重定向和反向代理配置。

## 日常开发规则

以后开发 Beta 时：

1. 只在 `main` 分支和主工作区开发、提交、推送。
2. 只确认 `tamoto-main` 项目的部署，不要部署 `tamoto-gnbh`。
3. 不要把 `main` 合并进 `dengxi-site`。
4. 不要在 `dengxi-site` 工作树运行批量复制、同步或整目录恢复命令。
5. 不要修改 `dengxi-site` 的 `index.html`、`frontend/`、`sw.js` 或根站 API，除非明确要维护经典站。
6. 不要整体回滚或 Promote `tamoto-gnbh` 的旧 Vercel 部署；旧部署可能没有 `/beta` 代理。

## 每次发布 Beta 前的检查

```powershell
git branch --show-current
git status --short --branch
git remote -v
```

预期结果：当前分支为 `main`。推送时显式写分支：

```powershell
git push origin main
```

不要使用可能把错误分支推到生产分支的命令，例如：

```powershell
git push origin HEAD:dengxi-site
```

发布后检查：

```text
https://dengxi.site/       应显示经典老 UI
https://dengxi.site/beta/  应显示本次 Beta 改动
```

## 推荐的锁定措施

仅靠操作习惯不能真正“锁死”。建议同时启用以下保护：

1. 在 GitHub 为 `dengxi-site` 设置分支保护规则，禁止直接 push，要求 Pull Request。（已完成）
2. 将根站保护规则设为必须由指定维护者批准；如只有一个人维护，也可以要求 PR 后手动合并，增加一次明确确认。
3. 如果未来重新启用 Vercel Git 集成，应确认 `tamoto-gnbh` 的 Production Branch 固定为 `dengxi-site`，`tamoto-main` 的 Production Branch 固定为 `main`。
4. 在 `tamoto-gnbh` 中关闭非必要的自动生产部署，改为需要维护经典站时手动部署。这是最强的防误部署措施。（已完成：已断开 Git）
5. 长期方案是把经典根站拆到单独仓库；Beta 仓库只负责 `tamoto-main`。仓库级隔离比同仓库分支隔离更可靠。

## 事故恢复

如果根站再次被新版覆盖，不要影响 `main` 或回滚 `tamoto-main`。应当：

1. 从 `dengxi-site` 分支处理。
2. 恢复 `0bee581` 对应的经典站文件和 `/beta` 代理。
3. 只部署 Vercel 项目 `tamoto-gnbh`。
4. 分别验证根路径和 `/beta/`，确认两者均返回 200 且 UI 不串线。
