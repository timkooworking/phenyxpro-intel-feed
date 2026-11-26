# Phenyx Pro 专业媒体 RSS / 内容使用许可申请模板（2026-11-26）

## 先联系哪些出版方？

| 优先级 | 媒体 | 官方联系渠道 | 当前判断 |
| --- | --- | --- | --- |
| P1 | Church Production | `https://www.churchproduction.com/contact`（官方 Editorial 邮箱：`editorial@pmipub.com`；或 `bblackmore@pmipub.com`） | 官方 RSS 候选已登记，需确认企业内部元数据监测许可 |
| P1 | Production Expert | `https://www.production-expert.com/contact-us` | 出版方公开了 RSS 阅读器链接，但企业内部分析的授权范围不明 |
| P1 | MusicTech | `licensing@musictech.com`，`https://musictech.com/contact/` | 公共 Feed 候选有时返回 403；需官方可用方案及使用许可 |
| P1 | Guitar World + MusicRadar | `licensing@futurenet.com`，`https://futureplc.com/contact/` | 同属 Future，集中申请商用数据/内容许可 |
| P2 | Sound On Sound | 官网联系与版权部门 | 系统化自动采集必须先获许可，Feed 访问不稳定 |
| P2 | Sweetwater InSync | `https://www.sweetwater.com/insync/`，官方商业合作/编辑渠道 | 申请编辑内容 RSS，**不要**当作商品目录 Feed |
| P2 | Performer Magazine, FOH, Pro Sound Web, Recording Magazine, Worship Leader | 官网编辑部门 | 询问 RSS、许可 Newsletter、press-room API 或可授权分发方式 |

上表邮箱及联系页来源：Church Production 官方 Contact、Production Expert 官方 Contact、MusicTech 官方 Contact、Future 官方 Contact；发信前应在对应官网再次确认。

## 英文邮件通用模板：内部商业情报用 Feed 元数据

**Subject:** Request for Permission to Monitor Your RSS Editorial Updates Internally – Phenyx Pro

Hello Editorial/Licensing Team,

I’m contacting you on behalf of Phenyx Pro, an audio equipment brand. We maintain a small, internal research dashboard to follow professional audio equipment news, product launches, and use cases in live sound and worship production.

We would like to ask whether you offer an official RSS/Atom feed, licensed news feed, API, or other publisher-approved distribution method for internal commercial research.

Our proposed use is limited to periodic feed checks (typically once per day) and internal indexing of the article **headline, short feed-provided summary, publication date, source URL, and related brand/product tags**. We would link our team back to your website for the complete story. We do not intend to republish full articles, redistribute content publicly, download images/audio, or use the material for model training.

Could you please let us know:

1. Whether this proposed automated internal monitoring is permitted, and under what terms or license;
2. Which official feed or API endpoint you recommend;
3. Which metadata fields may be stored, analyzed, or used for internal summaries;
4. Any required attribution, refresh-rate limits, fees, or restrictions on AI-assisted internal classification?

We would be happy to review an appropriate commercial license or written usage guidelines.

Thank you for your guidance.

Best regards,
Phenyx Pro Market Intelligence Team

## 中文内部备注

- **只有收到明确许可**才在后台登记 `permissionStatus=licensed` 或其他真实适用许可；`permissionReference` 写原始邮件/协议编号或官方条款链接。
- `approved_public_feed` 不应凭“看见公开 RSS 地址”就自行标记；必须有实际适用的出版方许可依据。
- 对方只允许个人 RSS 阅读器时，不等于同意企业自动入库、AI 分类或保存摘要；需单独澄清。
- 如果对方只能提供 Newsletter，可建立人工摘要或签约后的许可订阅流程，不要未经授权直接做网页爬取。
- 此文件是申请模板，**没有向任何出版方发送邮件，也不表示已获许可。**
