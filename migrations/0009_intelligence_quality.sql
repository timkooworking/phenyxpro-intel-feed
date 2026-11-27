-- V3.0.4. Preserve every original article and event row.
ALTER TABLE articles ADD COLUMN podcast_metadata INTEGER NOT NULL DEFAULT 0;
ALTER TABLE competitor_events ADD COLUMN evidence_field TEXT;
ALTER TABLE competitor_events ADD COLUMN event_subject TEXT;
ALTER TABLE competitor_events ADD COLUMN evidence_url TEXT;

CREATE TABLE intelligence_notes (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL REFERENCES articles(id),
  kind TEXT NOT NULL CHECK (kind IN ('brand_mention','needs_review')),
  brand_name TEXT NOT NULL DEFAULT '',
  evidence_text TEXT NOT NULL,
  evidence_field TEXT NOT NULL CHECK (evidence_field IN ('title','rss_summary')),
  UNIQUE (article_id,kind,brand_name)
);

CREATE TABLE intelligence_review_decisions (
  review_id TEXT PRIMARY KEY,
  decision TEXT NOT NULL CHECK (decision IN ('dismissed','approved')),
  reason TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  event_id TEXT REFERENCES competitor_events(id)
);

CREATE VIEW podcast_episodes AS
SELECT a.id AS article_id,a.title,a.summary,a.source_name,a.canonical_url AS source_url,
       a.published_at,a.relevance_score
FROM articles a
WHERE a.podcast_metadata=1 OR EXISTS (
  SELECT 1 FROM source_registry s
  WHERE s.source_name=a.source_name AND
    (s.feed_content_mode='podcast_metadata' OR s.id IN ('src-church-sound-podcast','src-psw-signal-to-noise-podcast'))
);

CREATE VIEW intelligence_event_history AS
SELECT e.*,
  CASE
    WHEN e.evidence_field IS NOT NULL THEN 'actionable'
    WHEN EXISTS (SELECT 1 FROM podcast_episodes p WHERE p.article_id=e.article_id)
      OR EXISTS (
        SELECT 1 FROM source_registry s
        WHERE s.source_name=e.source_name AND
          (s.feed_content_mode='podcast_metadata' OR s.id IN ('src-church-sound-podcast','src-psw-signal-to-noise-podcast'))
      )
    THEN CASE e.event_type WHEN 'BRAND_MENTION' THEN 'brand_mention'
                          WHEN 'INDUSTRY_NEWS' THEN 'industry_discussion'
                          ELSE 'needs_review' END
    ELSE 'legacy'
  END AS intelligence_class
FROM competitor_events e;

CREATE VIEW intelligence_entries AS
SELECT 'legacy:'||e.id AS id,
  COALESCE(e.article_id,a.id) AS article_id,e.intelligence_class AS kind,e.brand_name,
  COALESCE(a.title,e.evidence_text) AS title,e.source_name,e.source_url,e.published_at,
  e.evidence_text,'legacy_event' AS evidence_field,e.id AS legacy_event_id,e.event_type AS original_event_type,
  CASE
    WHEN e.intelligence_class='industry_discussion' AND COALESCE(a.title,e.evidence_text) LIKE '%State of AI in Audio%' THEN 'technical_discussion'
    WHEN e.intelligence_class='industry_discussion' AND e.source_name='Signal To Noise (Pro Sound Web Podcast)'
      AND (COALESCE(a.title,e.evidence_text) GLOB '337.*' OR COALESCE(a.title,e.evidence_text) GLOB '334.*'
        OR COALESCE(a.title,e.evidence_text) GLOB '329.*') THEN 'interview'
  END AS discussion_type
FROM intelligence_event_history e
LEFT JOIN articles a ON a.id=e.article_id OR (e.article_id IS NULL AND a.canonical_url=e.source_url)
WHERE e.intelligence_class IN ('brand_mention','industry_discussion','needs_review')
UNION ALL
SELECT n.id,n.article_id,n.kind,NULLIF(n.brand_name,''),a.title,a.source_name,a.canonical_url,a.published_at,
  n.evidence_text,n.evidence_field,NULL,NULL,NULL
FROM intelligence_notes n JOIN articles a ON a.id=n.article_id;

CREATE VIEW intelligence_review_queue AS
SELECT i.*,COALESCE(d.decision,'pending') AS review_status,d.reason AS review_reason,
       d.decided_at,d.event_id
FROM intelligence_entries i LEFT JOIN intelligence_review_decisions d ON d.review_id=i.id
WHERE i.kind='needs_review';
