# V3.0.5 部署检查清单

## 1. 部署前
- [ ] 备份当前 V3.0.4 GitHub main 分支。
- [ ] 确认 Worker 当前为 V3.0.4。
- [ ] 不修改 FEED_TOKEN、D1 ID、RSS_FEEDS、wrangler.toml。

## 2. 文件更新
- [ ] 替换 `src/index.js`。
- [ ] 替换 `src/intelligence-admin.js`。
- [ ] 替换 `package.json`。
- [ ] 替换 `tests/smoke.mjs`、`tests/media_sources.mjs`、`tests/media_activation.mjs`、`tests/intelligence_quality.mjs`。
- [ ] 新增/替换 `scripts/verify-v3.0.5.ps1`。
- [ ] 新增 `README-V3.0.5-ZH.md` 和本清单。

## 3. 测试与部署
- [ ] GitHub Actions `npm run check` 全部通过。
- [ ] Worker 部署成功，版本为 3.0.5。
- [ ] D1 日志显示 `No migrations to apply!`（本次无新增 Migration）。

## 4. PowerShell 验收
```powershell
$base = 'https://phenyxpro-intel-feed.rantiontim.workers.dev'
$feed = Invoke-RestMethod "$base/api/briefing.json?min_score=35&sort=score&limit=100" -Headers $headers
$feed | Select-Object version, totalArticles, totalAllArticles, totalPodcastEpisodes, podcastsIncluded, totalMatching

# 默认主新闻必须没有播客条目
$feed.items | Where-Object { $_.contentKind -eq 'podcast_episode' }

# 播客仍可在独立接口查询
$episodes = Invoke-RestMethod "$base/api/admin/v3/podcast-episodes?limit=100" -Headers $headers
$episodes.episodes | Select-Object -First 10 title, podcast_quality, relevance_score, original_relevance_score, source_url

# 显式 opt-in 才把播客并入全部内容
$all = Invoke-RestMethod "$base/api/briefing.json?min_score=35&sort=score&limit=100&include_podcasts=1" -Headers $headers
$all | Select-Object totalArticles, totalPodcastEpisodes, podcastsIncluded, totalMatching
```

预期：
- `version = 3.0.5`
- 默认 `podcastsIncluded = False`
- 默认列表中没有 `contentKind = podcast_episode`
- `totalPodcastEpisodes` 与 summary 中的播客数量一致
- Podcast API 仍能查询历史节目和原始链接
- `include_podcasts=1` 时 `podcastsIncluded = True`

## 5. 不应改变
- 41 个品牌。
- 7 个现有活跃来源。
- 所有历史新闻、40 期播客、29 条品牌提及、5 条行业讨论、1 条待审核记录及原有非播客事件。
- 翻译关闭、英文原文优先、35 分门槛、相关性降序。
- 每日北京时间09:00采集。

如果任何数量不一致，先停止进一步修改并保存响应 JSON；不要删除记录或重跑回填。
