-- V3.0.6: refresh the seven editorial source records. No schema changes.
-- Apply only to the seeded candidates which are still awaiting a decision.
WITH discovery(id, feed_url, notes) AS (
  VALUES
    ('src-sweetwater-insync', 'https://www.sweetwater.com/insync/feed/',
     'Official InSync RSS: HTTP 200, 10 dated items. Site terms limit use to personal, non-commercial purposes. Alternate: read the public InSync editorial page manually.'),
    ('src-worship-leader', NULL,
     'Direct unauthenticated request to the publisher homepage returned HTTP 403. No article RSS verified. Alternate: official Podcasts Archive or weekly newsletter via the free membership.'),
    ('src-recording-mag', 'https://www.recordingmag.com/feed/',
     'Publisher advertises this RSS, but HTTP 200 XML contained zero items. Industry News links to the same empty feed. Alternate: Recording Magazine Sound Advice and Spotlight newsletters.'),
    ('src-foh', 'https://fohonline.com/feed',
     'The previously registered RSS candidate returned HTTP 403. Publisher RSS access is unverified. Alternate: the publisher describes a FOH newsletter and digital edition.'),
    ('src-musician-friend-press', 'http://feeds.feedburner.com/musiciansfriend/LhqY',
     'The official Press Room links to this HTTP FeedBurner URL. Direct check returned HTTP 502. The visible releases end in 2014, and current site terms restrict use to personal use. Alternate: read the public Press Room or relevant manufacturers'' own newsrooms manually.')
)
UPDATE source_registry
SET feed_url = (SELECT feed_url FROM discovery WHERE discovery.id = source_registry.id),
    notes = (SELECT notes FROM discovery WHERE discovery.id = source_registry.id),
    access_method = 'open_media_review',
    updated_at = '2026-11-27'
WHERE id IN (SELECT id FROM discovery) AND status = 'needs_verification'
  AND permission_status = 'review_required' AND permission_reference IS NULL;

-- Publicly advertised editorial RSS, accessed directly without authentication.
-- Limit the new sources to headline, same-origin URL, and publication date.
WITH verified(id, feed_url, reference, notes) AS (
  VALUES
    ('src-prosoundweb', 'https://www.prosoundweb.com/feed/',
     'Official https://www.prosoundweb.com/news/ advertises RSS. Direct RSS-reader GET: HTTP 200, 10 dated items, no login. Public robots rules include search=yes, ai-train=no, use=reference. Internal reference metadata only.',
     'Site-wide editorial RSS includes live sound and products. Direct RSS access succeeded, while a separate web index fetch reported HTTP 403. Known announcements for the two existing podcasts are excluded. PSW Daily is a manual alternative.'),
    ('src-performer-mag', 'https://performermag.com/feed/',
     'Official https://performermag.com/ advertises RSS. Direct RSS-reader GET: HTTP 200, 10 dated items, no login. robots.txt allows the feed for general readers and lists a 10-second crawl delay. Internal reference metadata only.',
     'Broad music and gear editorial RSS with portable PA and live sound material. Latest observed item dated 2026-10-27. The publisher provides a public issue archive.')
)
UPDATE source_registry
SET feed_url = (SELECT feed_url FROM verified WHERE verified.id = source_registry.id),
    permission_reference = (SELECT reference FROM verified WHERE verified.id = source_registry.id),
    notes = (SELECT notes FROM verified WHERE verified.id = source_registry.id),
    access_method = 'public_rss_metadata',
    -- V3.0.5 does not recognize this status and cannot collect in the old article mode.
    permission_status = 'approved_public_editorial_metadata',
    status = 'active',
    max_items_per_run = 10,
    feed_content_mode = 'editorial_metadata',
    updated_at = '2026-11-27'
WHERE id IN (SELECT id FROM verified) AND status = 'needs_verification'
  AND permission_status = 'review_required' AND permission_reference IS NULL;
