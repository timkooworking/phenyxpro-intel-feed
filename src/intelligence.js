const MODEL = String.raw`((?=[A-Z0-9-]{2,24}\b)(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9]+(?:-[A-Z0-9]+)*)`;
const PRODUCT = String.raw`(?:wireless microphones?|wireless mic(?:rophone)? systems?|microphones?|in-ear monitors?|IEM systems?|digital mixers?|audio interfaces?|loudspeakers?|headphones?|intercom systems?|mixing consoles?|audio plug-ins?)`;
const PARTNER = String.raw`([A-Z][\w&'-]+(?: [A-Z][\w&'-]+){0,3})`;
const MONEY = String.raw`(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?)`;
const rules = [
  ["NEW_PRODUCT", "(?:launches|introduces|unveils|releases|debuts) (?:its |the )?(?:new )?" + MODEL + " " + PRODUCT],
  ["PRODUCT_UPGRADE", String.raw`releases firmware (?:version |v)?\d+(?:\.\d+)+ for (?:the )?` + MODEL + String.raw`[, ]+(?:adding|which adds) [a-zA-Z][\w -]{3,80}`],
  ["PRICE_CHANGE", "(?:cuts|raises|changes) (?:the )?" + MODEL + " price from (USD|EUR|GBP) (" + MONEY + String.raw`) to \2 (` + MONEY + ")"],
  ["CHANNEL_CHANGE", "appoints " + PARTNER + " as (?:its )?(?:exclusive |authorized )?distributor in [A-Z][A-Za-z -]{1,45}"],
  ["PARTNERSHIP", "signs (?:a )?partnership with " + PARTNER + " to (?:develop|manufacture|distribute) [a-zA-Z][\\w -]{3,80}"],
  ["MARKET_EXPANSION", "expands into " + PARTNER + " (?:through|via) (?:its |a )?(?:new )?(?:distribution center|retail network|local subsidiary)"],
  ["CATEGORY_ENTRY", "enters the " + PRODUCT + " market with (?:its |the )?" + MODEL]
].map(([type, pattern]) => [type, new RegExp("^(?:" + pattern + ")$", "i")]);

const ambiguous = /\b(announc\w*|debut\w*|launch\w*|unveil\w*|introduc\w*|releas\w*|rumou?rs?|upgrad\w*|firmware|price (?:change|cut|increase)|distribut(?:or|ion)|partnership|expand\w*|new product)\b/i;
const ordinaryContext = /\b(how to|tips for|tutorial|troubleshoot\w*|interview|review|hands.on|roundup|used by|on tour|at the show|on stage|sponsor\w*)\b/i;
const uncertainContext = /\b(rumou?r\w*|might|could|would|may|plans to|expected to|reportedly|previously|last year)\b/i;
const unattributedClaim = /\b(firmware (?:update|version|release) for|new product announcement|product launch|price (?:cut|increase)|exclusive distributorship)\b/i;
const productEvents = new Set(["NEW_PRODUCT","PRODUCT_UPGRADE","PRICE_CHANGE","CATEGORY_ENTRY"]);

export function hasPhrase(text, phrase) {
  const hay = String(text || "").toLowerCase(), needle = String(phrase || "").toLowerCase().trim();
  if (!needle) return false;
  let at = hay.indexOf(needle);
  while (at >= 0) {
    const before = hay[at - 1] || " ", after = hay[at + needle.length] || " ";
    const leftOk = !/[a-z0-9]/i.test(needle[0]) || !/[a-z0-9]/i.test(before);
    const rightOk = !/[a-z0-9]/i.test(needle[needle.length - 1]) || !/[a-z0-9]/i.test(after);
    if (leftOk && rightOk) return true;
    at = hay.indexOf(needle, at + 1);
  }
  return false;
}

function matchingText(text, rule) {
  return [rule.name, ...rule.aliases].some(alias => hasPhrase(text, alias));
}

export function httpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function evidenceSnippets(item) {
  return [
    { text: String(item.title || "").trim(), field: "title" },
    ...String(item.description || "").trim().split(/(?<=[.!?])\s+/)
      .map(text => ({ text, field: "rss_summary" }))
  ].filter(({text}) => text);
}

export function explicitEvent(text, brand) {
  if (!text || text.length > 500 || /[?]/.test(text) || ordinaryContext.test(text) || uncertainContext.test(text)) return null;
  const claim = text.replace(/\.$/, "");
  for (const alias of [brand.name, ...brand.aliases]) {
    if (!claim.toLowerCase().startsWith(alias.toLowerCase() + " ")) continue;
    const action = claim.slice(alias.length + 1);
    for (const [type, pattern] of rules) {
      const match = action.match(pattern);
      if (!match) continue;
      if (productEvents.has(type) && match[1] !== match[1].toUpperCase()) continue;
      if (!productEvents.has(type) && !/^[A-Z]/.test(match[1])) continue;
      if (type === "PRICE_CHANGE" && Number(match[3].replaceAll(",", "")) === Number(match[4].replaceAll(",", ""))) continue;
      return { type, subject: match[1] };
    }
  }
  return null;
}

