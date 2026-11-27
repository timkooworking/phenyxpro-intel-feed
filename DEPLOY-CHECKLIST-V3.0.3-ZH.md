# V3.0.3 部署验收清单

- [ ] GitHub Actions `npm run check` 全部通过。
- [ ] 远程 D1 migration `0008_open_media_expansion.sql` 成功应用。
- [ ] Worker `/health` 返回 `3.0.3`、`translationEnabled: false`、`contentLanguage: en-original`。
- [ ] 四个来源的 `media-activation` 状态为 `approved_awaiting_success`。
- [ ] 四个来源的 Worker-side `/api/admin/v3/sources/check-feed` 均 `ok=True`。
- [ ] 首次 `/api/admin/run-collection` 正常完成。
- [ ] Church Production 单次 seen 不超过 30。
- [ ] Production Expert 单次 seen 不超过 20。
- [ ] 两个 Podcast 单次 seen 各不超过 20。
- [ ] Podcast collector 只请求 RSS XML，不请求任何 enclosure/audio URL。
- [ ] source-monitor 中四个新来源出现成功运行记录。
- [ ] Chrome 仍使用 35 分以上、相关性降序；只有达到 35 分的新增文章进入默认视图。
- [ ] Gearnews、Mix Online、AVNation 仍正常运行。
- [ ] 六家零售商仍未启用；Reddit 仍 pending_authorization。
- [ ] 不修改 FEED_TOKEN、D1 ID、Cron、AI/翻译配置。

**重要：** Windows PowerShell HTTP 200 不代表 Cloudflare Worker 网络也可访问。必须通过 Worker-side preflight 后再执行首次采集。
