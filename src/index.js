import { hasPhrase, recordIntelligence } from "./intelligence.js";
import { intelligenceAdmin, intelligenceCounts } from "./intelligence-admin.js";

const VERSION = "3.0.6";
const PODCAST_EXISTS = 'EXISTS (SELECT 1 FROM podcast_episodes p WHERE p.article_id=articles.id)';
const MARKET_NEWS_MIN_SCORE = 35;
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type"};
const j=(d,s=200)=>new Response(JSON.stringify(d,null,2),{status:s,headers:{"Content-Type":"application/json; charset=utf-8",...CORS}});
const auth=(r,e)=>!!e.FEED_TOKEN&&r.headers.get("Authorization")===`Bearer ${e.FEED_TOKEN}`;
const dec=s=>(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
const clean=s=>dec((s||"").replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim();
function tag(b,n){for(const t of n){const m=b.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${t}>`,"i"));if(m)return clean(m[1]);}return"";}
function link(b){let m=b.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);if(m)return dec(m[1]);m=b.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);if(m)return clean(m[1]);m=b.match(/<guid(?:\s[^>]*)?>([\s\S]*?)<\/guid>/i);const guid=m?clean(m[1]):"";return /^https:\/\//i.test(guid)?guid:"";}
// Podcast RSS (notably Buzzsprout) may omit the per-item <link> tag and use
// <guid isPermaLink="false">Buzzsprout-12345</guid> as its stable episode ID.
// For the two explicitly registered Buzzsprout podcast sources, build a
// human-facing episode page URL (never the enclosure/audio URL). RSS GUID is
// never treated as a web link unless it is itself an HTTPS permalink.
function buzzsproutEpisodePage(itemXml, feedUrl, title){
  const show=String(feedUrl||"").match(/^https:\/\/(?:rss|feeds)\.buzzsprout\.com\/(\d+)\.rss(?:[?#]|$)/i);
  const guid=tag(itemXml,["guid"]);
  const episode=guid.match(/^Buzzsprout-(\d+)$/i);
  if(!show||!episode)return "";
  const slug=String(title||"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-")
    .replace(/^-|-$/g,"").slice(0,120).replace(/-$/g,"");
  return `https://www.buzzsprout.com/${show[1]}/episodes/${episode[1]}${slug?"-"+slug:""}`;
}
function parse(xml,options={}){
  const metadataOnly=options.feedContentMode==="editorial_metadata";
  const items=(xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi)||[]).map(b=>{
    const title=tag(b,["title","itunes:title"]);
    const url=link(b)||(options.feedContentMode==="podcast_metadata"?buzzsproutEpisodePage(b,options.feedUrl,title):"");
    return{title,url,date:tag(b,["pubDate","published","updated","dc:date"]),description:metadataOnly?"":tag(b,["description","summary","content:encoded","content","itunes:summary","itunes:subtitle"])};
  }).filter(x=>x.title&&x.url);
  if(!metadataOnly)return items;
  const origin=new URL(options.feedUrl).origin;
  return items.filter(item=>{
    const articleUrl=URL.canParse(item.url)?new URL(item.url):null;
    if(articleUrl?.origin!==origin||articleUrl.username||articleUrl.password||!Number.isFinite(Date.parse(item.date)))return false;
    // The two existing podcast feeds already cover these episode announcements.
    return options.sourceId!=="src-prosoundweb"||
      !/^(?:signal to noise|church sound podcast)[,:\s–—-]+(?:podcast[,:\s–—-]+)?(?:episode\b|ep\.?\s*\d|#\d)/i.test(item.title);
  });
}
const BRANDS=[
["Phenyx Pro",["phenyx pro"]],["Shure",["shure"]],["Sennheiser",["sennheiser"]],["Audio-Technica",["audio-technica","audio technica"]],["RØDE",["røde","rode microphones","rode wireless"]],["Xvive",["xvive"]],["Hollyland",["hollyland"]],["Behringer",["behringer"]],["Allen & Heath",["allen & heath","allen and heath"]],["Maono",["maono"]],["TONOR",["tonor"]],["FIFINE",["fifine"]],["BOYA",["boya"]],["Comica",["comica"]],["SYNCO",["synco"]],["Saramonic",["saramonic"]],["Elgato",["elgato"]],["HyperX",["hyperx"]],["Yamaha",["yamaha"]],["Soundcraft",["soundcraft"]],["Mackie",["mackie"]],["AKG",["akg"]],["DPA",["dpa microphones","dpa microphone"]],["Electro-Voice",["electro-voice","electro voice"]],["JBL",["jbl professional","jbl pro audio"]],["QSC",["qsc"]],["Yorkville",["yorkville"]],["HK Audio",["hk audio"]],["Riedel",["riedel"]],["BishopSound",["bishopsound"]],["HEDD",["heddphone","hedd audio"]],["Focusrite",["focusrite"]],["Universal Audio",["universal audio"]],["PreSonus",["presonus"]],["Tascam",["tascam"]],["Crestron",["crestron"]]
];
const PRO=[["wireless microphone",38],["wireless microphone system",42],["wireless mic",35],["wireless system",18],["wireless in-ear",42],["wireless iem",42],["in-ear monitor",42],["in ear monitor",42],["iem system",42],["iem",34],["immersive monitoring",42],["in-ear mix",38],["rf coordination",42],["antenna distribution",40],["antenna combiner",35],["rf spectrum",32],["bodypack",25],["transmitter",12],["receiver",12],["live sound",32],["touring engineer",30],["foh",22],["stage monitor",30],["monitor mix",30],["pa system",32],["powered speaker",30],["line array",32],["subwoofer",30],["digital console",30],["digital mixer",30],["mixing console",30],["analog mixer",25],["audio mixer",28],["sound reinforcement",32],["loudspeaker",24],["headset microphone",28],["wireless instrument",30],["guitar wireless",28],["instrument wireless",28],["broadcast audio",25],["intercom system",25],["recording studio",22],["studio microphone",28],["headphone",24],["headphones",24],["heddphone",30],["audio interface",25],["microphone",16],["microphones",16]];
const WOR=[["house of worship",48],["worship leader",48],["worship team",44],["church audio",48],["church sound",44],["church production",44],["worship audio",48],["worship",34],["church",20],["volunteer audio",36],["church livestream",40]];
const CRE=[["content creator",40],["creator audio",42],["creator microphone",38],["wireless creator microphone",40],["podcast microphone",38],["podcasting",32],["podcast",28],["usb microphone",34],["streaming microphone",36],["gaming microphone",34],["gaming headset",28],["streamer",28],["livestream audio",34],["live streaming",24],["content creation",28],["mobile recording",28],["camera microphone",28],["vlogging",24],["home studio",22],["voiceover",24],["vocal processing",22]];
const NEG=["medical display","healthcare technology","clinical computing","digital signage","signage showroom","attractions industry","theme park","diagnostic monitor","medical monitor"];
function score(t,r){let n=0,m=[];for(const [w,v] of r)if(t.includes(w)){n+=v;m.push(w);}return{n:Math.min(n,90),m};}
function family(t){const rules=[["Wireless Microphone System",["wireless microphone","wireless mic","wireless system","bodypack transmitter"]],["In-Ear Monitoring",["in-ear monitor","in ear monitor","iem system","iem"]],["RF & Antenna",["rf coordination","antenna distribution","antenna combiner","rf antenna"]],["PA & Loudspeaker",["pa system","powered speaker","loudspeaker","line array"]],["Subwoofer",["subwoofer"]],["Mixer",["digital mixer","analog mixer","audio mixer","mixing console"]],["Creator Microphone",["podcast microphone","usb microphone","creator microphone","streaming microphone"]],["Headphones & Monitoring",["headphone","headphones","heddphone","studio monitor"]],["Wireless Instrument System",["guitar wireless","instrument wireless","wireless guitar"]],["Audio Interface",["audio interface","usb interface"]],["Recording & Production",["recording studio","vocal processing","audio plugin","audio plug-in"]],["Broadcast & Intercom",["broadcast audio","intercom system","production center"]]];for(const [f,terms] of rules)if(terms.some(x=>t.includes(x)))return f;return"";}
function contentType(t){if(/review|tested|hands-on|hands on|first impressions/.test(t))return"Review";if(/buying guide|best .* microphone|best .* wireless|best .* iem|roundup/.test(t))return"Buying Guide";if(/tutorial|how to|guide to|tips for|explained/.test(t))return"Tutorial";if(/campaign|ambassador|brand partner|giveaway/.test(t))return"Campaign";if(/sales|revenue|market share|quarterly results/.test(t))return"Business Data";if(/case study|installation|installed|relies on .* technology|powered by/.test(t))return"Case Study";if(/firmware update|software update|new feature|upgrade/.test(t))return"Product Upgrade";if(/launch|announces|announced|introduces|introduced|unveils|unveiled|debuts|debut/.test(t))return"New Product";if(/conference|expo|trade show|event|awards|nominations/.test(t))return"Industry News";return"Article";}
function normalizeBrandRules(rows){
  const rules=(rows||[]).map(x=>({name:x.brand_name||x.name,aliases:Array.isArray(x.aliases)?x.aliases:(()=>{try{return JSON.parse(x.aliases_json||"[]")}catch{return[]}})(),tier:x.competitor_tier||x.tier||"candidate",priority:Number(x.priority)||50})).filter(x=>x.name&&x.aliases.length);
  return rules.length?rules:BRANDS.map(([name,aliases])=>({name,aliases,tier:"unclassified",priority:50}));
}
async function loadBrandRules(env){
  const r=await env.DB.prepare("SELECT brand_name,aliases_json,competitor_tier,priority FROM brand_watchlist WHERE status='active' ORDER BY priority DESC").all();
  return normalizeBrandRules(r.results||[]);
}
function findBrand(text,rules){
  const sorted=[...(rules||[])].sort((a,b)=>Math.max(...b.aliases.map(x=>x.length),0)-Math.max(...a.aliases.map(x=>x.length),0));
  for(const rule of sorted){for(const alias of rule.aliases){if(hasPhrase(text,alias))return rule;}}
  return null;
}
function classify(title,desc,source="",brandRules=BRANDS.map(([name,aliases])=>({name,aliases,tier:"unclassified",priority:50}))){
  const raw=`${title||""} ${desc||""}`,t=raw.toLowerCase(),brandRule=findBrand(raw,brandRules),brand=brandRule?.name||"";
  const phenyx=t.includes("phenyx pro")||/\b(ptu|ptm|pti|pdp)[- ]?\d/i.test(raw);
  const p=score(t,PRO),w=score(t,WOR),c=score(t,CRE);let ps=p.n,ws=w.n,cs=c.n;
  if(brand){ps+=8;if(["china_export_creator","creator_audio"].includes(brandRule.tier))cs+=8;}
  const neg=NEG.some(x=>t.includes(x));if(neg&&ps<30&&ws<30&&cs<30){ps=Math.max(0,ps-45);ws=Math.max(0,ws-45);cs=Math.max(0,cs-45);}
  if(phenyx)ps=Math.max(ps,90);
  const ranked=[["Professional Audio",ps],["Worship Audio",ws],["Creator Audio",cs]].sort((a,b)=>b[1]-a[1]);
  const pillar=ranked[0][1]>=25?ranked[0][0]:"Adjacent Industry";
  let relevance=Math.min(100,ranked[0][1]+(phenyx?10:0));if(neg&&ranked[0][1]<30)relevance=Math.min(relevance,15);if(phenyx)relevance=100;
  const type=contentType(t),prod=family(t),model=(raw.match(/\b(?:PTU|PTM|PTI|PDP|TK|AM|PD|SC|MV|SM|BLX|QLX-D|SLX-D|EW-DX|EW-D|ULX-D|PGA)\s?-?\s?\d{1,4}[A-Z]?\b/gi)||[]).slice(0,5).join(",");
  const community=/reddit|gearspace|the gear page|the gear forum/.test(source.toLowerCase());let category="Media & Retail";
  if(phenyx)category="Phenyx Pro Mentions";else if(pillar==="Worship Audio")category="Worship Audio";else if(pillar==="Creator Audio")category="Creator Audio";else if(pillar==="Professional Audio"&&["New Product","Product Upgrade"].includes(type))category="Brand & Product";else if(community)category="Community / Reddit";
  const priority=phenyx||(relevance>=80&&["New Product","Product Upgrade","Business Data","Campaign"].includes(type))?"High":relevance>=55?"Medium":"Low";
  return{brand,competitorTier:brandRule?.tier||"unclassified",pillar,relevance,category,priority,type,prod,model,phenyx,evidence:[...p.m.map(x=>"pro:"+x),...w.m.map(x=>"worship:"+x),...c.m.map(x=>"creator:"+x),...(brand?["brand:"+brand,"tier:"+(brandRule?.tier||"unclassified")]:[]),...(neg?["negative:low-relevance-context"]:[])]};
}
async function analyze(item,env,scoreValue,metadataOnly=false){
  if(metadataOnly)return {summary:"",analysis:"Rules-based classification using the original headline.",confidence:"Unreviewed",sentiment:"Unknown",status:"rules_classified"};
  // Preserve the RSS-provided English summary. AI is used only for market analysis, never translation.
  const originalSummary=clean(item.description||item.title).slice(0,1200);
  if(scoreValue<60||!env.AI_API_URL||!env.AI_API_KEY||!env.AI_MODEL){
    return {summary:originalSummary,analysis:scoreValue<60?"Rules-based classification completed; below the deep market-analysis threshold (60).":"AI market analysis is not configured; the original English source summary is preserved.",confidence:"Unreviewed",sentiment:"Unknown",status:"rules_classified"};
  }
  try {
    const prompt="You are a professional audio-market intelligence analyst. Do not translate, rewrite, or replace the source title or source summary. Do not invent specifications or sales figures. Based only on the evidence below, write a concise Chinese market analysis that separates confirmed facts from hypotheses and considers product change -> feature change -> possible user-need change. If evidence is insufficient, say so. Return strict JSON with only these fields: analysis (Chinese analysis), confidence (High/Medium/Low), sentiment (Positive/Neutral/Negative/Unknown).\n"+
      "Title (original English): "+item.title+"\nSource summary (original English): "+originalSummary+"\nSource URL: "+item.url;
    const r=await fetch(env.AI_API_URL,{
      method:"POST",
      headers:{"Authorization":"Bearer "+env.AI_API_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({model:env.AI_MODEL,temperature:0.2,messages:[
        {role:"system",content:"Return valid JSON only. Do not provide a translation."},
        {role:"user",content:prompt}
      ]})
    });
    if(!r.ok) throw Error("AI HTTP "+r.status);
    const d=await r.json();
    const raw=d.choices?.[0]?.message?.content||"";
    const v=JSON.parse(raw.replace(/^```json\s*/i,"").replace(/```$/i,"").trim());
    return {
      summary:originalSummary,
      analysis:String(v.analysis||"Insufficient evidence for a market conclusion.").slice(0,3000),
      confidence:["High","Medium","Low"].includes(v.confidence)?v.confidence:"Low",
      sentiment:["Positive","Neutral","Negative","Unknown"].includes(v.sentiment)?v.sentiment:"Unknown",
      status:"ai_analyzed"
    };
  } catch(e) {
    return {summary:originalSummary,analysis:"AI market analysis unavailable: "+String(e).slice(0,160)+". Manual review required.",confidence:"Unreviewed",sentiment:"Unknown",status:"rules_classified"};
  }
}

// Feed collection is permission-gated. Registry entries alone never activate a source.
// Legacy RSS_FEEDS is respected only for the three production feeds already
// registered and authorized in V3.0; it cannot bypass a disabled registry row.
const EDITORIAL_METADATA_PERMISSION="approved_public_editorial_metadata";
const AUTHORIZED_FEED_PERMISSIONS=new Set(["existing_configured","approved_public_feed","licensed",EDITORIAL_METADATA_PERMISSION]);
const LEGACY_MEDIA_SOURCE_NAMES=new Set(["Gearnews","Mix Online","AVNation"]);
async function sources(env){
  const rows=await env.DB.prepare("SELECT id,source_name,source_type,feed_url,permission_status,status,priority,max_items_per_run,feed_content_mode FROM source_registry ORDER BY priority DESC").all();
  const byUrl=new Map(), legacyRegistry=new Map();
  for(const row of rows.results||[]){
    if(LEGACY_MEDIA_SOURCE_NAMES.has(row.source_name))legacyRegistry.set(row.source_name,row);
    if(row.status!=="active"||!AUTHORIZED_FEED_PERMISSIONS.has(row.permission_status))continue;
    if(!["media","brand_pr"].includes(row.source_type)||!/^https:\/\//i.test(row.feed_url||""))continue;
    byUrl.set(row.feed_url,{id:row.id,name:row.source_name,url:row.feed_url,category:"Media & Retail",sourceType:row.source_type,priority:row.priority||50,maxItems:Number(row.max_items_per_run)||40,feedContentMode:row.feed_content_mode||"article"});
  }
  // Only registered, approved legacy sources may be present through the old config.
  // Unknown or disabled feed lines are deliberately ignored, not fetched.
  for(const line of (env.RSS_FEEDS||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean)){
    const[n,u,c]=line.split("|").map(v=>(v||"").trim());
    const reg=legacyRegistry.get(n);
    if(!reg||reg.status!=="active"||!AUTHORIZED_FEED_PERMISSIONS.has(reg.permission_status))continue;
    if(!u||!/^https:\/\//i.test(u)||u!==reg.feed_url)continue;
    if(!byUrl.has(u))byUrl.set(u,{id:reg.id,name:reg.source_name,url:u,category:c||"Brand & Product",sourceType:"media",priority:reg.priority||50,maxItems:Number(reg.max_items_per_run)||40,feedContentMode:reg.feed_content_mode||"article"});
  }
  return [...byUrl.values()].sort((a,b)=>(b.priority||0)-(a.priority||0));
}

function inferRegion(text){
  const t=String(text||"").toLowerCase();
  if(/\b(brazil|brasil|brazilian|sao paulo|são paulo|rio de janeiro)\b/.test(t))return"Brazil";
  if(/\b(mexico|méxico|mexican|mexico city)\b/.test(t))return"Mexico";
  if(/\b(southeast asia|singapore|indonesia|malaysia|thailand|vietnam|philippines|philippine)\b/.test(t))return"Southeast Asia";
  if(/\b(europe|european|united kingdom|uk|germany|france|italy|spain|netherlands|sweden|poland)\b/.test(t))return"Europe";
  if(/\b(united states|u\.s\.|usa|american|new york|california|nashville|texas)\b/.test(t))return"US";
  if(/\b(global|worldwide|international)\b/.test(t))return"Global";
  return"Unknown";
}
function candidateFromTitle(title){
  const m=String(title||"").match(/^([A-Z][A-Za-z0-9+&'’.-]*(?:\s+[A-Z][A-Za-z0-9+&'’.-]*){0,2})\s+(?:announces|introduces|unveils|launches|debuts|releases)\b/i);
  if(!m)return"";
  const name=m[1].trim();
  if(name.length<2||/^(the|new|first|this|that|here|how|why|what|when|where|introducing)$/i.test(name))return"";
  return name;
}
async function recordDiscovery(env,item,src,region){
  const candidate=candidateFromTitle(item.title);if(!candidate)return;
  const key=`brand|${candidate.toLowerCase()}|${item.url}`;
  const r=await env.DB.prepare(`INSERT OR IGNORE INTO source_discovery (id,candidate_name,candidate_type,found_by,source_name,source_url,evidence_text,suggested_category,market_region,confidence,status,discovered_at,dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),candidate,"brand","unrecognized_new_product_headline",src.name,item.url,String(item.title||"").slice(0,500),"Audio / Music Equipment",region,"Low","needs_review",new Date().toISOString(),key).run();
  return r.meta?.changes||0;
}
// Reject HTTP-200 HTML/errors masquerading as XML feeds. No content from a failed feed
// is inserted into articles, and such a run cannot be counted as successful.
function inspectFeedXml(xml,options={}){
  if(!/<(?:rss|feed|rdf:rdf)\b/i.test(String(xml||'').slice(0,4096)))throw Error('Response is not RSS/Atom XML');
  const declared=(String(xml).match(/<(?:item|entry)\b/gi)||[]).length;
  const items=parse(xml,options);
  if(declared>0&&items.length===0)throw Error('Feed contains items but none have a parsable title and link');
  return{items,declared};
}
function selectNewestFeedItems(items,limit=40){
  const cap=Math.min(Math.max(Number(limit)||40,1),100);
  return [...(items||[])].sort((a,b)=>{
    const ta=Date.parse(a.date||""),tb=Date.parse(b.date||"");
    const va=Number.isFinite(ta),vb=Number.isFinite(tb);
    if(va&&vb)return tb-ta;
    if(va)return -1;
    if(vb)return 1;
    return 0;
  }).slice(0,cap);
}
async function getFeedDocument(url,options={}){
  const metadataOnly=options.feedContentMode==="editorial_metadata";
  const r=await fetch(url,{
    ...(metadataOnly?{redirect:"error"}:{}),
    headers:{"User-Agent":`PhenyxProMarketIntelligence/${metadataOnly?VERSION:"3.0.5"} RSS reader`, "Accept":"application/rss+xml,application/atom+xml,application/xml,text/xml;q=0.9"}
  });
  if(!r.ok)throw Error(`Feed HTTP ${r.status}`);
  const maxBytes=5*1024*1024;
  if(Number(r.headers.get('content-length')||0)>maxBytes)throw Error('Feed exceeds 5 MiB safety limit');
  const reader=r.body?.getReader();
  if(!reader)throw Error('Feed response has no readable body');
  const chunks=[];let total=0;
  for(;;){const {done,value}=await reader.read();if(done)break;
    total+=value.byteLength;
    if(total>maxBytes){await reader.cancel();throw Error('Feed exceeds 5 MiB safety limit');}
    chunks.push(value);
  }
  const bytes=new Uint8Array(total);let pos=0;
  for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
  try{return{httpStatus:r.status,...inspectFeedXml(new TextDecoder().decode(bytes),{...options,feedUrl:url})};}
  catch(e){e.httpStatus=r.status;throw e;}
}
// The activation queue performs database-only checks; it does NOT crawl sites.
async function mediaActivationQueue(env){
  const monitor=await sourceMonitor(env);
  const media=monitor.sources.filter(x=>['media','brand_pr'].includes(x.source_type));
  const rows=media.map(x=>{
    const eligible=x.collectorEligible;
    const hasFeed=/^https:\/\//i.test(x.feed_url||'');
    const hasEvidence=!!String(x.permission_reference||'').trim();
    let stage,action;
    if(eligible&&x.successfulRuns30Days>0){stage='collecting';action='Review article quality and brand matches';}
    else if(eligible){stage='approved_awaiting_success';action='Run an authorized feed check then collect once';}
    else if(!hasFeed){stage='feed_discovery';action='Request and verify the publisher feed or editorial distribution';}
    else if(x.status==='permission_required'||x.permission_status==='review_required'||!hasEvidence){stage='permission_review';action='Obtain and record permission for enterprise internal metadata monitoring';}
    else{stage='disabled';action='Review status and documented permission before activation';}
    if(x.status==='needs_verification'&&x.access_method==='open_media_review')action=x.notes;
    return{sourceId:x.id,sourceName:x.source_name,sourceType:x.source_type,feedUrl:x.feed_url||null,sourceStatus:x.status,permissionStatus:x.permission_status,hasPermissionReference:hasEvidence,feedContentMode:x.feed_content_mode||"article",maxItemsPerRun:Number(x.max_items_per_run)||40,stage,action,successfulRuns30Days:x.successfulRuns30Days,lastError:x.last_error||null};
  });
  return{version:VERSION,generatedAt:new Date().toISOString(),note:'Registration and Feed URL discovery do not constitute permission. No candidate URLs are automatically fetched.',summary:{mediaSources:rows.length,collecting:rows.filter(x=>x.stage==='collecting').length,awaitingPermission:rows.filter(x=>x.stage==='permission_review').length,awaitingFeed:rows.filter(x=>x.stage==='feed_discovery').length},sources:rows};
}
// Explicit operator-requested preflight for ACTIVE + authorized publisher feeds only.
// Endpoint never fetches permission-required or pending candidates and does not ingest articles.
async function checkAuthorizedFeed(env,id){
  const source=await env.DB.prepare('SELECT id,source_name,source_type,feed_url,status,permission_status,feed_content_mode FROM source_registry WHERE id=?').bind(id).first();
  if(!source)return{status:404,body:{error:'Source not found'}};
  if(!['media','brand_pr'].includes(source.source_type)||source.status!=='active'||!AUTHORIZED_FEED_PERMISSIONS.has(source.permission_status))
    return{status:403,body:{error:'Source is not authorized and active for automated RSS collection'}};
  if(!/^https:\/\//i.test(source.feed_url||''))return{status:400,body:{error:'Source has no registered HTTPS feed URL'}};
  const now=new Date().toISOString(),idCheck=crypto.randomUUID();
  let httpStatus=null,parsedItems=0,ok=false,error=null;
  try{const result=await getFeedDocument(source.feed_url,{feedContentMode:source.feed_content_mode||"article",sourceId:source.id});httpStatus=result.httpStatus;parsedItems=result.items.length;ok=true;}
  catch(e){error=String(e?.message||e).slice(0,300);const match=error.match(/^Feed HTTP (\d{3})/);httpStatus=Number(e?.httpStatus)||(match?Number(match[1]):null);}
  await env.DB.prepare('INSERT INTO source_feed_checks (id,source_id,source_name,checked_at,success,http_status,parsed_items,error_message) VALUES (?,?,?,?,?,?,?,?)').bind(idCheck,source.id,source.source_name,now,ok?1:0,httpStatus,parsedItems,error).run();
  await env.DB.prepare('UPDATE source_registry SET last_checked_at=?,last_error=?,updated_at=? WHERE id=?').bind(now,error,now,source.id).run();
  return{status:ok?200:502,body:{sourceName:source.source_name,checkedAt:now,ok,httpStatus,parsedItems,error,note:'Preflight only: no articles inserted; existing daily collection schedule remains unchanged.'}};
}
async function collect(src,env,brandRules){
  const id=crypto.randomUUID(),start=new Date().toISOString();
  await env.DB.prepare("INSERT INTO source_runs (id,source_name,started_at,status) VALUES (?,?,?,?)").bind(id,src.name,start,"running").run();
  let seen=0,added=0,events=0,candidates=0;
  try{
    const feed=await getFeedDocument(src.url,{feedContentMode:src.feedContentMode||"article",sourceId:src.id});
    // Podcast RSS is treated as metadata only: title, short description, date and episode URL.
    // The parser never reads or fetches <enclosure> audio URLs or transcripts.
    const items=selectNewestFeedItems(feed.items,src.maxItems||40).map(item=>({...item,description:String(item.description||"").slice(0,src.feedContentMode==="podcast_metadata"?1000:1500)}));
    seen=items.length;
    for(const item of items){
      const m=classify(item.title,item.description,src.name,brandRules),a=await analyze(item,env,m.relevance,src.feedContentMode==="editorial_metadata");
      const podcast=src.feedContentMode==="podcast_metadata";
      const pub=item.date&&!Number.isNaN(Date.parse(item.date))?new Date(item.date).toISOString():start;
      const articleId=crypto.randomUUID();
      const res=await env.DB.prepare(`INSERT OR IGNORE INTO articles (id,canonical_url,title,source_name,published_at,collected_at,category,priority,brand,summary,analysis,confidence,content_type,sentiment,is_phenyx_mention,relevance_score,market_pillar,product_family,model,evidence,analysis_status,podcast_metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(articleId,item.url,item.title,src.name,pub,start,m.category,m.priority,m.brand,a.summary,a.analysis,a.confidence,m.type,a.sentiment,m.phenyx?1:0,m.relevance,m.pillar,m.prod,m.model,JSON.stringify(m.evidence),a.status,podcast?1:0).run();
      if(res.meta?.changes)added+=res.meta.changes;
      const existing=res.meta?.changes?{id:articleId}:await env.DB.prepare("SELECT id FROM articles WHERE canonical_url=?").bind(item.url).first();
      const region=inferRegion(`${item.title||""} ${item.description||""}`);
      if(existing?.id)events+=await recordIntelligence(env,existing.id,item,src,pub,region,brandRules,family);
      if(!podcast&&!m.brand&&m.type==="New Product")candidates+=await recordDiscovery(env,item,src,region);
    }
    await env.DB.prepare("UPDATE source_runs SET finished_at=?,status=?,items_seen=?,items_added=? WHERE id=?").bind(new Date().toISOString(),"success",seen,added,id).run();
    if(src.id)await env.DB.prepare("UPDATE source_registry SET last_checked_at=?,last_success_at=?,last_error=NULL,updated_at=? WHERE id=?").bind(start,new Date().toISOString(),new Date().toISOString(),src.id).run();
  }catch(e){
    await env.DB.prepare("UPDATE source_runs SET finished_at=?,status=?,items_seen=?,items_added=?,error_message=? WHERE id=?").bind(new Date().toISOString(),"error",seen,added,String(e).slice(0,500),id).run();
    if(src.id)await env.DB.prepare("UPDATE source_registry SET last_checked_at=?,last_error=?,updated_at=? WHERE id=?").bind(start,String(e).slice(0,500),new Date().toISOString(),src.id).run();
  }
  return{source:src.name,seen,added,competitorEvents:events,discoveryCandidates:candidates};
}
async function runCollection(env){
  const [ss,brandRules]=await Promise.all([sources(env),loadBrandRules(env)]);
  const results=[];for(const source of ss)results.push(await collect(source,env,brandRules));
  return{ranAt:new Date().toISOString(),configuredSources:ss.length,registrySources:ss.filter(x=>x.id).length,results};
}
async function reclassify(env,limit=100){const brandRules=await loadBrandRules(env);const n=Math.min(Math.max(Number(limit)||100,1),200),rows=await env.DB.prepare("SELECT id,title,summary,source_name FROM articles WHERE analysis_status='pending' ORDER BY collected_at DESC LIMIT ?").bind(n).all(),stmts=[],counts={processed:0,professionalAudio:0,worshipAudio:0,creatorAudio:0,adjacentIndustry:0,relevant35Plus:0,highPriority:0};for(const row of rows.results||[]){const m=classify(row.title,row.summary||"",row.source_name||"",brandRules);stmts.push(env.DB.prepare("UPDATE articles SET category=?,priority=?,brand=?,content_type=?,is_phenyx_mention=?,relevance_score=?,market_pillar=?,product_family=?,model=?,evidence=?,analysis_status='rules_classified' WHERE id=?").bind(m.category,m.priority,m.brand,m.type,m.phenyx?1:0,m.relevance,m.pillar,m.prod,m.model,JSON.stringify(m.evidence),row.id));counts.processed++;if(m.pillar==="Professional Audio")counts.professionalAudio++;else if(m.pillar==="Worship Audio")counts.worshipAudio++;else if(m.pillar==="Creator Audio")counts.creatorAudio++;else counts.adjacentIndustry++;if(m.relevance>=35)counts.relevant35Plus++;if(m.priority==="High")counts.highPriority++;}if(stmts.length)await env.DB.batch(stmts);const remain=await env.DB.prepare("SELECT COUNT(*) AS count FROM articles WHERE analysis_status='pending'").first();return{reclassified:counts,remainingPending:remain?.count||0,note:"规则分类结果，不等同于深度 AI 分析。"};}

async function backfillCompetitorEvents(env,limit=200){
  const brandRules=await loadBrandRules(env),n=Math.min(Math.max(Number(limit)||200,1),500);
  const rows=await env.DB.prepare("SELECT a.id,a.title,a.summary,a.source_name,a.canonical_url,a.published_at,     EXISTS (SELECT 1 FROM podcast_episodes p WHERE p.article_id=a.id) AS is_podcast     FROM articles a ORDER BY a.collected_at DESC,a.id LIMIT ?").bind(n).all();
  let processed=0,eventsAdded=0,candidatesAdded=0;
  for(const row of rows.results||[]){
    const item={title:row.title,description:row.summary||"",url:row.canonical_url};
    const m=classify(row.title,row.summary||"",row.source_name||"",brandRules);
    const src={name:row.source_name||"Historical article",sourceType:"media",
      feedContentMode:row.is_podcast?"podcast_metadata":"article"};
    const region=inferRegion(`${row.title||""} ${row.summary||""}`);
    eventsAdded+=await recordIntelligence(env,row.id,item,src,row.published_at,region,brandRules,family);
    if(!row.is_podcast&&!m.brand&&m.type==="New Product")candidatesAdded+=await recordDiscovery(env,item,src,region);
    processed++;
  }
  return{processed,eventsAdded,candidatesAdded,note:"Evidence-based events, review items and discovery records are deduplicated. Original article content is preserved."};
}

function safeJsonArray(v){try{const a=JSON.parse(v||"[]");return Array.isArray(a)?a:[]}catch{return[]}}
async function adminV3Summary(env){
  const [brands,sources,events,retail,discovery,reddit,intelligence]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM brand_watchlist WHERE status='active'").first(),
    env.DB.prepare("SELECT source_type,status,COUNT(*) AS count FROM source_registry GROUP BY source_type,status ORDER BY source_type,status").all(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM intelligence_event_history WHERE intelligence_class='actionable' AND datetime(observed_at)>=datetime('now','-30 days')").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM product_observations").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM source_discovery WHERE status='needs_review'").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM source_registry WHERE source_name='Reddit' AND status='pending_authorization'").first(),
    intelligenceCounts(env.DB)
  ]);
  return{version:VERSION,activeBrands:brands?.count||0,sourceStatus:sources.results||[],competitorEventsLast30Days:events?.count||0,retailObservations:retail?.count||0,discoveryCandidatesPending:discovery?.count||0,redditPendingAuthorization:!!reddit?.count,intelligence};
}
// Source Monitor distinguishes registered candidates from actual collection evidence.
async function sourceMonitor(env){
  const [r,runAgg,articleAgg]=await Promise.all([
    env.DB.prepare("SELECT id,source_name,source_type,website_url,feed_url,access_method,permission_status,permission_reference,status,priority,notes,last_checked_at,last_success_at,last_error,max_items_per_run,feed_content_mode FROM source_registry ORDER BY priority DESC,source_name ASC").all(),
    env.DB.prepare(`SELECT source_name,COUNT(*) AS total_runs,
      SUM(CASE WHEN datetime(started_at)>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS runs_30d,
      SUM(CASE WHEN status='success' AND datetime(started_at)>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS successes_30d,
      SUM(CASE WHEN status='error' AND datetime(started_at)>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS failures_30d,
      MAX(started_at) AS latest_run_at,
      MAX(CASE WHEN status='success' THEN finished_at END) AS latest_success_at,
      SUM(COALESCE(items_added,0)) AS articles_added_total
      FROM source_runs GROUP BY source_name`).all(),
    env.DB.prepare(`SELECT source_name,COUNT(*) AS article_count,
      SUM(CASE WHEN datetime(collected_at)>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS articles_collected_30d,
      SUM(CASE WHEN datetime(published_at) BETWEEN datetime('now','-30 days') AND datetime('now')
        AND NOT ${PODCAST_EXISTS} THEN 1 ELSE 0 END) AS news_30d,
      SUM(CASE WHEN datetime(published_at) BETWEEN datetime('now','-30 days') AND datetime('now')
        AND NOT ${PODCAST_EXISTS} AND relevance_score>=${MARKET_NEWS_MIN_SCORE} THEN 1 ELSE 0 END) AS qualified_news_30d,
      MAX(collected_at) AS last_article_collected_at
      FROM articles GROUP BY source_name`).all()
  ]);
  const runs=new Map((runAgg.results||[]).map(x=>[x.source_name,x]));
  const articles=new Map((articleAgg.results||[]).map(x=>[x.source_name,x]));
  const items=(r.results||[]).map(x=>{
    const run=runs.get(x.source_name)||{},article=articles.get(x.source_name)||{};
    const eligible=x.status==='active'&&AUTHORIZED_FEED_PERMISSIONS.has(x.permission_status)&&["media","brand_pr"].includes(x.source_type)&&!!x.feed_url;
    const runs30=Number(run.runs_30d||0),ok30=Number(run.successes_30d||0),failed30=Number(run.failures_30d||0);
    const completedRuns=ok30+failed30;
    const news30=Number(article.news_30d||0),qualified30=Number(article.qualified_news_30d||0);
    const qualityScore=eligible&&completedRuns>0&&news30>0&&x.feed_content_mode!=="podcast_metadata"
      ? Math.round(50*ok30/completedRuns+50*qualified30/news30) : null;
    return {...x,collectorEligible:eligible,
      collectionStatus:eligible?(ok30>0?'collecting':(runs30>0?'error_or_no_success':'awaiting_first_run')):'not_enabled',
      runs30Days:runs30,successfulRuns30Days:ok30,failedRuns30Days:failed30,
      latestRunAt:run.latest_run_at||null,latestSuccessfulRunAt:run.latest_success_at||x.last_success_at||null,
      articlesInDatabase:Number(article.article_count||0),articlesCollected30Days:Number(article.articles_collected_30d||0),
      articlesAddedByRuns:Number(run.articles_added_total||0),
      qualityScore,newsPublished30Days:news30,marketNewsQualified30Days:qualified30};
  });
  return{version:VERSION,generatedAt:new Date().toISOString(),scope:'registered_sources_only',
    note:'Registered != enabled; collecting requires successful recent source_runs. Retail and community collectors are disabled.',
    qualityScoreMethod:'30-day scale 0–100, half completed-run success rate and half share of published non-podcast articles at relevance >=35. Requires both samples from an enabled editorial source.',
    sources:items};
}
// This is OBSERVED COVERAGE across ingested articles/events, not brand market share.
async function brandCoverage(env){
  const rows=await env.DB.prepare(`
    SELECT b.brand_name,b.competitor_tier,b.priority,b.status,
      COALESCE(a.article_count,0) AS matched_articles,
      COALESCE(a.sources_count,0) AS observed_source_count,
      COALESCE(a.articles_30d,0) AS matched_articles_30d,
      COALESCE(a.qualified_news_30d,0) AS market_news_articles_30d,
      COALESCE(a.qualified_sources_30d,0) AS market_news_sources_30d,
      COALESCE(a.podcast_episodes_30d,0) AS matched_podcast_episodes_30d,
      a.last_published_at,
      COALESCE(e.events_count,0) AS events_count,
      COALESCE(e.events_30d,0) AS events_30d
    FROM brand_watchlist b
    LEFT JOIN (
      SELECT brand, COUNT(*) AS article_count,COUNT(DISTINCT source_name) AS sources_count,
        SUM(CASE WHEN datetime(published_at)>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS articles_30d,
        COUNT(CASE WHEN recent AND NOT is_podcast AND relevance_score>=${MARKET_NEWS_MIN_SCORE} THEN 1 END) AS qualified_news_30d,
        COUNT(DISTINCT CASE WHEN recent AND NOT is_podcast AND relevance_score>=${MARKET_NEWS_MIN_SCORE} THEN source_name END) AS qualified_sources_30d,
        COUNT(CASE WHEN recent AND is_podcast THEN 1 END) AS podcast_episodes_30d,
        MAX(published_at) AS last_published_at
      FROM (
        SELECT brand,source_name,published_at,relevance_score,
          datetime(published_at) BETWEEN datetime('now','-30 days') AND datetime('now') AS recent,
          ${PODCAST_EXISTS} AS is_podcast
        FROM articles WHERE brand IS NOT NULL AND brand!=''
      ) GROUP BY brand
    ) a ON a.brand=b.brand_name
    LEFT JOIN (
      SELECT brand_name,COUNT(*) AS events_count,
        SUM(CASE WHEN datetime(published_at)>=datetime('now','-30 days') THEN 1 ELSE 0 END) AS events_30d
      FROM intelligence_event_history WHERE intelligence_class='actionable' GROUP BY brand_name
    ) e ON e.brand_name=b.brand_name
    WHERE b.status='active' ORDER BY b.priority DESC,b.brand_name ASC`).all();
  const brands=rows.results||[];
  const coveredBrands=brands.filter(brand=>Number(brand.market_news_articles_30d)>0).length;
  return{version:VERSION,generatedAt:new Date().toISOString(),scope:'ingested_article_and_event_data_only',
    note:'Zero indicates no matched record in current monitored samples; it does NOT mean the brand had no releases or market activity.',
    marketNewsCoverage30Days:{activeBrands:brands.length,coveredBrands,uncoveredBrands:brands.length-coveredBrands},
    brands};
}

async function adminV3Routes(req,env,u){
  const path=u.pathname;
  const qualityResponse=await intelligenceAdmin(req,env,u,j,loadBrandRules);
  if(qualityResponse)return qualityResponse;
  if(path==="/api/admin/v3/source-monitor"&&req.method==="GET")return j(await sourceMonitor(env));
  if(path==="/api/admin/v3/media-activation"&&req.method==="GET")return j(await mediaActivationQueue(env));
  if(path==="/api/admin/v3/sources/check-feed"&&req.method==="POST"){
    let body;try{body=await req.json();}catch{return j({error:'Valid JSON body required'},400);}
    if(!body||typeof body.id!=='string'||!body.id.trim())return j({error:'Registered source id is required'},400);
    const result=await checkAuthorizedFeed(env,body.id.trim());return j(result.body,result.status);
  }
  if(path==="/api/admin/v3/source-feed-checks"&&req.method==="GET"){
    const n=Math.min(Math.max(Number(new URL(req.url).searchParams.get('limit'))||30,1),100);
    const r=await env.DB.prepare('SELECT source_name,checked_at,success,http_status,parsed_items,error_message FROM source_feed_checks ORDER BY checked_at DESC LIMIT ?').bind(n).all();
    return j({version:VERSION,checks:r.results||[]});
  }
  if(path==="/api/admin/v3/brand-coverage"&&req.method==="GET")return j(await brandCoverage(env));
  if(path==="/api/admin/v3/summary"&&req.method==="GET")return j(await adminV3Summary(env));
  if(path==="/api/admin/v3/backfill-events"&&req.method==="POST")return j(await backfillCompetitorEvents(env,u.searchParams.get("limit")||200));
  if(path==="/api/admin/v3/brands"&&req.method==="GET"){
    const status=u.searchParams.get("status"),tier=u.searchParams.get("tier");
    let sql="SELECT * FROM brand_watchlist WHERE 1=1",args=[];
    if(status){sql+=" AND status=?";args.push(status);}if(tier){sql+=" AND competitor_tier=?";args.push(tier);}
    sql+=" ORDER BY priority DESC,brand_name ASC LIMIT 300";
    const r=await env.DB.prepare(sql).bind(...args).all();
    return j({brands:(r.results||[]).map(x=>({...x,aliases:safeJsonArray(x.aliases_json),coreCategories:safeJsonArray(x.core_categories_json),monitoringFocus:safeJsonArray(x.monitoring_focus_json),targetRegions:safeJsonArray(x.target_regions_json)}))});
  }
  if(path==="/api/admin/v3/brands"&&req.method==="POST"){
    const b=await req.json();const name=String(b.brandName||"").trim();const aliases=Array.isArray(b.aliases)?b.aliases.map(x=>String(x).trim()).filter(Boolean).slice(0,30):[];
    if(!name||!aliases.length||!b.evidenceUrl||!/^https:\/\//i.test(b.evidenceUrl))return j({error:"brandName, aliases and an HTTPS evidenceUrl are required"},400);
    const id=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO brand_watchlist (id,brand_name,aliases_json,competitor_tier,core_categories_json,monitoring_focus_json,target_regions_json,priority,status,evidence_url,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,name,JSON.stringify(aliases),String(b.competitorTier||"cross_category_candidate"),JSON.stringify(Array.isArray(b.coreCategories)?b.coreCategories:[]),JSON.stringify(Array.isArray(b.monitoringFocus)?b.monitoringFocus:[]),JSON.stringify(Array.isArray(b.targetRegions)?b.targetRegions:["US","Europe","Brazil","Mexico","Southeast Asia"]),Number(b.priority)||50,"candidate",b.evidenceUrl,String(b.notes||"Awaiting review; not active for automatic brand matching."),now,now).run();
    return j({created:true,id,status:"candidate",message:"Candidate saved for review; it is not yet used for automatic brand matching."},201);
  }
  if(path==="/api/admin/v3/brands/activate"&&req.method==="POST"){
    const b=await req.json();if(!b.id||!b.evidenceUrl||!/^https:\/\//i.test(b.evidenceUrl))return j({error:"id and HTTPS evidenceUrl are required"},400);
    const r=await env.DB.prepare("UPDATE brand_watchlist SET status='active',evidence_url=?,notes=?,updated_at=? WHERE id=? AND status='candidate'").bind(b.evidenceUrl,String(b.notes||"Reviewed and approved by admin."),new Date().toISOString(),b.id).run();
    return j({activated:!!r.meta?.changes,id:b.id});
  }
  if(path==="/api/admin/v3/sources"&&req.method==="GET"){
    const type=u.searchParams.get("type"),status=u.searchParams.get("status");let sql="SELECT * FROM source_registry WHERE 1=1",args=[];
    if(type){sql+=" AND source_type=?";args.push(type);}if(status){sql+=" AND status=?";args.push(status);}sql+=" ORDER BY priority DESC,source_name ASC LIMIT 300";
    const r=await env.DB.prepare(sql).bind(...args).all();return j({sources:(r.results||[]).map(x=>({...x,marketRegions:safeJsonArray(x.market_regions_json)}))});
  }
  if(path==="/api/admin/v3/sources/authorize"&&req.method==="POST"){
    const b=await req.json();const allowed=["licensed","approved_public_feed","approved_product_feed"];
    if(!b.id||!allowed.includes(b.permissionStatus)||!String(b.permissionReference||"").trim())return j({error:"id, an approved permissionStatus and permissionReference are required"},400);
    if(b.feedUrl&&!/^https:\/\//i.test(b.feedUrl))return j({error:"feedUrl must use HTTPS"},400);
    const row=await env.DB.prepare("SELECT source_type,feed_url FROM source_registry WHERE id=?").bind(b.id).first();if(!row)return j({error:"Source not found"},404);
    if(["media","brand_pr"].includes(row.source_type)){
      if(b.permissionStatus==="approved_product_feed")return j({error:"Product feed approval is only valid for retailer records."},400);
      if(!/^https:\/\//i.test(b.feedUrl||row.feed_url||""))return j({error:"Media activation requires a verified HTTPS feedUrl."},400);
    }
    if(row.source_type==="retailer"&&b.permissionStatus==="approved_public_feed")return j({error:"Retail product data require approved_product_feed or licensed permission."},400);
    const nextStatus=row.source_type==="community"?"pending_authorization":"active";
    if(row.source_type==="community"&&b.permissionStatus!=="licensed")return j({error:"Community sources require a specific written license; do not activate through a generic public-feed approval."},403);
    await env.DB.prepare("UPDATE source_registry SET permission_status=?,permission_reference=?,status=?,feed_url=COALESCE(?,feed_url),notes=COALESCE(?,notes),updated_at=? WHERE id=?")
      .bind(b.permissionStatus,String(b.permissionReference).slice(0,500),nextStatus,b.feedUrl||null,b.notes?String(b.notes).slice(0,500):null,new Date().toISOString(),b.id).run();
    return j({updated:true,id:b.id,status:nextStatus,permissionStatus:b.permissionStatus});
  }
  if(path==="/api/admin/v3/events"&&req.method==="GET"){
    const limit=Math.min(Math.max(Number(u.searchParams.get("limit"))||100,1),200),brand=u.searchParams.get("brand"),type=u.searchParams.get("type"),region=u.searchParams.get("region");
    const scope=u.searchParams.get("scope")||"actionable";
    if(!["actionable","legacy","all"].includes(scope))return j({error:"Invalid event scope"},400);
    let sql="SELECT e.*,(SELECT a.title FROM articles a WHERE a.id=e.article_id OR (e.article_id IS NULL AND a.canonical_url=e.source_url)) AS source_title FROM intelligence_event_history e WHERE 1=1",args=[];
    if(scope!=="all"){sql+=" AND intelligence_class=?";args.push(scope);}if(brand){sql+=" AND brand_name=?";args.push(brand);}if(type){sql+=" AND event_type=?";args.push(type);}if(region){sql+=" AND market_region=?";args.push(region);}sql+=" ORDER BY COALESCE(published_at,observed_at) DESC,id LIMIT ?";args.push(limit);
    const r=await env.DB.prepare(sql).bind(...args).all();return j({scope,events:r.results||[]});
  }
  if(path==="/api/admin/v3/discovery"&&req.method==="GET"){
    const status=u.searchParams.get("status")||"needs_review",limit=Math.min(Math.max(Number(u.searchParams.get("limit"))||100,1),200);
    const r=await env.DB.prepare("SELECT * FROM source_discovery WHERE status=? ORDER BY discovered_at DESC LIMIT ?").bind(status,limit).all();return j({candidates:r.results||[]});
  }
  if(path==="/api/admin/v3/discovery"&&req.method==="POST"){
    const b=await req.json(),name=String(b.candidateName||"").trim(),url=String(b.sourceUrl||"").trim();
    if(!name||!/^https:\/\//i.test(url))return j({error:"candidateName and HTTPS sourceUrl are required"},400);
    const key=`manual|${name.toLowerCase()}|${url}`,id=crypto.randomUUID();
    await env.DB.prepare("INSERT OR IGNORE INTO source_discovery (id,candidate_name,candidate_type,found_by,source_name,source_url,evidence_text,suggested_category,market_region,confidence,status,discovered_at,dedupe_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(id,name,String(b.candidateType||"brand"),"manual_review",String(b.sourceName||"Admin submission"),url,String(b.evidenceText||"").slice(0,1000),String(b.suggestedCategory||"Audio / Music Equipment"),String(b.marketRegion||"Unknown"),String(b.confidence||"Medium"),"needs_review",new Date().toISOString(),key).run();
    return j({created:true,id,status:"needs_review"},201);
  }
  if(path==="/api/admin/v3/retail-observations"&&req.method==="GET"){
    const limit=Math.min(Math.max(Number(u.searchParams.get("limit"))||100,1),200),brand=u.searchParams.get("brand");
    let sql="SELECT * FROM product_observations WHERE 1=1",args=[];if(brand){sql+=" AND brand_name=?";args.push(brand);}sql+=" ORDER BY observed_at DESC LIMIT ?";args.push(limit);
    const r=await env.DB.prepare(sql).bind(...args).all();return j({observations:r.results||[]});
  }
  if(path==="/api/admin/v3/retail-observations"&&req.method==="POST"){
    const b=await req.json();const source=await env.DB.prepare("SELECT id,source_name,source_type,status,permission_status FROM source_registry WHERE id=?").bind(b.sourceId||"").first();
    if(!source||source.source_type!=="retailer"||source.status!=="active"||!['licensed','approved_product_feed'].includes(source.permission_status))return j({error:"Retail source is not authorized for product-data ingestion."},403);
    const price=b.observedPrice===null||b.observedPrice===undefined?null:Number(b.observedPrice),list=b.listPrice===null||b.listPrice===undefined?null:Number(b.listPrice);
    if(!b.productName||!b.productUrl||!/^https:\/\//i.test(b.productUrl)||!/^[A-Z]{3}$/.test(String(b.currency||""))||!String(b.permissionReference||"").trim()||(price!==null&&(!Number.isFinite(price)||price<0))||(list!==null&&(!Number.isFinite(list)||list<0)))return j({error:"productName, HTTPS productUrl, ISO currency, non-negative prices and permissionReference are required"},400);
    const observedAt=b.observedAt&& !Number.isNaN(Date.parse(b.observedAt))?new Date(b.observedAt).toISOString():new Date().toISOString();
    const key=[source.id,b.productUrl,observedAt,price===null?"":price].join("|");
    await env.DB.prepare("INSERT OR IGNORE INTO product_observations (id,source_id,retailer_name,brand_name,product_name,model,sku,market_region,country,currency,list_price,observed_price,stock_status,promotion_text,product_url,observed_at,permission_reference,raw_data_json,dedupe_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(),source.id,source.source_name,String(b.brandName||""),String(b.productName),String(b.model||""),String(b.sku||""),String(b.marketRegion||"Unknown"),String(b.country||""),String(b.currency),list,price,String(b.stockStatus||"unknown"),String(b.promotionText||""),b.productUrl,observedAt,String(b.permissionReference).slice(0,500),JSON.stringify(b.rawData||{}),key,new Date().toISOString()).run();
    return j({saved:true,retailer:source.source_name,observedAt},201);
  }
  return j({error:"V3 admin route not found"},404);
}

async function handle(req,env){const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});if(u.pathname==="/health")return j({ok:true,service:"phenyxpro-intel-feed",version:VERSION,translationEnabled:false,contentLanguage:"en-original",features:{brandWatchlist:true,sourceRegistry:true,retailDataAuthorizationGated:true,redditStatus:"pending_authorization",openMediaExpansion:true,podcastAudioFetch:false,intelligenceQuality:true,podcastExcludedFromBriefingByDefault:true},time:new Date().toISOString()});if(u.pathname==="/api/briefing.json"&&req.method==="GET"){
  if(!auth(req,env))return j({error:"Unauthorized"},401);
  const raw=Number(u.searchParams.get('min_score')??MARKET_NEWS_MIN_SCORE);
  const min=Number.isFinite(raw)?Math.min(Math.max(raw,0),100):MARKET_NEWS_MIN_SCORE;
  const requested=Number(u.searchParams.get('limit')||100);
  const limit=Number.isFinite(requested)?Math.min(Math.max(Math.floor(requested),1),200):100;
  const requestedOffset=Number(u.searchParams.get('offset')||0);
  const offset=Number.isFinite(requestedOffset)?Math.min(Math.max(Math.floor(requestedOffset),0),1000000):0;
  const sort=u.searchParams.get('sort')==='date'?'date':'score';
  // Market News is podcast-free by default. Podcast episodes remain available
  // through the dedicated intelligence endpoints or explicit include_podcasts=1.
  const includePodcasts=['1','true','yes'].includes(String(u.searchParams.get('include_podcasts')||'').toLowerCase());
  const podcastExists=PODCAST_EXISTS;
  const podcastFilter=includePodcasts?'':` AND NOT ${podcastExists}`;
  const orderBy=sort==='score'?'relevance_score DESC,published_at DESC,id':'published_at DESC,collected_at DESC,id';
  const r=await env.DB.prepare(`SELECT id,title,source_name,published_at,category,priority,brand,summary,analysis,confidence,content_type,sentiment,is_phenyx_mention,canonical_url,relevance_score,market_pillar,product_family,model,evidence,analysis_status,
    ${podcastExists} AS is_podcast
    FROM articles WHERE relevance_score>=? ${podcastFilter} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(min,limit,offset).all();
  const counts=await env.DB.prepare(`SELECT COUNT(*) AS total_all,
    SUM(CASE WHEN NOT ${podcastExists} THEN 1 ELSE 0 END) AS total_news,
    SUM(CASE WHEN ${podcastExists} THEN 1 ELSE 0 END) AS total_podcast,
    SUM(CASE WHEN relevance_score>=? AND (?=1 OR NOT ${podcastExists}) THEN 1 ELSE 0 END) AS matching
    FROM articles`).bind(min,includePodcasts?1:0).first();
  const items=(r.results||[]).map(x=>({
    date:x.published_at?.slice(0,10)||'',category:x.category,priority:x.priority,title:x.title,
    brand:x.brand||x.source_name||'',summary:x.summary||'',analysis:x.analysis||'',source:x.canonical_url,
    confidence:x.confidence||'Unreviewed',contentType:x.is_podcast?'Podcast Episode':x.content_type,contentKind:x.is_podcast?'podcast_episode':'article',sentiment:x.sentiment,
    isPhenyxMention:!!x.is_phenyx_mention,relevanceScore:x.relevance_score,
    marketPillar:x.market_pillar,productFamily:x.product_family,model:x.model,
    evidence:x.evidence?JSON.parse(x.evidence):[],analysisStatus:x.analysis_status
  }));
  const totalMatching=counts?.matching||0;
  const totalArticles=includePodcasts?(counts?.total_all||0):(counts?.total_news||0);
  return j({generatedAt:new Date().toISOString(),mode:'LIVE',version:VERSION,translationEnabled:false,contentLanguage:'en-original',minRelevanceScore:min,
    totalArticles,totalAllArticles:counts?.total_all||0,totalPodcastEpisodes:counts?.total_podcast||0,
    podcastsIncluded:includePodcasts,totalMatching,returned:items.length,offset,limit,
    hasMore:offset+items.length<totalMatching,nextOffset:offset+items.length,items});
}
if(u.pathname==='/api/admin/translate'&&req.method==='POST'){
  if(!auth(req,env))return j({error:'Unauthorized'},401);
  return j({error:'translation_disabled',message:'Machine translation is disabled. The API serves original English titles and source summaries.'},410);
}
if(u.pathname.startsWith("/api/admin/v3/")){
  if(!auth(req,env))return j({error:"Unauthorized"},401);
  return adminV3Routes(req,env,u);
}
if(u.pathname==="/api/admin/run-collection"&&req.method==="POST"){if(!auth(req,env))return j({error:"Unauthorized"},401);return j(await runCollection(env));}if(u.pathname==="/api/admin/reclassify"&&req.method==="POST"){if(!auth(req,env))return j({error:"Unauthorized"},401);return j(await reclassify(env,u.searchParams.get("limit")||100));}if(u.pathname==="/api/admin/source-runs"&&req.method==="GET"){if(!auth(req,env))return j({error:"Unauthorized"},401);const r=await env.DB.prepare("SELECT * FROM source_runs ORDER BY started_at DESC LIMIT 100").all();return j({runs:r.results||[]});}if(u.pathname==="/api/admin/summary"&&req.method==="GET"){if(!auth(req,env))return j({error:"Unauthorized"},401);const r=await env.DB.prepare("SELECT market_pillar,category,COUNT(*) AS total,AVG(relevance_score) AS avg_relevance,SUM(CASE WHEN relevance_score>=35 THEN 1 ELSE 0 END) AS relevant FROM articles GROUP BY market_pillar,category ORDER BY total DESC").all();return j({summary:r.results||[]});}return j({error:"Not found"},404);}
export const __test={parse,inspectFeedXml,selectNewestFeedItems,collect};
export default{fetch(req,env){return handle(req,env).catch(e=>j({error:"Internal server error",detail:String(e).slice(0,300)},500));},scheduled(_event,env,ctx){ctx.waitUntil(runCollection(env));}};
