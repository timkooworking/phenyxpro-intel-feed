# V3.0 部署检查清单

- [ ] 备份当前 `main` 分支。
- [ ] 用 V3.0 `src/index.js` 替换现有文件。
- [ ] 新增 `migrations/0005_v3_intelligence.sql`。
- [ ] 保留 `0001` 至 `0004`，不要修改或删除。
- [ ] 保留 `wrangler.toml`、D1 ID、FEED_TOKEN、RSS_FEEDS 和 Cron。
- [ ] Commit 到 `main`。
- [ ] 确认 Cloudflare Build 先执行 D1 migration，再部署 Worker。
- [ ] `/health` 显示版本 `3.0.0`。
- [ ] 使用 FEED_TOKEN 调用 `/api/admin/v3/summary`，核对品牌和来源计数。
- [ ] 使用 `/api/admin/v3/backfill-events?limit=200` 回填现有文章事件（幂等，可重复调用）。
- [ ] 检查 `/api/admin/v3/events` 和 `/api/admin/v3/discovery`。
- [ ] 不要激活 `permission_required`、`needs_verification` 或 `pending_authorization` 来源，除非已核实条款并记录授权依据。
- [ ] Reddit 保持 `pending_authorization`。
- [ ] 零售商保持 `permission_required`，直到获得正式 Feed/API 或书面授权。
