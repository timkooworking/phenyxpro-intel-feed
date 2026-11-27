# Phenyx Pro Market Intelligence V3.0.5 — News Quality & Podcast Filter

## 目标

V3.0.5 将主新闻 Feed 与播客情报分离，避免普通播客访谈、基础教学和品牌提及占据 Chrome 首页。

- `/api/briefing.json` 默认只返回非播客新闻。
- 默认相关性门槛仍为 35 分，默认按相关性降序。
- 播客节目、品牌提及、行业讨论和审核队列继续通过独立管理 API 提供。
- 普通播客访谈/提及在 Podcast Intelligence 列表中的展示分数上限为 20；基础教学上限为 25；待审核的潜在事件上限为 35；明确标记为 Review / Buying Guide 的节目保留原分数。
- 原始分数保存在 `original_relevance_score`，不会修改历史文章中的 `relevance_score`。
- 明确的播客产品/市场事件仍进入人工审核，不会自动成为正式竞品事件。

## 基线与数据保护

本版本基于上传的 V3.0.4 仓库（含 V3.0.3.1 Buzzsprout GUID 解析修复、0009_intelligence_quality.sql）。本次**不新增 D1 Migration**，不修改任何历史文章、竞品事件、播客节目、品牌提及、审核记录或来源记录。

保持不变：

- 41 个品牌监测档案。
- 7 个已启用媒体/播客来源。
- 现有播客节目、原始链接和发布日期。
- FEED_TOKEN、D1 绑定、RSS_FEEDS。
- 英文原文优先，机器翻译关闭。
- 每日 `0 1 * * *` UTC（北京时间 09:00）采集。
- Chrome 默认相关性 ≥35、相关性降序。

## API 行为

### 主新闻 Feed（默认不含播客）

```text
GET /api/briefing.json?min_score=35&sort=score&limit=100
```

响应新增/明确以下字段：

- `totalArticles`：当前范围内的文章数；默认是非播客新闻数。
- `totalAllArticles`：D1 中全部文章数。
- `totalPodcastEpisodes`：播客节目总数。
- `podcastsIncluded`：默认 `false`。

如需临时查看全部内容，可显式传入：

```text
GET /api/briefing.json?min_score=35&sort=score&limit=100&include_podcasts=1
```

默认 Chrome 首页不要传 `include_podcasts=1`。

### 独立播客与品牌提及 API

继续使用已有接口（均需 FEED_TOKEN）：

- `GET /api/admin/v3/podcast-episodes?limit=100`
- `GET /api/admin/v3/brand-mentions?limit=100`
- `GET /api/admin/v3/industry-discussions?limit=100`
- `GET /api/admin/v3/review-queue?status=pending`
- `GET /api/admin/v3/events`（默认只返回正式 actionable events）

`podcast-episodes` 返回 `original_relevance_score`、经质量上限处理的 `relevance_score` 和 `podcast_quality`：

- `interview_or_discussion` / `general_podcast`：最高 20。
- `basic_education`：最高 25。
- `needs_review`：最高 35，仍只在审核队列中。
- `product_review`：保留原分数。

这些只是独立播客栏目中的展示评分，不会改写 D1 原始分数。

## 部署

1. 备份当前 V3.0.4 GitHub `main` 分支和 D1。
2. 解压 V3.0.5 Patch ZIP，按目录覆盖同名文件并新增本文档及部署清单。
3. 运行 `npm run check`（GitHub Actions 会自动运行）。
4. 提交到 `main`，等待 GitHub Actions 完成部署。
5. 本次没有新增迁移；部署日志中的 `No migrations to apply!` 属正常情况。
6. 不需要修改 FEED_TOKEN、D1 ID、`wrangler.toml`、RSS_FEEDS 或 Cron。

## Chrome 说明

当前仓库不包含 Chrome 扩展源代码。V3.0.5 后端会让现有 V1.3 插件在刷新 `/api/briefing.json` 后默认不再收到播客条目，因此首页播客占比会下降，无需先重装插件。

V3.0.5 不会凭空新增 Chrome 独立导航标签。Podcast Intelligence / Brand Mentions 的后端 API 已存在；如要在 Chrome 中增加独立栏目，需要另行提供当前安装的 Chrome 扩展 ZIP，再制作前端更新。

## 验收

```powershell
.\scripts\verify-v3.0.5.ps1 -BaseUrl 'https://YOUR-WORKER.workers.dev'
```

脚本会提示安全输入现有 FEED_TOKEN，并检查：Worker 版本、翻译关闭、41 个品牌、7 个来源、播客数量、默认新闻 Feed 不含播客、`include_podcasts=1` 可选查看全部内容，以及播客节目原链接仍为 HTTPS。

本交付已在本地执行 `npm run check`。未连接线上 Cloudflare、未读取凭据、未替用户部署。
