CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  canonical_url TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  source_name TEXT,
  published_at TEXT,
  collected_at TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Brand & Product',
  priority TEXT NOT NULL DEFAULT 'Medium',
  brand TEXT,
  summary TEXT,
  analysis TEXT,
  confidence TEXT NOT NULL DEFAULT 'Unreviewed',
  content_type TEXT,
  sentiment TEXT,
  is_phenyx_mention INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_brand ON articles(brand);
CREATE INDEX IF NOT EXISTS idx_articles_phenyx ON articles(is_phenyx_mention, published_at DESC);

CREATE TABLE IF NOT EXISTS source_runs (
  id TEXT PRIMARY KEY,
  source_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  items_seen INTEGER NOT NULL DEFAULT 0,
  items_added INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
