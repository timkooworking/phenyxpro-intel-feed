"""SQLite smoke test for migration 0005 against a representative V2.2.1 schema."""
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = sqlite3.connect(":memory:")
DB.execute("PRAGMA foreign_keys=ON")
DB.executescript("""
CREATE TABLE articles (
  id TEXT PRIMARY KEY, canonical_url TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  source_name TEXT, published_at TEXT, collected_at TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Brand & Product', priority TEXT NOT NULL DEFAULT 'Medium',
  brand TEXT, summary TEXT, analysis TEXT, confidence TEXT NOT NULL DEFAULT 'Unreviewed',
  content_type TEXT, sentiment TEXT, is_phenyx_mention INTEGER NOT NULL DEFAULT 0,
  relevance_score INTEGER NOT NULL DEFAULT 0, market_pillar TEXT NOT NULL DEFAULT 'Adjacent Industry',
  product_family TEXT, model TEXT, evidence TEXT, analysis_status TEXT NOT NULL DEFAULT 'pending',
  title_zh TEXT, summary_zh TEXT, translation_status TEXT NOT NULL DEFAULT 'pending',
  translated_at TEXT, translation_error TEXT
);
CREATE TABLE source_runs (
  id TEXT PRIMARY KEY, source_name TEXT NOT NULL, started_at TEXT NOT NULL,
  finished_at TEXT, status TEXT NOT NULL, items_seen INTEGER NOT NULL DEFAULT 0,
  items_added INTEGER NOT NULL DEFAULT 0, error_message TEXT
);
INSERT INTO articles(id,canonical_url,title,source_name,collected_at,relevance_score)
VALUES ('existing-1','https://example.test/article','Existing article','Gearnews','2026-11-26T00:00:00Z',62);
""")
DB.executescript((ROOT / "migrations" / "0005_v3_intelligence.sql").read_text(encoding="utf-8"))
assert DB.execute("SELECT COUNT(*) FROM articles").fetchone()[0] == 1
assert DB.execute("SELECT title FROM articles WHERE id='existing-1'").fetchone()[0] == "Existing article"
assert DB.execute("SELECT COUNT(*) FROM brand_watchlist WHERE status='active'").fetchone()[0] == 41
assert DB.execute("SELECT COUNT(*) FROM source_registry WHERE source_type='retailer' AND status='permission_required'").fetchone()[0] == 6
assert DB.execute("SELECT status FROM source_registry WHERE source_name='Reddit'").fetchone()[0] == "pending_authorization"
assert DB.execute("SELECT COUNT(*) FROM source_registry WHERE status='active' AND source_type IN ('media','brand_pr')").fetchone()[0] == 3
print("V3.0 migration smoke test passed; existing article preserved.")
