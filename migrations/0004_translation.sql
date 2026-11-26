-- V2.2 additive bilingual translation fields; preserves all articles and V2.1 classifications.
ALTER TABLE articles ADD COLUMN title_zh TEXT;
ALTER TABLE articles ADD COLUMN summary_zh TEXT;
ALTER TABLE articles ADD COLUMN translation_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE articles ADD COLUMN translated_at TEXT;
ALTER TABLE articles ADD COLUMN translation_error TEXT;
CREATE INDEX IF NOT EXISTS idx_articles_translation_status ON articles(translation_status);
