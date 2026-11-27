import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import worker, { __test } from "../src/index.js";
import { classifyIntelligence } from "../src/intelligence.js";

const db = new DatabaseSync(":memory:");
const migrations = new URL("../migrations/", import.meta.url);
const names = readdirSync(migrations).filter(name => name.endsWith(".sql")).sort();
function migration(d, number) {
  d.exec(readFileSync(new URL(names.find(name => name.startsWith(number)), migrations), "utf8"));
}
const repairBranch = new DatabaseSync(":memory:");
migration(repairBranch, "0001");
migration(repairBranch, "0003");
for (const name of names.slice(3)) migration(repairBranch, name.slice(0, 4));
assert.equal(repairBranch.prepare("SELECT COUNT(*) AS n FROM brand_watchlist WHERE status='active'").get().n, 41);
repairBranch.close();
migration(db, "0001");
migration(db, "0002");
assert.throws(() => migration(db, "0003"), /duplicate column name: relevance_score/);
for (const name of names.slice(3, -1)) migration(db, name.slice(0, 4));

const church = "Church Sound Podcast", signal = "Signal To Noise (Pro Sound Web Podcast)";
const reviewed = [
  ["62d8d3f2-e2e4-45a6-8dd4-58f4987f2a23","337. Sound Designer Luke Swaffield On Immersive Audio & More","Allen & Heath","20157304-337-sound-designer-luke-swaffield-on-immersive-audio-and-more","interview"],
  ["eae0ca62-8b84-4744-83e6-2851bbc62153","334. Veteran Mix Engineer Russ Long","Yamaha Pro Audio","19896803-334-veteran-mix-engineer-russ-long","interview"],
  ["d546741f-f799-42f3-942f-9628d1e68b80","333. The State Of AI In Audio With Joe Allan Muharsky (Remastered)","Allen & Heath","19853937-333-the-state-of-ai-in-audio-with-joe-allan-muharsky-remastered","technical_discussion"],
  ["3d92d61a-080b-47ca-8311-7ed6d36e10d2","329. Veteran Audio Professional Michael Curtis","Allen & Heath","19453142-329-veteran-audio-professional-michael-curtis","interview"],
  ["e669cde2-5ce6-4a09-b55d-a71813f2c558","324. Matt Dale & Donny Kuser Of SoundBase","Allen & Heath","19033615-324-matt-dale-and-donny-kuser-of-soundbase","needs_review"],
  ["dd371d22-da1d-452a-8e99-0e4006b7eeab","323. The State Of AI In Audio With Joe Allan Muharsky","Allen & Heath","19016849-323-the-state-of-ai-in-audio-with-joe-allan-muharsky","technical_discussion"]
];
const now = "2026-11-27T01:00:00.000Z";
const insertArticle = db.prepare(`INSERT INTO articles (
  id,canonical_url,title,source_name,published_at,collected_at,relevance_score,summary,content_type
) VALUES (?,?,?,?,?,?,?,?,?)`);
const insertEvent = db.prepare(`INSERT INTO competitor_events (
  id,article_id,brand_name,event_type,product_category,source_name,source_type,source_url,published_at,
  observed_at,evidence_text,dedupe_key,created_at
) VALUES (?,?,?,?,?,?,'media',?,?,?,?,?,?)`);
function seed(id, title, source, url, score, event, brand, eventId = id, category = null) {
  insertArticle.run(id,url,title,source,now,now,score,brand ? "Mention: " + brand : "Original English summary",event);
  if (event) insertEvent.run(eventId,id,brand,event,category,source,url,now,now,title,eventId,now);
}
for (let i = 0; i < 99; i++) {
  seed("news-" + i,"Article " + i,"Gearnews","https://news.example.test/" + i,i%65,
    i < 7 ? "NEW_PRODUCT" : null,"Shure");
}
for (let i = 0; i < 34; i++) {
  const slug = "https://podcast.example.test/" + i;
  seed("pod-" + i,"Episode " + i,i < 20 ? church : signal,slug,i,
    i < 29 ? "BRAND_MENTION" : null,"Shure");
}
for (const [id,title,brand,slug,kind] of reviewed) {
  const upgrade = kind === "needs_review";
  seed("article-" + id,title,signal,"https://www.buzzsprout.com/748181/episodes/" + slug,58,
    upgrade ? "PRODUCT_UPGRADE" : "INDUSTRY_NEWS",brand,id,upgrade ? "Wireless Microphone System" : null);
}