export function classifyIntelligence(item, brandRules, podcast) {
  const snippets = evidenceSnippets(item);
  const annotations = [], events = [];
  const context = snippets.map(({text}) => text).join(" ");
  for (const brand of brandRules) {
    if (brand.name === "Phenyx Pro") continue;
    const mentions = snippets.filter(({text}) => matchingText(text, brand));
    if (!mentions.length) continue;
    const claims = mentions.flatMap(evidence => {
      const event = explicitEvent(evidence.text, brand);
      return event ? [{ ...event, brand, evidence }] : [];
    });
    if (!podcast && claims.length && httpsUrl(item.url) && !ordinaryContext.test(context) && !uncertainContext.test(context)) {
      events.push(...claims);
      continue;
    }
    const uncertain = mentions.find(({text}) => ambiguous.test(text) && !ordinaryContext.test(text));
    const evidence = claims[0]?.evidence || uncertain || mentions[0];
    if (claims.length || uncertain) {
      annotations.push({ kind: "needs_review", brand, evidence });
    } else if (podcast) {
      annotations.push({ kind: "brand_mention", brand, evidence });
    }
  }
  if (podcast && !annotations.some(note => note.kind === "needs_review")) {
    const evidence = snippets.find(({text,field}) =>
      field === "title" && unattributedClaim.test(text) && !ordinaryContext.test(text) &&
        !brandRules.some(brand => matchingText(text, brand)));
    if (evidence) annotations.push({ kind: "needs_review", brand: null, evidence });
  }
  return { events, annotations };
}

export function eventStatement(db, row, pendingReviewId = null) {
  const { articleId, item, src, category, region, publishedAt, brand, subject, type, evidence, evidenceUrl } = row;
  const key = "verified:" + JSON.stringify([item.url, type, brand.name, subject.toLowerCase()]);
  const eligible = pendingReviewId
    ? " WHERE EXISTS (SELECT 1 FROM intelligence_review_queue WHERE id=? AND review_status='pending')"
    : "";
  const args = [crypto.randomUUID(),articleId,brand.name,brand.tier,type,category || null,region,
    src.name,src.sourceType || "media",item.url,publishedAt,row.now,
    evidence.field === "manual" ? "Reviewed" : "High",evidence.text,key,row.now,evidence.field,subject,evidenceUrl];
  if (pendingReviewId) args.push(pendingReviewId);
  const stmt = db.prepare(`INSERT INTO competitor_events (
    id,article_id,brand_name,competitor_tier,event_type,product_category,market_region,source_name,
    source_type,source_url,published_at,observed_at,confidence,evidence_text,dedupe_key,created_at,
    evidence_field,event_subject,evidence_url
  ) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?` + eligible + " ON CONFLICT(dedupe_key) DO NOTHING").bind(...args);
  return { stmt, key };
}

export async function recordIntelligence(env, articleId, item, src, publishedAt, region, brandRules, productFamily) {
  const podcast = src.feedContentMode === "podcast_metadata";
  const result = classifyIntelligence(item, brandRules, podcast);
  const now = new Date().toISOString();
  const eventStatements = result.events.map(event => eventStatement(env.DB, {
    ...event, articleId, item, src, region, publishedAt, now, evidenceUrl: item.url,
    category: productFamily(event.evidence.text.toLowerCase())
  }).stmt);
  const noteStatements = result.annotations.map(({kind,brand,evidence}) => env.DB.prepare(`
    INSERT INTO intelligence_notes (id,article_id,kind,brand_name,evidence_text,evidence_field)
    SELECT ?,?,?,?,?,? WHERE NOT EXISTS (
      SELECT 1 FROM intelligence_entries WHERE article_id=? AND brand_name=? AND legacy_event_id IS NOT NULL
        AND (kind=? OR ?='brand_mention')
    ) ON CONFLICT(article_id,kind,brand_name) DO NOTHING`)
    .bind(crypto.randomUUID(),articleId,kind,brand?.name || "",evidence.text.slice(0,500),evidence.field,
      articleId,brand?.name || "",kind,kind));
  const markPodcast = podcast ? [env.DB.prepare(
    "UPDATE articles SET podcast_metadata=1 WHERE id=? AND podcast_metadata=0"
  ).bind(articleId)] : [];
  const statements = [...eventStatements, ...noteStatements, ...markPodcast];
  if (!statements.length) return 0;
  const writes = await env.DB.batch(statements);
  return writes.slice(0, eventStatements.length).reduce((count, write) => count + (write.meta?.changes || 0), 0);
}
