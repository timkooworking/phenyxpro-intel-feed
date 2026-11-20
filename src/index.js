const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type",
  "Access-Control-Max-Age": "86400"
};

const DEFAULT_LIMIT = 100;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS, ...extraHeaders }
  });
}

function isAuthorized(request, env) {
  // Configure FEED_TOKEN before exposing the Worker.
  if (!env.FEED_TOKEN) return false;
  return request.headers.get("Authorization") === `Bearer ${env.FEED_TOKEN}`;
}

function decodeEntities(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function cleanText(value = "") {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ").trim();
}

function tagValue(block, tagNames) {
  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
    const match = block.match(re);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function itemLink(block) {
  const atom = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
  if (atom) return decodeEntities(atom[1].trim());
  const rss = block.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);
  if (rss) return cleanText(rss[1]);
  const guid = block.match(/<guid(?:\s[^>]*)?>([\s\S]*?)<\/guid>/i);
  return guid ? cleanText(guid[1]) : "";
}

function parseFeed(xml) {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) || [];
  return blocks.map(block => ({
    title: tagValue(block, ["title"]),
    url: itemLink(block),
    publishedAt: tagValue(block, ["pubDate", "published", "updated", "dc:date"]),
    description: tagValue(block, ["description", "summary", "content:encoded", "content"])
  })).filter(item => item.title && item.url);
}

const BRAND_PATTERNS = [
  "Phenyx Pro", "Shure", "Sennheiser", "Audio-Technica", "Rode", "RØDE",
  "Xvive", "Hollyland", "Behringer", "Allen & Heath", "Maono", "TONOR",
  "FIFINE", "BOYA", "Comica", "SYNCO", "Saramonic", "Elgato", "HyperX",
  "Logitech", "Blue", "Yamaha", "Soundcraft", "Mackie", "AKG", "DPA",
  "Electro-Voice", "JBL", "QSC", "Yorkville", "HK Audio"
];

function classify(text, defaultCategory) {
  const t = text.toLowerCase();
  const isPhenyx = t.includes("phenyx pro") || /\b(ptu|ptm|pti|pdp)-?\d/i.test(text);
  let category = defaultCategory || "Brand & Product";
  if (/worship|church|house of worship|church tech|worship leader/.test(t)) category = "Worship Audio";
  else if (/creator|podcast|streamer|streaming|usb microphone|content creation/.test(t)) category = "Creator Audio";
  else if (/sweetwater|guitar world|musicradar|performer magazine|gearspace|the gear page|gearnews|retailer|review|buying guide/.test(t)) category = "Media & Retail";
  if (isPhenyx) category = "Phenyx Pro Mentions";
  const brand = BRAND_PATTERNS.find(name => t.includes(name.toLowerCase())) || "";
  const priority = isPhenyx || /launch|announces|introduces|new product|recall|discontinued/.test(t) ? "High" : "Medium";
  const contentType = /review|tested|hands-on/.test(t) ? "Review" :
    /launch|announces|introduces/.test(t) ? "Product news" :
    /campaign|ambassador|sponsor/.test(t) ? "Campaign" :
    /sales|revenue|market share/.test(t) ? "Business data" : "Article";
  return { category, brand, priority, contentType, isPhenyx };
}

async function analyzeItem(item, env) {
  const rawSummary = cleanText(item.description || item.title).slice(0, 1200);
  if (!env.AI_API_URL || !env.AI_API_KEY || !env.AI_MODEL) {
    return {
      summary: rawSummary || item.title,
      analysis: "尚未配置 AI 分析服务。当前仅保存来源摘要；请勿将此条目视为已完成市场推断。",
      confidence: "Unreviewed"
    };
  }

  const prompt = `你是专业音频市场研究分析师。只根据以下标题和摘要工作，不得补造规格、销量或事实。请用中文返回严格 JSON，字段为 summary（中文简述）、analysis（区分事实与假设，分析产品变化→功能变化→用户需求变化）、confidence（High/Medium/Low）、sentiment（Positive/Neutral/Negative/Unknown）。如果证据不足要明确写证据不足。标题：${item.title}\n来源摘要：${rawSummary}\n来源：${item.url}`;
  try {
    const response = await fetch(env.AI_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.AI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env.AI_MODEL,
        temperature: 0.2,
        messages: [
          { role: "system", content: "只输出有效 JSON，不要 Markdown 代码围栏。" },
          { role: "user", content: prompt }
        ]
      })
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    return {
      summary: String(parsed.summary || rawSummary).slice(0, 1600),
      analysis: String(parsed.analysis || "证据不足，暂不形成趋势判断。").slice(0, 3000),
      confidence: ["High", "Medium", "Low"].includes(parsed.confidence) ? parsed.confidence : "Low",
      sentiment: ["Positive", "Neutral", "Negative", "Unknown"].includes(parsed.sentiment) ? parsed.sentiment : "Unknown"
    };
  } catch (error) {
    return {
      summary: rawSummary || item.title,
      analysis: `AI 分析暂不可用：${String(error).slice(0, 180)}。保留原始信息，待人工复核。`,
      confidence: "Unreviewed",
      sentiment: "Unknown"
    };
  }
}

