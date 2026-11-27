# Phenyx Pro V3.0.6 部署指南

本增量包基于历史对话发布的 **V3.0.5 News Quality Patch**。本地下载目录中的实际 ZIP 与历史工作区的 V3.0.5 核心源码一致。测试基线由该增量覆盖最新可取得的用户仓库快照 `phenyxpro-intel-feed-main (2).zip` 组成。该快照为 V3.0.4，仅提供 V3.0.5 沿用的文件与历史迁移。

升级会在已有七个采集来源上增加 ProSoundWeb 和 Performer Magazine。继续使用已有 41 个品牌、历史数据、播客 GUID 修复、独立 Podcast Intelligence、英文原文优先、关闭翻译、Market News 默认排除播客及相关性 ≥35 降序、`FEED_TOKEN` 与北京时间 09:00 定时采集。没有执行生产部署或读取密钥。

## 媒体核验结果

核验日期为 2026 年 11 月 27 日。直接请求采用无登录、无 Cookie 的普通 RSS 客户端。下表中的公开页面和订阅渠道可供人工查看。站点条款、RSS 数据和访问结果分别核对。

| 来源 | 已实测的入口及结果 | V3.0.6 / 公开替代 |
| --- | --- | --- |
| ProSoundWeb | [新闻页](https://www.prosoundweb.com/news/) 声明的 [站点 RSS](https://www.prosoundweb.com/feed/) 在直接 RSS 客户端请求中返回 HTTP 200、RSS XML、10 条带日期条目，样本日期为 11 月 25 日。另一独立网页索引服务对该地址报告 403。站点 [robots.txt](https://www.prosoundweb.com/robots.txt) 声明 `search=yes, ai-train=no, use=reference`，并限制部分爬虫。 | **启用，仅保留参考元数据**。这是全站编辑 RSS，已排除现有两档播客的已知节目公告格式。Cloudflare Worker 网络需要在部署后单独验收。人工替代为 [PSW Daily](https://www.prosoundweb.com/subscribe/) 和现有独立播客。 |
| Performer Magazine | [官网](https://performermag.com/) 声明的 [RSS](https://performermag.com/feed/) 返回 HTTP 200、RSS XML、10 条带日期条目。最新一条为 10 月 27 日，含便携 PA 等设备报道。[robots.txt](https://performermag.com/robots.txt) 对普通访问列出 10 秒抓取间隔。 | **启用，仅保留参考元数据**。更新频率较低，可人工查阅 [杂志档案](https://performermag.com/magazine/)。 |
| Sweetwater InSync | [InSync 首页](https://www.sweetwater.com/insync/) 声明的 [RSS](https://www.sweetwater.com/insync/feed/) 返回 HTTP 200、10 条带日期条目。[使用条款](https://www.sweetwater.com/about/terms-of-use.php) 将站点使用限定于个人、非商业用途。 | `needs_verification`。可人工浏览公开 InSync 编辑页。 |
| Worship Leader | 直接请求 [官网](https://worshipleader.com/) 返回 HTTP 403，文章 RSS 未证实。 | `needs_verification`。可人工使用 [公开播客目录](https://worshipleader.com/podcasts/) 或查阅 [免费会员周报选项](https://worshipleader.com/join/)。未证实适合本项目的播客 RSS。 |
| Recording Magazine | [官方 RSS](https://www.recordingmag.com/feed/) 返回 HTTP 200、RSS XML，包含 0 条内容。其 [Industry News](https://www.recordingmag.com/news/) 是 HTML，只再次声明该空 RSS。 | `needs_verification`。有 [免费 Sound Advice 和 Spotlight 邮报](https://www.recordingmag.com/resources/newsletters/)。 |
| FOH | 旧注册表的 [候选 RSS](https://fohonline.com/feed) 返回 HTTP 403，官方 RSS 未证实。 | `needs_verification`。人工备用为 [Newsroom](https://fohonline.com/category/newsroom/)。[出版社说明](https://fohonline.com/site/wp-content/uploads/FOH-Publishers-Sworn-Statement_August-2023.pdf) 另列出电子报和数字版。 |
| Musician’s Friend Press Room | [Press Room](https://www.musiciansfriend.com/press-room) 的 [FeedBurner 原链接](http://feeds.feedburner.com/musiciansfriend/LhqY) 返回 HTTP 502。公开新闻稿最新显示 2014 年，[使用条款](https://www.musiciansfriend.com/terms-of-use) 限个人用途。 | `needs_verification`。可人工查看 Press Room 或从对应厂商官网读取公开新闻发布。 |

新增两路 RSS 每次最多处理 10 条，使用原始标题、同源 HTTPS 文章链接与有效发布日期。正文、摘要和媒体附件不入库。分类走现有的本地规则，标题不传给外部 AI 分析接口。请求遇 403 或跳转时按采集失败记录。注册表中的其他五条仅供核验。

## 安装和部署

1. 确认要更新的是 **后端 V3.0.5**，并记录当前 Cloudflare Worker 版本以便回退。确认当前 D1 已应用到 `0009_intelligence_quality.sql`。
2. 解压增量 ZIP，按相对目录将文件覆盖到 V3.0.5 后端仓库。ZIP 含 `package.json`、`src/index.js`、四个测试文件和 `migrations/0010_open_media_discovery.sql`。继续使用当前仓库的 `wrangler.toml`、Workflow、D1 绑定和运行配置。
3. 在仓库根目录运行 `npm run check`。沿用 GitHub Actions 的 Node.js 22 环境及现有 Python 3 测试环境。通过后按现有 GitHub Actions 发布流程提交。该流程先应用远端 D1 迁移，再部署 Worker。新来源的权限标记仅由 V3.0.6 识别，因此旧 Worker 在迁移先完成时也不会采集这两个来源。
4. 检查部署日志已成功应用 `0010_open_media_discovery.sql`。这是**只更新七条来源候选记录**的迁移，没有新增表、字段或索引。它只处理仍待核验且没有授权记录的候选项。已人工处理的条目保留其原设置，实际启用数以来源监控为准。

## 发布后验收

示例使用你当前 PowerShell 会话已有的 `$base` 与 `$headers`。查询和预检无需输出令牌。预检只验证 RSS 解析并记录结果，首次文章入库可由下一轮 09:00 计划任务完成。

```powershell
Invoke-RestMethod "$base/health" |
  Select-Object version, translationEnabled, contentLanguage

$discoveryIds = @('src-prosoundweb', 'src-performer-mag')
foreach ($id in $discoveryIds) {
  Invoke-RestMethod "$base/api/admin/v3/sources/check-feed" -Method Post `
    -Headers $headers -ContentType 'application/json' `
    -Body (@{ id = $id } | ConvertTo-Json -Compress)
}

$monitor = Invoke-RestMethod "$base/api/admin/v3/source-monitor" -Headers $headers
$monitor.sources | Where-Object collectorEligible |
  Select-Object source_name, collectionStatus, qualityScore, newsPublished30Days, marketNewsQualified30Days, last_error

$coverage = Invoke-RestMethod "$base/api/admin/v3/brand-coverage" -Headers $headers
$coverage.marketNewsCoverage30Days
$coverage.brands | Select-Object brand_name, market_news_articles_30d, market_news_sources_30d, matched_podcast_episodes_30d

$news = Invoke-RestMethod "$base/api/briefing.json" -Headers $headers
$news | Select-Object version, minRelevanceScore, podcastsIncluded, totalPodcastEpisodes
$news.items | Where-Object { $_.contentKind -eq 'podcast_episode' }

$podcasts = Invoke-RestMethod "$base/api/admin/v3/podcast-episodes?limit=5" -Headers $headers
$podcasts.episodes | Select-Object title, podcast_quality, source_url
```

- 健康检查预期 `3.0.6`、`translationEnabled = false`、`contentLanguage = en-original`。预检可用时返回上游 HTTP 200 和可解析条目数。若上游 403，查看预检响应的 `httpStatus` 和 `error` 字段，保留错误记录并用上述公开替代渠道人工查看。
- 标准注册表预期 9 个 `collectorEligible` 来源。其中原有七个保持资格。新来源只有在成功采集后才会显示为 `collecting`。
- Market News 预期 `minRelevanceScore = 35`、`podcastsIncluded = false`。查询结果应按相关性降序，播客由独立接口返回。
- `qualityScore` 用最近 30 天数据计算，取成功采集占已完成采集的比率、以及相关性 ≥35 的新闻占该来源已发布非播客文章的比率，各占 50 分。缺少任一样本时返回空值，播客继续使用独立的节目质量分类。此分数用于监控，现有主新闻排序继续使用文章相关性。
- 品牌覆盖按当前系统识别出的品牌统计最近 30 天达标新闻篇数、覆盖媒体数和独立播客篇数。品牌可见度汇总以活跃品牌为分母，零值代表当前采集样本还没有命中。

## 回退

如需回退，在 Cloudflare 恢复到发布前记录的 V3.0.5 Worker 版本。V3.0.5 不识别新增的权限标记，恢复旧 Worker 后，这两路采集停止。既往入库数据和迁移记录可保留。回退无需恢复整库或删除已入库文章。
