# V3.0.2 部署验收清单（从 V3.0.1 升级）

- [ ] 备份当前 GitHub 分支及 Cloudflare D1 数据
- [ ] 确认当前线上 `/health` 为 V3.0.1，现有三家媒体正常
- [ ] 上传 Patch 中 `src/index.js`、`package.json`、`.github/workflows/deploy.yml`、新迁移和新测试；不要删除 0005、0006
- [ ] GitHub CI `npm run check` 通过
- [ ] GitHub CI 执行 `wrangler d1 migrations apply ... --remote` 成功
- [ ] GitHub CI 执行 `wrangler deploy` 成功
- [ ] 线上 `/health`、`/api/briefing.json`、`/api/admin/v3/summary` 显示版本 3.0.2
- [ ] 数据库仍有 41 个 activeBrands、7 个历史竞品事件；不要求计数永远不变
- [ ] `/api/admin/v3/media-activation` 正常返回来源准备队列
- [ ] `/api/admin/v3/sources/check-feed` 对未授权来源拒绝（403），无外部访问
- [ ] 对原有授权媒体执行一次 Feed preflight，检查成功结果写入 `/api/admin/v3/source-feed-checks`
- [ ] 3 个原有媒体仍为 `collecting`，其他 28 个仍 `not_enabled`（在获得合法授权前）
- [ ] Reddit、社区、零售价格数据仍未授权，未误激活
- [ ] 旧 Chrome 新闻列表、35 分默认过滤及英文原文保持正常

**注意：部署 3.0.2 本身不等于新增来源已经正式采集。媒体激活须单独完成许可审查。**
