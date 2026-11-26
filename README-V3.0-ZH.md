# Phenyx Pro Market Intelligence — V3.0 Phase 1

Cloudflare Workers + D1 backend for competitor-brand, professional-media and retail-channel intelligence.

## What V3.0 Phase 1 adds

- 41 seeded brand profiles covering direct wireless competitors, adjacent pro-audio brands, creator-audio brands, China-export brands and cross-category candidates.
- A source registry for media, PR distribution, retailers and communities, including source type, regions, feed URL, access method, permission state and health timestamps.
- Additive event tracking for brand mentions, launches, product upgrades, reviews, promotions, business updates and installation/use cases.
- A low-confidence discovery queue for unrecognized brands in new-product headlines. Candidates are never promoted automatically.
- Retail product observation storage and an authenticated ingestion endpoint that rejects retailers without an approved product feed or written license.
- Reddit explicitly seeded as `pending_authorization`; community sources are not selected by the Phase 1 RSS collector.
- Existing RSS ingestion, English-original-first behavior, translation disabled response, FEED_TOKEN auth, D1 articles, relevance scoring and 09:00 Asia/Shanghai cron are preserved.

## Existing production behavior preserved

- Worker name: `phenyxpro-intel-feed`
- D1 database: `phenyxpro-intel-db`
- D1 ID: the existing value in `wrangler.toml`
- Cron: `0 1 * * *` (09:00 Asia/Shanghai)
- Existing RSS feeds: Gearnews, Mix Online, AVNation
- Machine translation: disabled
- Default Chrome extension behavior: English original; relevance filter and sort remain client/API controlled

## Deploy

1. Back up the current GitHub repository.
2. Replace `src/index.js` with the V3.0 version in this package.
3. Add `migrations/0005_v3_intelligence.sql` to the existing `migrations/` folder.
4. Update `package.json` if desired (version `3.0.0`).
5. Do **not** replace `wrangler.toml`, earlier migrations, `.github/workflows/deploy.yml`, or any Worker secrets.
6. Commit to `main`. The existing deployment workflow applies remote D1 migrations before deploying the Worker. If using Cloudflare Workers Builds, keep the existing Deploy command:

```bash
npx wrangler d1 migrations apply phenyxpro-intel-db --remote && npx wrangler deploy
```

No new secret or new D1 database is required.

## Source governance and activation

Only the three existing production RSS sources are seeded as `active` (`existing_configured`). New media and PR sources are registered as `needs_verification` or `permission_required`; they are not fetched automatically. Retailers are seeded as `permission_required`. Reddit is seeded as `pending_authorization`; Gearspace, The Gear Page and The Gear Forum are `needs_verification`.

Before activating a new source, verify its publisher terms and obtain any required permission. Then call the authenticated admin endpoint:

`POST /api/admin/v3/sources/authorize`

Example JSON body for a publisher-approved RSS feed:

```json
{
  "id": "src-musictech",
  "permissionStatus": "approved_public_feed",
  "permissionReference": "Publisher terms / written permission reference",
  "feedUrl": "https://musictech.com/feed/"
}
```

Allowed permission statuses: `licensed`, `approved_public_feed`, `approved_product_feed`. A permission reference is required. Community sources remain excluded from the Phase 1 collector even when their registry record changes; a dedicated authorized community adapter is a later phase.

## Retail data: authorization gate

The six seeded retail sources are Sweetwater, Guitar Center, Thomann, B&H Photo Video, Musician's Friend and Gear4music. No product pages are scraped by this package. A retailer must first be activated with `licensed` or `approved_product_feed` and a permission reference. Only then will `POST /api/admin/v3/retail-observations` accept observations for that retailer. This package provides the storage and ingestion API foundation; it does not pretend that any retail feed/API has already been granted.

## Admin API

All `/api/admin/*` endpoints require `Authorization: Bearer <FEED_TOKEN>`.

- `GET /api/admin/v3/summary` — V3 counts and source status
- `GET /api/admin/v3/brands` — brand watchlist; optional `status` and `tier`
- `POST /api/admin/v3/brands` — add a brand as a review candidate (not active)
- `POST /api/admin/v3/brands/activate` — activate a reviewed candidate with an HTTPS evidence URL
- `GET /api/admin/v3/sources` — source registry; optional `type` and `status`
- `POST /api/admin/v3/sources/authorize` — activate an eligible media feed or licensed product feed
- `GET /api/admin/v3/events` — competitor events; optional `brand`, `type`, `region`, `limit`
- `GET /api/admin/v3/discovery` — candidate discovery queue; optional `status`, `limit`
- `POST /api/admin/v3/discovery` — submit a candidate with source evidence
- `POST /api/admin/v3/backfill-events?limit=200` — add deduplicated competitor-event records from existing articles; does not modify articles
- `GET /api/admin/v3/retail-observations` — recent retail observations
- `POST /api/admin/v3/retail-observations` — ingest one observation from an authorized retailer feed

## First post-deploy checks

The initial registry contains 41 active brand profiles and 29 source records: 3 existing active media RSS feeds, 13 media candidates needing verification, 1 media source requiring permission, 2 PR distribution candidates, 6 retailers gated by permission, and 4 community records (Reddit pending authorization; three forums awaiting terms review).

1. `GET /health` should report version `3.0.0`, `translationEnabled: false`, and `redditStatus: pending_authorization`.
2. `GET /api/admin/v3/summary` should report 41 active brand profiles, 3 active media RSS sources, 6 retailers gated by permission, and Reddit pending authorization.
3. Run `POST /api/admin/v3/backfill-events?limit=200` once to create deduplicated event records from the existing article archive. This does not alter existing articles or their scores.
4. Check `GET /api/admin/v3/events` and `GET /api/admin/v3/discovery`.

PowerShell example (reuse the currently valid `$newToken` variable):

```powershell
Invoke-RestMethod `
  -Uri "https://phenyxpro-intel-feed.rantiontim.workers.dev/api/admin/v3/backfill-events?limit=200" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $newToken" } |
  ConvertTo-Json -Depth 6
```

This creates deduplicated event records from the existing article archive without changing the article rows or their relevance scores.

## Important limitations

- This is a backend/data-foundation release. The existing Chrome dashboard is not yet updated with dedicated V3 tabs; that is a separate front-end release.
- Retail product prices and stock are not automatically collected until a permitted product feed/API is supplied and activated.
- Reddit and other community collection are not implemented or enabled in this phase. Reddit remains pending written authorization.
- New-brand discovery is a candidate queue, not an automatic competitor declaration. Every candidate requires human review and evidence.
- Region is set only when explicitly indicated by source content; otherwise it is `Unknown`. Do not infer market-wide demand from a single article or post.
