import { eventStatement, explicitEvent, httpsUrl } from "./intelligence.js";

export async function intelligenceCounts(db) {
  return db.prepare(`SELECT
    (SELECT COUNT(*) FROM podcast_episodes) AS podcastEpisodes,
    (SELECT COUNT(*) FROM intelligence_entries WHERE kind='brand_mention') AS brandMentions,
    (SELECT COUNT(*) FROM intelligence_entries WHERE kind='industry_discussion') AS industryDiscussions,
    (SELECT COUNT(*) FROM intelligence_review_queue WHERE review_status='pending') AS pendingReviews,
    (SELECT COUNT(*) FROM intelligence_event_history WHERE intelligence_class='actionable') AS actionableEvents,
    (SELECT COUNT(*) FROM intelligence_event_history WHERE intelligence_class='legacy') AS legacyNonPodcastEvents,
    (SELECT COUNT(*) FROM intelligence_entries WHERE legacy_event_id IS NOT NULL) AS reclassifiedPodcastRecords`).first();
}

const lists = {
  "podcast-episodes": ["podcast_episodes", "episodes", "article_id"],
  "brand-mentions": ["intelligence_entries", "mentions", "id"],
  "industry-discussions": ["intelligence_entries", "discussions", "id"],
  "review-queue": ["intelligence_review_queue", "reviews", "id"]
};

