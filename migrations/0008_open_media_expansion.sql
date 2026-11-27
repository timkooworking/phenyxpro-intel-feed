-- V3.0.3 Open Media Expansion.
-- Adds per-source bounded collection policy and activates four user-verified public RSS feeds.
-- This is metadata-only ingestion: no full-text republication, podcast audio, transcript or enclosure fetch.
-- Existing articles, events, brands, retailers, Reddit status, secrets and cron are unchanged.

ALTER TABLE source_registry ADD COLUMN max_items_per_run INTEGER NOT NULL DEFAULT 40;
ALTER TABLE source_registry ADD COLUMN feed_content_mode TEXT NOT NULL DEFAULT 'article';

-- Public RSS-feed basis approved by the operator for internal feed-reader style monitoring.
-- This is NOT represented as a publisher-specific license. Store only title, short excerpt,
-- publication date and canonical link; do not republish full articles or fetch media assets.
UPDATE source_registry
SET website_url='https://www.churchproduction.com/',
    feed_url='https://www.churchproduction.com/api/rss/content.rss',
    access_method='public_rss_metadata',
    permission_status='approved_public_feed',
    permission_reference='Public publisher RSS endpoint tested by account owner on 2026-11-26 (HTTP 200, application/rss+xml); operator-approved internal feed-reader metadata use only: title, short excerpt, date and canonical link. Not a publisher-specific license.',
    status='active',
    priority=98,
    max_items_per_run=30,
    feed_content_mode='article',
    notes='Public RSS endpoint verified by account owner. Initial collection capped at latest 30 entries; later runs process the latest 30 with canonical-URL deduplication. Metadata and short excerpt only; no full-text republication or image download.',
    last_error=NULL,
    updated_at='2026-11-27T00:00:00.000Z'
WHERE id='src-church-production';

UPDATE source_registry
SET website_url='https://www.production-expert.com/',
    feed_url='https://www.production-expert.com/production-expert-1?format=rss',
    access_method='public_rss_metadata',
    permission_status='approved_public_feed',
    permission_reference='Publisher publicly documents RSS feeds for use in RSS reader apps; endpoint tested by account owner on 2026-11-26 (HTTP 200, application/rss+xml). Operator-approved internal feed-reader metadata use only: title, short excerpt, date and canonical link. Not a publisher-specific license.',
    status='active',
    priority=96,
    max_items_per_run=20,
    feed_content_mode='article',
    notes='Publisher documents RSS use in feed readers. Initial collection capped at latest 20 entries; later runs process latest 20 with canonical-URL deduplication. Metadata and short excerpt only; no full-text republication or image download.',
    last_error=NULL,
    updated_at='2026-11-27T00:00:00.000Z'
WHERE id='src-production-expert';

UPDATE source_registry
SET feed_url='https://rss.buzzsprout.com/748181.rss',
    access_method='public_podcast_rss_metadata',
    permission_status='approved_public_feed',
    permission_reference='Public Buzzsprout podcast RSS feed tested by account owner on 2026-11-26 (HTTP 200, XML). Operator-approved directory/feed-reader style metadata use only; no audio, transcript, enclosure or media download. Feed metadata only; not a publisher-specific license.',
    status='active',
    priority=82,
    max_items_per_run=20,
    feed_content_mode='podcast_metadata',
    notes='Podcast RSS metadata only. First import capped at latest 20 episodes; daily incremental checks remain capped at latest 20 and deduplicate by episode URL. Never fetch enclosure/audio or transcripts.',
    last_error=NULL,
    updated_at='2026-11-27T00:00:00.000Z'
WHERE id='src-psw-signal-to-noise-podcast';

UPDATE source_registry
SET feed_url='https://rss.buzzsprout.com/894865.rss',
    access_method='public_podcast_rss_metadata',
    permission_status='approved_public_feed',
    permission_reference='Public Buzzsprout podcast RSS feed tested by account owner on 2026-11-26 (HTTP 200, XML). Operator-approved directory/feed-reader style metadata use only; no audio, transcript, enclosure or media download. Feed metadata only; not a publisher-specific license.',
    status='active',
    priority=84,
    max_items_per_run=20,
    feed_content_mode='podcast_metadata',
    notes='Podcast RSS metadata only. First import capped at latest 20 episodes; daily incremental checks remain capped at latest 20 and deduplicate by episode URL. Never fetch enclosure/audio or transcripts.',
    last_error=NULL,
    updated_at='2026-11-27T00:00:00.000Z'
WHERE id='src-church-sound-podcast';

CREATE INDEX IF NOT EXISTS idx_source_registry_open_media ON source_registry(status,permission_status,priority DESC);
