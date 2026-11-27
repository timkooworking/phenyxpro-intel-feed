# Phenyx Pro Intelligence V3.0.3 — Open Media Expansion

## 本次目标

在现有 V3.0.2 基础上，启用用户已通过 Windows PowerShell 实测可访问的四个公开 RSS/XML Feed：

| 来源 | Feed | 用户端测试 | 每次采集上限 | 内容模式 |
|---|---|---:|---:|---|
| Church Production | `https://www.churchproduction.com/api/rss/content.rss` | HTTP 200 / 30 条 | 30 | article |
| Production Expert | `https://www.production-expert.com/production-expert-1?format=rss` | HTTP 200 / 20 条 | 20 | article |
| Signal To Noise | `https://rss.buzzsprout.com/748181.rss` | HTTP 200 / 366 条 | 20 | podcast_metadata |
| Church Sound Podcast | `https://rss.buzzsprout.com/894865.rss` | HTTP 200 / 159 条 | 20 | podcast_metadata |

用户电脑上的 HTTP 200 仅证明该网络环境可以读取 Feed；部署后仍必须从 Cloudflare Worker 运行 preflight，以确认 Worker 网络出口也可访问。

## 重要的内容边界

- 仅保存标题、最多约 1,000–1,500 字符的描述摘要、发布日期、原始链接及系统分类/事件数据。
- Podcast 只读取 RSS 元数据；不请求 `<enclosure>`，不下载音频、不生成/抓取转录稿。
- 首次导入及后续每次运行均受每来源上限控制：30 / 20 / 20 / 20。
- 每次按发布日期从新到旧选取，使用 `canonical_url` 唯一约束去重。
- 公开 RSS 不等同于可再发布完整文章的许可。本版本不保存或展示全文、图片、音频。若出版方明确反对或其 Feed 条款不允许此类内部元数据读取，应立即将来源停用。
- 本次 `approved_public_feed` 表示管理员选择采用公开 Feed 的受限元数据读取方式，并非声称取得了出版方单独签署的商业授权。

## 保持不变

- 现有 Gearnews、Mix Online、AVNation 三个来源。
- 41 个品牌档案、现有竞品事件、全部历史 articles。
- FEED_TOKEN、D1 Database ID、`RSS_FEEDS`、`wrangler.toml`。
- Cron `0 1 * * *`（北京时间每天 09:00）。
- 机器翻译关闭、英文原文优先。
- Chrome 默认相关性 35 分以上、相关性降序（Chrome 插件本身不在本次更新范围内）。
- 六家零售商仍需授权；Reddit 仍保持 pending_authorization。

## GitHub 更新文件

使用增量 Patch ZIP，按目录结构上传/替换：

- `src/index.js`
- `package.json`
- `tests/smoke.mjs`
- `tests/media_sources.mjs`
- `tests/media_activation.mjs`
- `tests/migration_smoke.py`
- 新增 `tests/open_media_expansion.mjs`
- 新增 `migrations/0008_open_media_expansion.sql`
- 新增 `README-V3.0.3-ZH.md`
- 新增 `DEPLOY-CHECKLIST-V3.0.3-ZH.md`

不要删除或重命名 `0001` 至 `0007` 任何迁移文件。不要改 `wrangler.toml` 或 GitHub Secrets。

## GitHub 部署

1. 先下载/备份当前 `main` 分支。
2. 将 Patch ZIP 解压，按上面的文件路径更新到仓库根目录。
3. Commit 到 `main`。
4. GitHub Actions 应执行 `npm run check`、应用远程 D1 migrations、部署 Worker。
5. 只有 Workflow 全部成功才算部署完成。

当前 `package.json` 的检查命令会运行：

```bash
npm run check
```

部署命令保持原样：

```bash
npx wrangler d1 migrations apply phenyxpro-intel-db --remote && npx wrangler deploy
```

## 部署后 PowerShell 验证

保留当前已验证的 `$headers`（不要把 Token 发给任何人）：

```powershell
$base = "https://phenyxpro-intel-feed.rantiontim.workers.dev"

Invoke-RestMethod "$base/health" |
  Select-Object version, translationEnabled, contentLanguage

$queue = Invoke-RestMethod "$base/api/admin/v3/media-activation" -Headers $headers
$queue.sources |
  Where-Object { $_.sourceName -in @("Church Production","Production Expert","Signal To Noise (Pro Sound Web Podcast)","Church Sound Podcast") } |
  Select-Object sourceName, sourceStatus, permissionStatus, feedContentMode, maxItemsPerRun, stage |
  Format-Table -AutoSize
```

四个来源应显示 `approved_awaiting_success`（首次采集前）或 `collecting`（有成功运行记录）。

### 先做 Cloudflare Worker 侧 Feed preflight（不导入文章）

```powershell
$ids = @(
  "src-church-production",
  "src-production-expert",
  "src-psw-signal-to-noise-podcast",
  "src-church-sound-podcast"
)

$checks = foreach ($id in $ids) {
  try {
    Invoke-RestMethod `
      -Uri "$base/api/admin/v3/sources/check-feed" `
      -Method Post `
      -Headers $headers `
      -ContentType "application/json" `
      -Body (@{ id = $id } | ConvertTo-Json) `
      -TimeoutSec 45
  }
  catch {
    [PSCustomObject]@{ sourceName = $id; ok = $false; httpStatus = "ERROR"; parsedItems = 0; error = $_.ErrorDetails.Message }
  }
}
$checks | Select-Object sourceName, ok, httpStatus, parsedItems, error | Format-Table -AutoSize
```

四个来源均应 `ok=True`。如果某个 Worker 侧 preflight 失败，不要继续对该来源采集；保留失败记录并排查 Worker 网络响应。

### 首次采集

```powershell
$run = Invoke-RestMethod `
  -Uri "$base/api/admin/run-collection" `
  -Method Post `
  -Headers $headers `
  -TimeoutSec 180

$run.results | Format-Table source, seen, added, competitorEvents, discoveryCandidates -AutoSize
```

注意：该接口会运行所有 active feed，包括原有 Gearnews、Mix Online、AVNation 和四个新来源。四个新增来源的单次 `seen` 上限分别为 30、20、20、20；已存在 URL 会被去重，不会重复插入。

### 检查采集运行记录

```powershell
$monitor = Invoke-RestMethod "$base/api/admin/v3/source-monitor" -Headers $headers
$monitor.sources |
  Where-Object { $_.source_name -in @("Church Production","Production Expert","Signal To Noise (Pro Sound Web Podcast)","Church Sound Podcast") } |
  Select-Object source_name, status, collectionStatus, successfulRuns30Days, articlesInDatabase, last_success_at, last_error |
  Format-Table -AutoSize
```

`collecting` 只会在有真实成功的 `source_runs` 后出现。Chrome 是否显示某篇文章仍取决于相关性分数是否达到 35 分。

## 回滚

若出现问题，优先在 GitHub 回滚 `src/index.js`，但不要删除迁移 0008，也不要尝试删除历史文章。回滚代码后，新增来源仍在 D1 注册表中；旧版代码不会认识新的 `max_items_per_run`/`feed_content_mode` 字段，但不会影响既有文章表。若需彻底停用新 Feed，应使用后续的来源管理更新把四个来源状态设为 disabled，而不是删除数据。
