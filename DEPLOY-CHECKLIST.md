# Deployment checklist

- [ ] Extract ZIP and upload all project contents to GitHub repository root.
- [ ] Create Cloudflare account.
- [ ] Create D1 database and copy exact database ID into wrangler.toml.
- [ ] Apply D1 migrations remotely.
- [ ] Set FEED_TOKEN Worker secret.
- [ ] Configure approved RSS_FEEDS.
- [ ] Optionally configure AI_API_URL, AI_API_KEY, AI_MODEL.
- [ ] Deploy Worker once.
- [ ] Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID to GitHub Actions secrets.
- [ ] Confirm GitHub Actions deployment succeeds.
- [ ] Test /health and authenticated /api/briefing.json.
- [ ] Add Worker feed URL and token to the Chrome extension.
- [ ] Plan individual team authentication before production rollout to 30+ users.
