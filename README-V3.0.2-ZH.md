# Phenyx Pro Intelligence V3.0.2 — Media Activation Safety & Preflight

> **基线：线上 V3.0.1（已有 `0005`、`0006` 迁移）。本版只提供许可安全的媒体激活准备工具，不会擅自启用任何待授权来源。**

## 本次为什么还没有自动看到 Guitar World / MusicRadar 等新闻？

Source Monitor 当前证明只有 Gearnews、Mix Online、AVNation 三家在采集，每家最近 30 天记录了四次成功运行。其他 28 个来源仍是 `not_enabled`。媒体 RSS 地址已登记，不等于出版商允许企业自动收集、保存、分类其内容。

本次针对媒体激活流程完成三个技术改进：

1. `GET /api/admin/v3/media-activation`：只读取 D1，汇总媒体的 `collecting`、`permission_review`、`feed_discovery`、`approved_awaiting_success` 等阶段及下一步，**不会主动请求未授权网站**。
2. `POST /api/admin/v3/sources/check-feed`：**仅限已标为 `active` 且许可状态为 `licensed` / `approved_public_feed` / `existing_configured` 的媒体来源**，读取数据库登记的 HTTPS Feed，执行一次真实 HTTP/解析预检查；绝不抓取待核验来源，也不写入新闻。
3. RSS 采集器会拒绝 HTTP 200 的 HTML 错误页或无可解析结构的所谓 Feed，不再误记为成功；读取上限 2 MiB，超限停止下载。检查记录存储在新增的 `source_feed_checks` 表，供 `GET /api/admin/v3/source-feed-checks` 查询。

## 文件内容

| 文件 | 变更 |
| --- | --- |
| `src/index.js` | Worker 3.0.2；新增只读激活队列与授权后 Feed 预检查，改进采集器 RSS 验证 |
| `package.json` | 版本 3.0.2、增加测试 |
| `migrations/0007_media_activation.sql` | **仅新增** `source_feed_checks` 表和索引；不改动已有新闻、41 个品牌、7 条历史竞品事件 |
| `.github/workflows/deploy.yml` | 在云端数据库迁移和部署前执行 `npm run check` |
| `tests/media_activation.mjs` | 模拟测试：未授权不得请求、授权 Feed 检查可用、HTTP 200 HTML 被拒绝、检查审计保留 |
| `tests/migration_smoke.py` | 验证 0005→0006→0007 顺序执行，原数据和权限不变 |
| `MEDIA-LICENSING-OUTREACH-ZH-EN.md` | 官方许可联系地址和英语申请模板，**未发送邮件** |

## 本地检查（不接触生产数据或外部站点）

```bash
npm run check
```

本地 Node 22+、Python 3 即可；所有测试使用模拟 Feed 和内存 SQLite。

## 部署到已运行的 V3.0.1

1. **备份** GitHub 仓库和 D1 数据库（建议 Cloudflare 控制台快照/导出）。
2. 解压 `phenyxpro-intel-feed-v3.0.2-activation-patch.zip`，按目录结构上传更新至原 GitHub `main`：`src/index.js`、`package.json`、`.github/workflows/deploy.yml`，新增 `migrations/0007_media_activation.sql`、测试、文档。**不要删除任何旧迁移。**
3. 如果原 CI 中已配置 Cloudflare 凭证，提交后 CI 将先做 `npm run check`、执行 D1 迁移，再部署 Worker。也可按既有运维方式手动运行：

```bash
npx wrangler d1 migrations apply phenyxpro-intel-db --remote
npx wrangler deploy
```

4. `/health`、`/api/briefing.json`、`/api/admin/v3/summary` 预期返回版本 `3.0.2`。注意 `FEED_TOKEN` 不需要修改，不要贴出 Token。
5. `wrangler.toml` 保留原 D1 ID、原有三家 RSS、每天北京时间 09:00 Cron；保持英文原文、禁用机器翻译和 Chrome 默认 min_score=35。

## PowerShell 验收

前提：在本 PowerShell 会话中，`$headers` 已成功通过 FEED_TOKEN 验证。

```powershell
$base = 'https://phenyxpro-intel-feed.rantiontim.workers.dev'
Invoke-RestMethod "$base/health" | Select-Object version,translationEnabled,contentLanguage
$queue = Invoke-RestMethod "$base/api/admin/v3/media-activation" -Headers $headers
$queue.summary | Format-List
$queue.sources | Select-Object sourceName,sourceStatus,stage,action | Format-Table -Wrap
```

**只在官方来源许可确实取得并登记后**才能启用某个新媒体。可通过原 V3 接口 `/api/admin/v3/sources/authorize` 提交真实的书面许可编号或官方明确许可依据。仅公开 RSS 地址**不等于**许可。禁止编造 `permissionReference` 或使用 `approved_public_feed` 冒充企业使用授权。

对已经获得许可并激活的来源，可以先单独验证 Feed（不会插入文章）：

```powershell
$checkBody = @{ id = 'src-gearnews' } | ConvertTo-Json
Invoke-RestMethod "$base/api/admin/v3/sources/check-feed" `
  -Method Post -Headers $headers -ContentType 'application/json' -Body $checkBody

Invoke-RestMethod "$base/api/admin/v3/source-feed-checks?limit=10" -Headers $headers |
  Select-Object -ExpandProperty checks |
  Select-Object source_name,success,http_status,parsed_items,error_message |
  Format-Table -AutoSize
```

上例只检查**原有已授权的 Gearnews**；请勿把测试 ID 改成 `src-musicradar`、`src-church-production` 等未授权来源——接口会返回 403，并且**不会请求**网站。

## 媒体接入优先顺序

- 第一梯队：Church Production（官方 RSS）、Production Expert（出版社 RSS），完成实际可解析性、授权用途核实后才能启用。
- 并行：MusicTech（第三方目录显示 Feed 活跃，但本环境测试遇到 HTTP 403；联系 `licensing@musictech.com`）、Worship Leader、Pro Sound Web、FOH 等。
- 重点授权：Guitar World + MusicRadar（Future）、Sound On Sound。详见 `MEDIA-LICENSING-OUTREACH-ZH-EN.md`。
- Sweetwater InSync 仅按**编辑媒体内容**管理，与 Sweetwater 商品价格及库存权限独立。
- Reddit 和其他社区保持关闭；零售商商品数据没有授权，继续禁止抓取。

## 安全边界

- **本版未激活新增媒体、未对 Chrome 前端做改动、未部署生产。**
- 新的 Feed 预检查会按需连接已获准的 RSS；不会下载站点全文或播客音频，也不会变更新闻数据库。
- 新增表仅储存 HTTP 状态、解析数量、错误及时间，不保存第三方内容。
- `source-monitor`、`brand-coverage` 与旧 admin API 均保留。
- 现有 7 条竞品事件的误分类问题（例如 `tour debut`）仍属于后续分类优化任务，未在此次悄悄修改。
- 如生产运行误报、数据异常或授权取消，先停用相应来源，再审查 `source_feed_checks` 与 `source_runs`。
