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
    for (const [column, value] of [
      ["kind", endpoint === "brand-mentions" ? "brand_mention" : endpoint === "industry-discussions" ? "industry_discussion" : null],
      ["source_name", p.get("source")],
      [id, p.get("id")],
      ["brand_name", endpoint === "podcast-episodes" ? null : p.get("brand")],
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
    const order = table === "podcast_episodes" && p.get("sort") === "score" ? "relevance_score DESC," : "";
    const sql = "SELECT * FROM " + table + where + " ORDER BY " + order + "published_at DESC," + id + " LIMIT ? OFFSET ?";
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
