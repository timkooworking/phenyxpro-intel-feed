-- V3.0.2 additive RSS preflight evidence. No source status changes or new collectors.
CREATE TABLE IF NOT EXISTS source_feed_checks (
 id TEXT PRIMARY KEY,
 source_id TEXT NOT NULL,
 source_name TEXT NOT NULL,
 checked_at TEXT NOT NULL,
 success INTEGER NOT NULL CHECK(success IN (0,1)),
 http_status INTEGER,
 parsed_items INTEGER NOT NULL DEFAULT 0,
 error_message TEXT,
 FOREIGN KEY(source_id) REFERENCES source_registry(id)
);
CREATE INDEX IF NOT EXISTS idx_source_feed_checks_source_date ON source_feed_checks(source_id,checked_at DESC);