const originalArticles = db.prepare("SELECT * FROM articles ORDER BY id").all();
const originalEvents = db.prepare("SELECT * FROM competitor_events ORDER BY id").all();
migration(db, "0009");
assert.deepEqual(db.prepare("SELECT * FROM articles ORDER BY id").all().map(({podcast_metadata,...row})=>row), originalArticles.map(row=>({...row})));
assert.deepEqual(db.prepare("SELECT * FROM competitor_events ORDER BY id").all()
  .map(({evidence_field,event_subject,evidence_url,...row})=>row), originalEvents.map(row=>({...row})));
for (const [id,title,brand,slug,kind] of reviewed) {
  const row = db.prepare("SELECT * FROM intelligence_entries WHERE legacy_event_id=?").get(id);
  assert.equal(row.title, title);
  assert.equal(row.brand_name, brand);
  assert.ok(row.source_url.endsWith(slug));
  assert.equal(row.discussion_type || row.kind, kind);
}

const brand = { name: "Shure", aliases: ["shure"], tier: "direct" };
const brandRules = [brand,{name:"Allen & Heath",aliases:["allen & heath"],tier:"adjacent"}];
function classify(title, description = "", podcast = false, url = "https://example.test/item") {
  return classifyIntelligence({title,description,url},brandRules,podcast);
}
for (const [title,type,subject] of [
  ["Shure Launches AX90 wireless microphone","NEW_PRODUCT","AX90"],
  ["Shure releases firmware v2.1 for AX90, adding dual-channel scanning","PRODUCT_UPGRADE","AX90"],
  ["Shure cuts AX90 price from USD 300 to USD 250","PRICE_CHANGE","AX90"],
  ["Shure appoints Sound Group as exclusive distributor in Brazil","CHANNEL_CHANGE","Sound Group"],
  ["Shure signs a partnership with Sound Group to develop wireless receivers","PARTNERSHIP","Sound Group"],
  ["Shure expands into Mexico through a new retail network","MARKET_EXPANSION","Mexico"],
  ["Shure enters the audio interfaces market with AX90","CATEGORY_ENTRY","AX90"]
]) {
  const [event] = classify(title).events;
  assert.equal(event?.type,type,title);
  assert.equal(event?.subject,subject,title);
  assert.equal(event?.evidence.text,title);
}
for (const [title, description] of [
  ["Shure debuts at the show", ""],
  ["How to upgrade Shure AX90 wireless microphone systems", ""],
  ["A tour crew debuts its new show with Shure AX90 wireless microphones", ""],
  ["Shure launches an upgrade", ""],
  ["Shure launches a new wireless microphone", ""],
  ["Shure releases firmware v2.1 for AX90", ""],
  ["Shure may launch AX90 wireless microphone", ""],
  ["Shure launches AX90 wireless microphone?", ""],
  ["Shure cuts AX90 price from USD 300 to USD 300", ""],
  ["Shure cuts AX90 price from USD 300 to EUR 250", ""],
  ["Shure launches AX90 wireless microphone", "This is a rumor."],
  ["Shure releases something.", "AX90 is a wireless microphone."],
  ["AX90 product news", "Allen & Heath discusses upgrades. Shure is a sponsor."]
]) assert.equal(classify(title,description).events.length,0,title);
assert.equal(classify("Shure may launch AX90 wireless microphone").annotations[0].kind,"needs_review");
assert.equal(classify("Firmware update for a new wireless system","",true).annotations[0].kind,"needs_review");
assert.equal(classify("Shure Launches AX90 wireless microphone","",false,"http://example.test/item").events.length,0);
assert.equal(classify("Product bulletin", "Shure launches AX90 wireless microphone. More information follows.").events[0].evidence.field,"rss_summary");
assert.deepEqual(classify("How to upgrade monitoring","Using Shure with Allen & Heath in a tutorial.",true).annotations
  .map(x=>[x.kind,x.brand.name]),[["brand_mention","Shure"],["brand_mention","Allen & Heath"]]);
for (const [,title,reviewedBrand] of reviewed) {
  assert.equal(classify(title, "This interview mentions " + reviewedBrand,true).events.length,0,title);
}