export async function intelligenceAdmin(req, env, url, send, loadBrandRules) {
  const endpoint = url.pathname.slice("/api/admin/v3/".length);
  if (req.method === "GET" && Object.hasOwn(lists, endpoint)) {
    const [table, key, id] = lists[endpoint];
    const filters = [], args = [];
    const p = url.searchParams;
    const isPodcast = endpoint === "podcast-episodes";
    for (const [column, value] of [
      ["kind", endpoint === "brand-mentions" ? "brand_mention" : endpoint === "industry-discussions" ? "industry_discussion" : null],
      [isPodcast ? "p.source_name" : "source_name", p.get("source")],
      [isPodcast ? "p.article_id" : id, p.get("id")],
      ["brand_name", isPodcast ? null : p.get("brand")],
      ["review_status", endpoint === "review-queue" ? (p.get("status") || "pending") : null]
    ]) {
      if (value) {
        filters.push(column + "=?");
        args.push(value);
      }
    }
    const limit = Math.min(200, Math.max(1, Math.floor(Number(p.get("limit")) || 100)));
    const offset = Math.min(1000000, Math.max(0, Math.floor(Number(p.get("offset")) || 0)));
    const where = filters.length ? " WHERE " + filters.join(" AND ") : "";
    if (isPodcast) {
      // Episodes are intentionally low-priority content, not Market News.
      // Preserve the original score for audit, but cap generic content in this
      // dedicated view so interviews/mentions/tutorials do not look like launches.
      const scoreExpr = `CASE
        WHEN EXISTS (SELECT 1 FROM intelligence_review_queue q WHERE q.article_id=p.article_id AND q.review_status='pending') THEN MIN(p.relevance_score,35)
        WHEN lower(COALESCE(a.content_type,'')) IN ('review','buying guide') THEN p.relevance_score
        WHEN lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%how to%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%tutorial%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%troubleshoot%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%tips%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%when to%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%mix rescue%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%explained%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%setup%' THEN MIN(p.relevance_score,25)
        ELSE MIN(p.relevance_score,20) END`;
      const qualityExpr = `CASE
        WHEN EXISTS (SELECT 1 FROM intelligence_review_queue q WHERE q.article_id=p.article_id AND q.review_status='pending') THEN 'needs_review'
        WHEN lower(COALESCE(a.content_type,'')) IN ('review','buying guide') THEN 'product_review'
        WHEN lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%how to%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%tutorial%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%troubleshoot%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%tips%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%when to%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%mix rescue%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%explained%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%setup%' THEN 'basic_education'
        WHEN lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%interview%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%sound designer%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%mix engineer%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%audio professional%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%conversation%'
          OR lower(COALESCE(p.title,'')||' '||COALESCE(p.summary,'')) LIKE '%state of %' THEN 'interview_or_discussion'
        ELSE 'general_podcast' END`;
      const scoreOrder = p.get("sort") === "score" ? scoreExpr + " DESC," : "";
      const sql = `SELECT p.article_id,p.title,p.summary,p.source_name,p.source_url,p.published_at,
        p.relevance_score AS original_relevance_score,${scoreExpr} AS relevance_score,
        ${qualityExpr} AS podcast_quality,a.brand AS detected_brand,a.content_type AS original_content_type
        FROM podcast_episodes p JOIN articles a ON a.id=p.article_id${where}
        ORDER BY ${scoreOrder}p.published_at DESC,p.article_id LIMIT ? OFFSET ?`;
      const rows = await env.DB.prepare(sql).bind(...args, limit, offset).all();
      return send({ [key]: rows.results || [], limit, offset, note: "Podcast episodes are separate from Market News. Generic mentions/interviews are capped at 20, basic education at 25, and review candidates are held at 35; original_relevance_score is retained for audit." });
    }
    const sql = "SELECT * FROM " + table + where + " ORDER BY published_at DESC," + id + " LIMIT ? OFFSET ?";
    const rows = await env.DB.prepare(sql).bind(...args, limit, offset).all();
    return send({ [key]: rows.results || [], limit, offset });
  }
  if (endpoint !== "review-queue/resolve" || req.method !== "POST") return null;
  let body;
  try {
    body = await req.json();
  } catch {
    return send({ error: "Valid JSON body required" }, 400);
  }
  const { id, decision, reason } = body || {};
  if (typeof id !== "string" || typeof reason !== "string" || !reason.trim() || reason.length > 1000 ||
      !["dismissed", "approved"].includes(decision)) {
    return send({ error: "Review id, decision and reason (up to 1000 characters) required" }, 400);
  }
  const queueItem = await env.DB.prepare("SELECT * FROM intelligence_review_queue WHERE id=?").bind(id).first();
  if (!queueItem) return send({ error: "Review item not found" }, 404);
  if (queueItem.review_status !== "pending") return send({ error: "Review has already been resolved" }, 409);

  const now = new Date().toISOString();
  const writes = [];
  let key = null;
  if (decision === "approved") {
    const { brandName, evidenceUrl, evidenceText } = body;
    const brand = (await loadBrandRules(env)).find(rule => rule.name === brandName && brandName !== "Phenyx Pro");
    const claim = typeof evidenceText === "string" && brand && explicitEvent(evidenceText.trim(), brand);
    if (!claim || typeof evidenceUrl !== "string" || !httpsUrl(evidenceUrl)) {
      return send({ error: "Approval requires an active competitor, HTTPS evidence URL and an explicit brand/action/subject quotation" }, 400);
    }
    const verified = eventStatement(env.DB, {
      ...claim, brand, now, evidenceUrl, articleId: queueItem.article_id,
      evidence: { field: "manual", text: evidenceText.trim() },
      item: { url: queueItem.source_url }, src: { name: queueItem.source_name },
      publishedAt: queueItem.published_at, region: "Unknown"
    }, id);
    writes.push(verified.stmt);
    key = verified.key;
  }
  writes.push(env.DB.prepare(`INSERT INTO intelligence_review_decisions (review_id,decision,reason,decided_at,event_id)
    SELECT ?,?,?,?,(SELECT id FROM competitor_events WHERE dedupe_key=?)
    WHERE EXISTS (SELECT 1 FROM intelligence_review_queue WHERE id=? AND review_status='pending')
    ON CONFLICT(review_id) DO NOTHING`).bind(id,decision,reason.trim(),now,key,id));
  const result = await env.DB.batch(writes);
  if (!result.at(-1).meta?.changes) return send({ error: "Review has already been resolved" }, 409);
  return send({ id, decision });
}
