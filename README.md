# Phenyx Pro Market Intelligence — Shared Feed Backend

Cloudflare Workers + D1 starter backend for the Chrome extension. Intended for a 30+ person shared team deployment.

## What this package provides
- Authenticated JSON feed at `/api/briefing.json`
- D1 schema for articles and source-run logs
- Daily scheduled collection at 09:00 Asia/Shanghai (01:00 UTC)
- Generic RSS/Atom reader configured from `RSS_FEEDS`
- Optional OpenAI-compatible AI analysis adapter via server-side secrets
- Manual collection endpoint and source-run status endpoint
- GitHub Actions deployment workflow

## Important: this is a backend starter, not a pre-connected news service
No provider credentials are included. No live news source is active until you configure permitted RSS/API endpoints. Reddit post/comment monitoring requires an authorized Reddit API integration or a permitted data provider; this generic RSS collector does not claim to fully monitor Reddit comments. Do not scrape sources in ways that violate their terms, rate limits, privacy rules or access controls.

## 1. Upload this project to GitHub
1. Download and extract the ZIP.
2. Open your repository `phenyxpro-intel-feed`.
3. Click **Add file → Upload files**.
4. Upload the *contents* of the extracted folder, not the ZIP itself. At the repository root you should see `wrangler.toml`, `src/`, `migrations/`, `.github/`, `package.json`, and `README.md`.
5. Commit to the `main` branch.

## 2. Create Cloudflare resources
Create a Cloudflare account, then install Node.js locally if you want to run the initial setup commands. In a terminal inside the repository:

```bash
npm install
npx wrangler login
npx wrangler d1 create phenyxpro-intel-db
```

Cloudflare returns a database ID. Replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.toml` with that exact ID.

Apply the schema:

```bash
npx wrangler d1 migrations apply phenyxpro-intel-db --remote
```

## 3. Configure secrets (never commit secrets)
Set a long random feed token:

```bash
npx wrangler secret put FEED_TOKEN
```

Optional AI analysis (OpenAI-compatible endpoint):
```bash
npx wrangler secret put AI_API_URL
npx wrangler secret put AI_API_KEY
npx wrangler secret put AI_MODEL
```

Example AI endpoint value can be configured according to the AI provider you choose. Keep all credentials in Worker secrets, never in GitHub source files or the browser extension package.

Configure RSS feeds as a Worker secret. Use one source per line:
`Source name|https://valid-feed-url.example/rss.xml|Category`

Allowed categories:
- `Brand & Product`
- `Worship Audio`
- `Creator Audio`
- `Media & Retail`
- `Community / Reddit`
- `Phenyx Pro Mentions`

Example format only (replace with verified RSS/Atom feed URLs you are permitted to use):
```text
Shure News|https://example.com/feed.xml|Brand & Product
Worship Publication|https://example.org/rss|Worship Audio
```

Set the value using:
```bash
npx wrangler secret put RSS_FEEDS
```

Deploy once:
```bash
npx wrangler deploy
```

## 4. Enable GitHub Actions deployment
In GitHub repository → **Settings → Secrets and variables → Actions**, add:
- `CLOUDFLARE_API_TOKEN` — create a scoped Cloudflare API token with permission to edit Workers and D1 as required.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.

After that, each push to `main` triggers Worker deployment. The D1 database must be created and `wrangler.toml` must contain its real ID before deployment.

## 5. Connect the browser extension
After deployment, your Worker URL will look like:
`https://phenyxpro-intel-feed.<your-workers-subdomain>.workers.dev`

Set the extension's Shared feed URL to:
`https://phenyxpro-intel-feed.<your-workers-subdomain>.workers.dev/api/briefing.json`

Set its optional access token to the same value you entered for `FEED_TOKEN`.

The extension should send `Authorization: Bearer <token>`. The Worker supports CORS for this request.

## 6. Test
- Health check: `GET https://YOUR_WORKER/health`
- Feed check: `GET https://YOUR_WORKER/api/briefing.json` with the bearer token.
- Manual collection: `POST https://YOUR_WORKER/api/admin/run-collection` with the bearer token.
- Source run logs: `GET https://YOUR_WORKER/api/admin/source-runs` with the bearer token.

The daily cron runs at 01:00 UTC, which is 09:00 China Standard Time. Cloudflare Cron is UTC-based; review daylight-saving expectations if you later change the target timezone.

## 7. 30+ team security recommendation
The extension's current shared bearer-token field is a simple first integration method. For a 30+ person company deployment, do not treat one shared token as strong per-user access control. The recommended production upgrade is:
- Put the dashboard behind Cloudflare Access / company identity.
- Give each teammate an individual login.
- Keep the ingestion API and AI keys server-side.
- Use per-user or service-to-service authorization and audit logs.
- Restrict access to company email domains.

Do not publish the feed endpoint without authentication if the database contains internal analysis.

## Source coverage roadmap
- Brand news: configure official brand RSS/Atom feeds where available.
- Retail/media: configure publisher RSS feeds or licensed partner APIs.
- Forums: use feeds or approved APIs; do not bypass login or anti-bot controls.
- Reddit: implement a dedicated adapter using authorized Reddit API access or a compliant data vendor. This starter does not yet perform complete Reddit post + comment monitoring.
- Worship Audio: prioritize Church Production, Worship Leader, AVNation, ProSoundWeb and church technology event feeds where available.

## Data quality rules
- Store the source URL and publication date.
- Deduplicate by canonical URL.
- Keep source summary separate from AI analysis.
- Mark AI confidence as Unreviewed when AI is not configured.
- Do not infer sales numbers from product launch announcements.
- Report "no verified new mentions found" rather than claiming there were none if a source was unavailable.