const adapter = {
  prepare(sql) {
    return this.statement(sql, []);
  },
  statement(sql, args) {
    return {
      bind: (...values) => this.statement(sql,values),
      async first() { return db.prepare(sql).get(...args) ?? null; },
      async all() { return { results: db.prepare(sql).all(...args) }; },
      run() { return { meta: db.prepare(sql).run(...args) }; }
    };
  },
  async batch(statements) {
    db.exec("BEGIN");
    try {
      const results = statements.map(stmt=>stmt.run());
      db.exec("COMMIT");
      return results;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
};
const env = { DB: adapter, FEED_TOKEN: "fixture-token" };
async function request(path, expected = 200, body = null, authenticated = true) {
  const response = await worker.fetch(new Request("https://worker.test" + path, {
    method: body ? "POST" : "GET",
    headers: authenticated ? {Authorization:"Bearer fixture-token","Content-Type":"application/json"} : {},
    body: body && JSON.stringify(body)
  }),env);
  const json = await response.json();
  assert.equal(response.status,expected,JSON.stringify(json));
  return json;
}
const api = "/api/admin/v3/";
const summary = await request(api + "summary");
assert.equal(summary.activeBrands,41);
assert.deepEqual({...summary.intelligence},{
  podcastEpisodes:40,brandMentions:29,industryDiscussions:5,pendingReviews:1,
  actionableEvents:0,legacyNonPodcastEvents:7,reclassifiedPodcastRecords:35
});
assert.equal((await request(api + "podcast-episodes?source=" + encodeURIComponent(church))).episodes.length,20);
const podcastEpisodes = (await request(api + "podcast-episodes?sort=score")).episodes;
assert.equal(podcastEpisodes.length,40);
const interviewEpisode = podcastEpisodes.find(row=>row.title.startsWith("337."));
assert.equal(interviewEpisode.podcast_quality,"interview_or_discussion");
assert.ok(interviewEpisode.relevance_score<=20);
assert.ok(interviewEpisode.original_relevance_score>=interviewEpisode.relevance_score);
const tutorialEpisode = podcastEpisodes.find(row=>row.title.includes("Quickly Troubleshooting"));
if (tutorialEpisode) assert.ok(tutorialEpisode.relevance_score<=25);
const reviewEpisode = podcastEpisodes.find(row=>row.title.startsWith("324."));
assert.equal(reviewEpisode.podcast_quality,"needs_review");
assert.ok(reviewEpisode.relevance_score<=35);
assert.equal((await request(api + "brand-mentions?brand=Shure&limit=10&offset=20")).mentions.length,9);
assert.equal((await request(api + "industry-discussions")).discussions.length,5);
assert.equal((await request(api + "events")).events.length,0);
assert.equal((await request(api + "events?scope=legacy")).events.length,7);
assert.equal((await request(api + "events?scope=all")).events.length,42);
for (const route of ["podcast-episodes","brand-mentions","industry-discussions","review-queue","events"]) {
  await request(api + route,401,null,false);
}
await request(api + "review-queue/resolve",401,{id:"unknown"},false);
const briefing = await request("/api/briefing.json");
assert.equal(briefing.totalArticles,99);
assert.equal(briefing.totalAllArticles,139);
assert.equal(briefing.totalPodcastEpisodes,40);
assert.equal(briefing.podcastsIncluded,false);
assert.equal(briefing.minRelevanceScore,35);
assert.ok(briefing.items.every((item,i,items)=>item.relevanceScore>=35 &&
  item.contentKind !== "podcast_episode" &&
  (!i || items[i-1].relevanceScore >= item.relevanceScore)));
assert.ok(!briefing.items.some(x=>x.title.startsWith("324.")));
const unfiltered = await request("/api/briefing.json?min_score=0&sort=date");
assert.equal(unfiltered.totalMatching,99);
const allContent = await request("/api/briefing.json?include_podcasts=1");
assert.equal(allContent.totalArticles,139);
assert.equal(allContent.totalMatching,36);
assert.equal(allContent.podcastsIncluded,true);
assert.equal(allContent.items.find(x=>x.title.startsWith("324.")).contentType,"Podcast Episode");
const oldQueue = (await request(api + "review-queue")).reviews[0];
assert.equal(oldQueue.original_event_type,"PRODUCT_UPGRADE");
assert.match(oldQueue.source_url,/19033615/);
await request(api + "review-queue/resolve",400,{
  id:oldQueue.id,decision:"approved",reason:"Insufficient",brandName:"Allen & Heath",
  evidenceUrl:"https://evidence.test/324",evidenceText:"They talk about an upgrade"
});

const realFetch = globalThis.fetch;
globalThis.fetch = async input => {
  const podcast = String(input).includes("podcast");
  const items = podcast ? [
    ["How to troubleshoot a Shure wireless system","Basic tutorial: tips for setup and troubleshooting. Allen &amp; Heath mixers are mentioned."],
    ["Product bulletin","Shure launches AX90 wireless microphone."],
    ["Show archive","No known mentions."]
  ] : [["Shure Launches AX90 wireless microphone","Product announcement."]];
  const prefix = podcast ? "podcast" : "media";
  return new Response("<rss><channel>" + items.map(([title,summary],i)=>
    "<item><title>"+title+"</title><link>https://feed.example.test/"+prefix+"/"+i+"</link>"+
    "<pubDate>Fri, 27 Nov 2026 01:00:00 GMT</pubDate><description>"+summary+"</description></item>"
  ).join("") + "</channel></rss>",{headers:{"Content-Type":"application/rss+xml"}});
};
const podcast = {name:signal,url:"https://feed.example.test/podcast",feedContentMode:"podcast_metadata",maxItems:20};
const media = {name:"Gearnews",url:"https://feed.example.test/media",feedContentMode:"article"};
try {
  const run = await __test.collect(podcast,env,brandRules);
  assert.equal(run.added,3);
  assert.equal(run.competitorEvents,0);
  assert.equal((await __test.collect(podcast,env,brandRules)).added,0);
  assert.equal((await __test.collect(media,env,brandRules)).competitorEvents,1);
  assert.equal((await __test.collect(media,env,brandRules)).competitorEvents,0);
} finally {
  globalThis.fetch = realFetch;
}
const postCollectEpisodes = (await request(api+"podcast-episodes")).episodes;
assert.equal(postCollectEpisodes.length,43);
const basicTutorial = postCollectEpisodes.find(row=>row.title.startsWith("How to troubleshoot"));
assert.equal(basicTutorial.podcast_quality,"basic_education");
assert.ok(basicTutorial.relevance_score<=25);
assert.ok(basicTutorial.original_relevance_score>=basicTutorial.relevance_score);
assert.equal((await request(api+"brand-mentions")).mentions.length,31);
const events = (await request(api+"events")).events;
assert.equal(events.length,1);
assert.equal(events[0].event_subject,"AX90");
assert.equal(events[0].evidence_field,"title");
assert.equal(events[0].source_title,"Shure Launches AX90 wireless microphone");
const pending = (await request(api+"review-queue")).reviews;
assert.equal(pending.length,2);
const newQueue = pending.find(row=>row.id!==oldQueue.id);
assert.equal(newQueue.evidence_field,"rss_summary");
const approve = {id:newQueue.id,decision:"approved",reason:"Checked direct announcement",
  brandName:"Shure",evidenceUrl:"https://press.example.test/ax90",evidenceText:"Shure launches AX90 wireless microphone."};
await request(api+"review-queue/resolve",200,approve);
await request(api+"review-queue/resolve",409,approve);
await request(api+"review-queue/resolve",200,{id:oldQueue.id,decision:"dismissed",reason:"Interview; no product upgrade evidence."});
assert.equal((await request(api+"review-queue")).reviews.length,0);
const audit = (await request(api+"review-queue?status=approved")).reviews[0];
const approved = (await request(api+"events")).events.find(event=>event.id===audit.event_id);
assert.equal(approved.evidence_url,approve.evidenceUrl);
assert.equal(approved.evidence_field,"manual");
assert.equal(approved.source_url,newQueue.source_url);
assert.equal((await request(api+"review-queue?status=dismissed")).reviews[0].legacy_event_id,oldQueue.legacy_event_id);
const backfill = await request(api+"backfill-events?limit=200",200,{});
assert.equal(backfill.eventsAdded,0);
assert.equal((await request(api+"events?scope=all")).events.length,44);
db.close();
console.log("V3.0.5 SQLite migration, six reviewed episodes, evidence rules, ingestion, auth and review workflow passed.");
