-- V2.1: additive schema update; existing articles are preserved.
ALTER TABLE articles ADD COLUMN relevance_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE articles ADD COLUMN market_pillar TEXT NOT NULL DEFAULT 'Adjacent Industry';
ALTER TABLE articles ADD COLUMN product_family TEXT;
ALTER TABLE articles ADD COLUMN model TEXT;
ALTER TABLE articles ADD COLUMN evidence TEXT;
ALTER TABLE articles ADD COLUMN analysis_status TEXT NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_articles_relevance ON articles(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_market_pillar ON articles(market_pillar);
CREATE INDEX IF NOT EXISTS idx_articles_analysis_status ON articles(analysis_status);

