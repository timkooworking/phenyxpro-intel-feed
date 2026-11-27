# Phenyx Pro Intelligence V3.0.4 部署与验收

## 基线与迁移

本增量包基于上传的 `phenyxpro-intel-feed-main (1).zip`。源 ZIP 的 SHA‑256 为 `2F3315B66C1BE8AD227C566B0C58366FDB68247734FC0951AB73FBBC1A610E72`，ZIP 注释记录的提交号为 `0079bf8b193a54d3d81327e156114fd44b7ffe77`。仓库源代码与 `package.json` 均为 V3.0.3.1。`src/index.js` 已包含 Buzzsprout 数字 GUID 回退，配套测试覆盖两个节目，并验证只读取 RSS 元数据。这个解析路径继续沿用。仓库内嵌的 `phenyxpro-intel-feed-backend.zip` 未作为生产源码使用。

| 编号 | 原仓库内容 |
| --- | --- |
| `0001_init.sql` | 文章及采集运行表 |
| `0002_classification.sql` | 相关性、细分市场、品类、型号、证据和分析状态 |
| `0003_repair_v21_columns.sql` | 同一组六列的历史修复路径 |
| `0004_translation.sql` | 历史翻译字段 |
| `0005_v3_intelligence.sql` | 监测品牌、来源、观察、事件和发现记录 |
| `0006_media_expansion.sql` | 媒体来源与索引 |
| `0007_media_activation.sql` | Feed 检测记录 |
| `0008_open_media_expansion.sql` | 四个新增媒体来源，含两个播客 |
| `0009_intelligence_quality.sql` | 节目标记、证据字段、审核记录及分类视图 |

在空库执行原始文件时，`0002` 后再执行 `0003` 会报 `duplicate column name: relevance_score`。本地测试覆盖 `0001 → 0002 → 0004…0009` 与 `0001 → 0003 → 0004…0009` 两条等效建表路径。已有数据库以自己的迁移历史为准。如果 Wrangler 把 `0003` 或其他旧迁移列为待执行，先核对该库的迁移记录和表结构，再安排部署。`0001` 至 `0008` 保持原样。

`0009` 通过视图重分类历史数据。原文章、URL、事件 ID、原事件类型及证据字段逐行保留。根据交接时的数量，部署后的初始验收预期如下。

| 项目 | 预期 |
| --- | ---: |
| 播客节目及原链接 | 40 |
| 历史品牌提及 | 29 |
| 历史行业讨论与访谈 | 5 |
| 第 324 期 SoundBase 待审核 | 1 |
| 原始非播客事件历史 | 7 |
| 已确认正式竞品事件 | 0 |

五条讨论中，337、334、329 归入访谈，333、323 归入技术讨论。324 的原始 `PRODUCT_UPGRADE` 类型、品牌、证据和链接在历史记录中保留，等待补充证据。旧品牌提及中的 `evidence_field=legacy_event` 表示沿用历史记录，不能用标题本身证实所有旧品牌命中。

## 部署

1. 将增量 ZIP 解压覆盖在当前 V3.0.3.1 仓库的同名路径。保留原有文件，提交前保存当前版本的 Git 提交号并按现有流程备份 D1。
2. 使用 Node.js 22.13 或更新版本以及 Python 3 运行 `npm.cmd run check`。测试使用临时 SQLite 数据库和模拟 Feed，覆盖六期复核节目、重复采集、正式证据、鉴权及审核记录。Windows 上需能以 `python3` 启动 Python，亦可使用现有 GitHub Actions 的 Ubuntu 测试环境。
3. 在你已有授权的环境中检查待执行迁移。下列命令只列出待执行文件。

```powershell
npx wrangler d1 migrations list phenyxpro-intel-db --remote
```

4. 确认现场只待执行 `0009_intelligence_quality.sql` 后，将完整补丁合并到 `main`。仓库现有 GitHub Actions 在 `main` 更新后运行测试、应用迁移，再发布 Worker。无需另行发布或重设 `FEED_TOKEN`。保持 `wrangler.toml` 中的原 D1 绑定及 `0 1 * * *`，对应北京时间每日 09:00。参阅 [Cloudflare D1 迁移命令](https://developers.cloudflare.com/workers/wrangler/commands/d1/#d1-migrations-list)。
5. 部署完成后在 PowerShell 7 中运行只读验收。使用 `-AssertBaseline` 验证上表的精确初始值。如果已经完成新一轮采集或人工审核，省略此开关以检查历史数量下限及接口行为。

```powershell
.\scripts\verify-v3.0.4.ps1 -BaseUrl 'https://YOUR-WORKER.workers.dev' -AssertBaseline
```

脚本提示输入现有 `FEED_TOKEN`，通过 HTTPS 调用健康与读取接口。可在 Cloudflare 控制面板查看 Cron Trigger 的 UTC 表达式和后续运行记录。采用当前发布流程回退 Worker 时，保留 `0009` 新增的字段、视图与审核数据。旧 Worker 会恢复旧的分类行为，待重新发布 V3.0.4 后可再用新接口查询。

## 看板与审核接口

下列表格的路径均以 `/api/admin/v3/` 开头，并沿用 `Authorization: Bearer <FEED_TOKEN>`。节目、品牌提及、讨论和审核列表可通过 `limit`、`offset` 分页，通过 `source` 精确筛选。品牌提及、讨论和审核也支持 `brand`，各列表支持 `id` 精确查询。

| 方法和路径 | 返回 |
| --- | --- |
| `GET summary` | `intelligence` 提供节目、提及、讨论、待审、正式事件和旧事件数量 |
| `GET podcast-episodes` | 所有播客节目及原链接，可用 `sort=score` 按分数降序查看 |
| `GET brand-mentions` | 普通品牌提及和可追溯的证据摘录 |
| `GET industry-discussions` | 历史访谈和技术讨论 |
| `GET review-queue?status=pending` | 待审项目，亦可查询 `approved` 或 `dismissed` |
| `GET events` | 正式事件及原始标题、来源、日期、品牌、型号或商业对象和证据 |
| `GET events?scope=legacy` | 原有非播客事件 |
| `GET events?scope=all` | 全部原始事件及其 `intelligence_class`，供历史审计 |
| `POST review-queue/resolve` | 用 `id`、`decision`（`approved` 或 `dismissed`）和 `reason` 完成人工审核 |

批准时还需提供监测库中的 `brandName`、`evidenceUrl`（HTTPS）和原文 `evidenceText`。管理员负责比对来源并确认引文，Worker 校验引文是否明确说明品牌、已发生的商业动作和型号或商业对象。审核决定、原因及事件 ID 可追溯。普通访谈和品牌提及继续作为播客情报，播客中出现明确事件线索也先进入待审。自动规则以少误报为优先，非标准型号、句式、信息不全或语境不清的线索可能需要人工复核。

`/api/briefing.json` 的默认值为 `min_score=35` 和 `sort=score`。播客条目通过 `contentKind=podcast_episode` 标识，同时使用 `contentType=Podcast Episode`。客户端仍可传入明确的筛选或排序参数。交接 ZIP 只有 Worker 后端及测试，Chrome 扩展本身未包含在包中。独立栏目可通过以上接口接入。

本交付的验证范围是上传 ZIP、本地回归和基于交接数量的测试样本。未连接线上 D1、Worker 或私有 GitHub，也未读取凭据。线上数量与实际节目链接请以部署后的只读验收为准。