function parseSources(env) {
  return (env.RSS_FEEDS || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [name, url, category] = line.split("|").map(v => (v || "").trim());
      return { name: name || "RSS source", url, category: category || "Brand & Product" };
    })
    .filter(source => source.url && /^https:\/\//i.test(source.url));
}

async function collectSource(source, env) {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO source_runs (id,source_name,started_at,status) VALUES (?,?,?,?)"
  ).bind(runId, source.name, startedAt, "running").run();

  let seen = 0, added = 0;
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "PhenyxProMarketIntelligence/1.0 (configured RSS feed reader)" }
    });
    if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
    const xml = await response.text();
    const items = parseFeed(xml).slice(0, 40);
    seen = items.length;

    for (const item of items) {
      const meta = classify(`${item.title} ${item.description}`, source.category);
      const analysis = await analyzeItem(item, env);
      const publishedAt = item.publishedAt ? new Date(item.publishedAt).toISOString() : startedAt;
      const result = await env.DB.prepare(`
        INSERT OR IGNORE INTO articles
        (id,canonical_url,title,source_name,published_at,collected_at,category,priority,brand,summary,analysis,confidence,content_type,sentiment,is_phenyx_mention)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        crypto.randomUUID(), item.url, item.title, source.name, publishedAt, startedAt,
        meta.category, meta.priority, meta.brand, analysis.summary, analysis.analysis,
        analysis.confidence, meta.contentType, analysis.sentiment || "Unknown", meta.isPhenyx ? 1 : 0
      ).run();
      if (result.meta?.changes) added += result.meta.changes;
    }

    await env.DB.prepare(
      "UPDATE source_runs SET finished_at=?,status=?,items_seen=?,items_added=? WHERE id=?"
    ).bind(new Date().toISOString(), "success", seen, added, runId).run();
  } catch (error) {
    await env.DB.prepare(
      "UPDATE source_runs SET finished_at=?,status=?,items_seen=?,items_added=?,error_message=? WHERE id=?"
    ).bind(new Date().toISOString(), "error", seen, added, String(error).slice(0, 500), runId).run();
  }
  return { source: source.name, seen, added };
}

async function runDailyCollection(env) {
  if (!env.DB) throw new Error("D1 binding DB is not configured");
  const sources = parseSources(env);
  const results = [];
  for (const source of sources) results.push(await collectSource(source, env));
  return { ranAt: new Date().toISOString(), configuredSources: sources.length, results };
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });

  if (url.pathname === "/health") {
    return json({ ok: true, service: "phenyxpro-intel-feed", time: new Date().toISOString() });
  }

  if (url.pathname === "/api/briefing.json" && request.method === "GET") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized. Configure and provide FEED_TOKEN." }, 401);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || DEFAULT_LIMIT), 1), 300);
    const result = await env.DB.prepare(`
      SELECT id, title, source_name, published_at, category, priority, brand, summary, analysis,
             confidence, content_type, sentiment, is_phenyx_mention, canonical_url
      FROM articles ORDER BY published_at DESC LIMIT ?
    `).bind(limit).all();
    const items = (result.results || []).map(row => ({
      date: row.published_at ? row.published_at.slice(0, 10) : "",
      category: row.category,
      priority: row.priority,
      title: row.title,
      brand: row.brand || row.source_name || "",
      summary: row.summary || "",
      analysis: row.analysis || "",
      source: row.canonical_url,
      confidence: row.confidence || "Unreviewed",
      contentType: row.content_type,
      sentiment: row.sentiment,
      isPhenyxMention: Boolean(row.is_phenyx_mention)
    }));
    return json({ generatedAt: new Date().toISOString(), mode: "LIVE", items });
  }

  if (url.pathname === "/api/admin/run-collection" && request.method === "POST") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const result = await runDailyCollection(env);
    return json(result);
  }

  if (url.pathname === "/api/admin/source-runs" && request.method === "GET") {
    if (!isAuthorized(request, env)) return json({ error: "Unauthorized" }, 401);
    const result = await env.DB.prepare(
      "SELECT * FROM source_runs ORDER BY started_at DESC LIMIT 100"
    ).all();
    return json({ runs: result.results || [] });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env).catch(error =>
      json({ error: "Internal server error", detail: String(error).slice(0, 300) }, 500)
    );
  },
  scheduled(_event, env, ctx) {
    ctx.waitUntil(runDailyCollection(env));
  }
};
