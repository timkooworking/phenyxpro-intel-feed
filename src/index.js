const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type"};
const j=(d,s=200)=>new Response(JSON.stringify(d,null,2),{status:s,headers:{"Content-Type":"application/json; charset=utf-8",...CORS}});
const auth=(r,e)=>!!e.FEED_TOKEN&&r.headers.get("Authorization")===`Bearer ${e.FEED_TOKEN}`;
const dec=s=>(s||"").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'");
const clean=s=>dec((s||"").replace(/<[^>]*>/g," ")).replace(/\s+/g," ").trim();
function tag(b,n){for(const t of n){const m=b.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${t}>`,"i"));if(m)return clean(m[1]);}return"";}
function link(b){let m=b.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i);if(m)return dec(m[1]);m=b.match(/<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i);if(m)return clean(m[1]);m=b.match(/<guid(?:\s[^>]*)?>([\s\S]*?)<\/guid>/i);return m?clean(m[1]):"";}
function parse(xml){return(xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi)||[]).map(b=>({title:tag(b,["title"]),url:link(b),date:tag(b,["pubDate","published","updated","dc:date"]),description:tag(b,["description","summary","content:encoded","content"])})).filter(x=>x.title&&x.url);}
const BRANDS=[
["Phenyx Pro",["phenyx pro"]],["Shure",["shure"]],["Sennheiser",["sennheiser"]],["Audio-Technica",["audio-technica","audio technica"]],["RØDE",["røde","rode microphones","rode wireless"]],["Xvive",["xvive"]],["Hollyland",["hollyland"]],["Behringer",["behringer"]],["Allen & Heath",["allen & heath","allen and heath"]],["Maono",["maono"]],["TONOR",["tonor"]],["FIFINE",["fifine"]],["BOYA",["boya"]],["Comica",["comica"]],["SYNCO",["synco"]],["Saramonic",["saramonic"]],["Elgato",["elgato"]],["HyperX",["hyperx"]],["Yamaha",["yamaha"]],["Soundcraft",["soundcraft"]],["Mackie",["mackie"]],["AKG",["akg"]],["DPA",["dpa microphones","dpa microphone"]],["Electro-Voice",["electro-voice","electro voice"]],["JBL",["jbl professional","jbl pro audio"]],["QSC",["qsc"]],["Yorkville",["yorkville"]],["HK Audio",["hk audio"]],["Riedel",["riedel"]],["BishopSound",["bishopsound"]],["HEDD",["heddphone","hedd audio"]],["Focusrite",["focusrite"]],["Universal Audio",["universal audio"]],["PreSonus",["presonus"]],["Tascam",["tascam"]],["Crestron",["crestron"]]
];
const PRO=[["wireless microphone",38],["wireless mic",35],["wireless system",18],["in-ear monitor",42],["in ear monitor",42],["iem system",42],["iem",34],["rf coordination",42],["antenna distribution",40],["antenna combiner",35],["bodypack",25],["transmitter",12],["receiver",12],["live sound",32],["stage monitor",30],["monitor mix",30],["pa system",32],["powered speaker",30],["subwoofer",30],["digital mixer",30],["analog mixer",25],["audio mixer",28],["sound reinforcement",32],["loudspeaker",24],["headset microphone",28],["wireless instrument",30],["guitar wireless",28],["instrument wireless",28],["broadcast audio",25],["intercom system",25],["recording studio",22],["studio microphone",28],["headphone",24],["headphones",24],["heddphone",30],["audio interface",25],["microphone",16],["microphones",16]];
const WOR=[["house of worship",48],["worship leader",48],["worship team",44],["church audio",48],["church sound",44],["church production",44],["worship audio",48],["worship",34],["church",20],["volunteer audio",36],["church livestream",40]];
const CRE=[["content creator",40],["creator audio",42],["podcast microphone",38],["podcasting",32],["podcast",28],["usb microphone",34],["streamer",28],["livestream audio",34],["live streaming",24],["vlogging",24],["creator microphone",38],["home studio",22],["voiceover",24],["vocal processing",22]];
const NEG=["medical display","healthcare technology","clinical computing","digital signage","signage showroom","attractions industry","theme park","diagnostic monitor","medical monitor"];
function score(t,r){let n=0,m=[];for(const [w,v] of r)if(t.includes(w)){n+=v;m.push(w);}return{n:Math.min(n,90),m};}
function family(t){const rules=[["Wireless Microphone System",["wireless microphone","wireless mic","wireless system","bodypack transmitter"]],["In-Ear Monitoring",["in-ear monitor","in ear monitor","iem system","iem"]],["RF & Antenna",["rf coordination","antenna distribution","antenna combiner","rf antenna"]],["PA & Loudspeaker",["pa system","powered speaker","loudspeaker","line array"]],["Subwoofer",["subwoofer"]],["Mixer",["digital mixer","analog mixer","audio mixer","mixing console"]],["Creator Microphone",["podcast microphone","usb microphone","creator microphone","streaming microphone"]],["Headphones & Monitoring",["headphone","headphones","heddphone","studio monitor"]],["Wireless Instrument System",["guitar wireless","instrument wireless","wireless guitar"]],["Audio Interface",["audio interface","usb interface"]],["Recording & Production",["recording studio","vocal processing","audio plugin","audio plug-in"]],["Broadcast & Intercom",["broadcast audio","intercom system","production center"]]];for(const [f,terms] of rules)if(terms.some(x=>t.includes(x)))return f;return"";}
function contentType(t){if(/review|tested|hands-on|hands on|first impressions/.test(t))return"Review";if(/buying guide|best .* microphone|best .* wireless|best .* iem|roundup/.test(t))return"Buying Guide";if(/tutorial|how to|guide to|tips for|explained/.test(t))return"Tutorial";if(/campaign|ambassador|brand partner|giveaway/.test(t))return"Campaign";if(/sales|revenue|market share|quarterly results/.test(t))return"Business Data";if(/case study|installation|installed|relies on .* technology|powered by/.test(t))return"Case Study";if(/firmware update|software update|new feature|upgrade/.test(t))return"Product Upgrade";if(/launch|announces|announced|introduces|introduced|unveils|unveiled|debuts|debut/.test(t))return"New Product";if(/conference|expo|trade show|event|awards|nominations/.test(t))return"Industry News";return"Article";}
function classify(title,desc,source=""){const raw=`${title||""} ${desc||""}`,t=raw.toLowerCase(),brandRule=BRANDS.find(([,terms])=>terms.some(x=>t.includes(x))),brand=brandRule?.[0]||"",phenyx=t.includes("phenyx pro")||/\b(ptu|ptm|pti|pdp)[- ]?\d/i.test(raw);const p=score(t,PRO),w=score(t,WOR),c=score(t,CRE);let ps=p.n,ws=w.n,cs=c.n;if(brand){ps+=8;if(["Maono","TONOR","FIFINE","BOYA","Comica","SYNCO","Saramonic","RØDE","Hollyland","Elgato","HyperX"].includes(brand))cs+=8;}const neg=NEG.some(x=>t.includes(x));if(neg&&ps<30&&ws<30&&cs<30){ps=Math.max(0,ps-45);ws=Math.max(0,ws-45);cs=Math.max(0,cs-45);}if(phenyx)ps=Math.max(ps,90);const ranked=[["Professional Audio",ps],["Worship Audio",ws],["Creator Audio",cs]].sort((a,b)=>b[1]-a[1]);const pillar=ranked[0][1]>=25?ranked[0][0]:"Adjacent Industry";let relevance=Math.min(100,ranked[0][1]+(phenyx?10:0));if(neg&&ranked[0][1]<30)relevance=Math.min(relevance,15);if(phenyx)relevance=100;const type=contentType(t),prod=family(t),model=(raw.match(/\b(?:PTU|PTM|PTI|PDP|TK|AM|PD|SC|MV|SM|BLX|QLX-D|SLX-D|EW-DX|EW-D|ULX-D|PGA)\s?-?\s?\d{1,4}[A-Z]?\b/gi)||[]).slice(0,5).join(",");const community=/reddit|gearspace|the gear page|the gear forum/.test(source.toLowerCase());let category="Media & Retail";if(phenyx)category="Phenyx Pro Mentions";else if(pillar==="Worship Audio")category="Worship Audio";else if(pillar==="Creator Audio")category="Creator Audio";else if(pillar==="Professional Audio"&&["New Product","Product Upgrade"].includes(type))category="Brand & Product";else if(community)category="Community / Reddit";const priority=phenyx||(relevance>=80&&["New Product","Product Upgrade","Business Data","Campaign"].includes(type))?"High":relevance>=55?"Medium":"Low";return{brand,pillar,relevance,category,priority,type,prod,model,phenyx,evidence:[...p.m.map(x=>"pro:"+x),...w.m.map(x=>"worship:"+x),...c.m.map(x=>"creator:"+x),...(brand?["brand:"+brand]:[]),...(neg?["negative:low-relevance-context"]:[])]};}
async function analyze(item,env,scoreValue){const summary=clean(item.description||item.title).slice(0,1200);if(scoreValue<60||!env.AI_API_URL||!env.AI_API_KEY||!env.AI_MODEL)return{summary,analysis:scoreValue<60?"规则分类已完成；未达到深度 AI 分析阈值（60 分）。":"尚未配置 AI 分析服务；当前保留来源摘要，未生成趋势推断。",confidence:"Unreviewed",sentiment:"Unknown",status:"rules_classified"};try{const prompt=`你是专业音频市场研究分析师。只根据标题和摘要工作，不得补造规格或销量。用中文返回严格 JSON：summary, analysis（区分事实和假设，分析产品变化→功能变化→用户需求变化）, confidence（High/Medium/Low）, sentiment（Positive/Neutral/Negative/Unknown）。证据不足须明确说明。标题：${item.title}\n摘要：${summary}\n来源：${item.url}`;const r=await fetch(env.AI_API_URL,{method:"POST",headers:{"Authorization":`Bearer ${env.AI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:env.AI_MODEL,temperature:.2,messages:[{role:"system",content:"只输出有效 JSON，不要 Markdown。"},{role:"user",content:prompt}]})});if(!r.ok)throw Error(`AI HTTP ${r.status}`);const d=await r.json(),s=d.choices?.[0]?.message?.content||"",v=JSON.parse(s.replace(/^```json\s*/i,"").replace(/```$/i,"").trim());return{summary:String(v.summary||summary).slice(0,1600),analysis:String(v.analysis||"证据不足。").slice(0,3000),confidence:["High","Medium","Low"].includes(v.confidence)?v.confidence:"Low",sentiment:["Positive","Neutral","Negative","Unknown"].includes(v.sentiment)?v.sentiment:"Unknown",status:"ai_analyzed"};}catch(e){return{summary,analysis:`AI 分析暂不可用：${String(e).slice(0,160)}。待人工复核。`,confidence:"Unreviewed",sentiment:"Unknown",status:"rules_classified"};}}
function sources(env){return(env.RSS_FEEDS||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>{const[n,u,c]=x.split("|").map(v=>(v||"").trim());return{name:n||"RSS source",url:u,category:c||"Brand & Product"};}).filter(x=>x.url&&/^https:\/\//i.test(x.url));}
async function collect(src,env){const id=crypto.randomUUID(),start=new Date().toISOString();await env.DB.prepare("INSERT INTO source_runs (id,source_name,started_at,status) VALUES (?,?,?,?)").bind(id,src.name,start,"running").run();let seen=0,added=0;try{const r=await fetch(src.url,{headers:{"User-Agent":"PhenyxProMarketIntelligence/2.1 RSS reader"}});if(!r.ok)throw Error(`Feed HTTP ${r.status}`);const items=parse(await r.text()).slice(0,40);seen=items.length;for(const item of items){const m=classify(item.title,item.description,src.name),a=await analyze(item,env,m.relevance);const pub=item.date?new Date(item.date).toISOString():start;const res=await env.DB.prepare(`INSERT OR IGNORE INTO articles (id,canonical_url,title,source_name,published_at,collected_at,category,priority,brand,summary,analysis,confidence,content_type,sentiment,is_phenyx_mention,relevance_score,market_pillar,product_family,model,evidence,analysis_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),item.url,item.title,src.name,pub,start,m.category,m.priority,m.brand,a.summary,a.analysis,a.confidence,m.type,a.sentiment,m.phenyx?1:0,m.relevance,m.pillar,m.prod,m.model,JSON.stringify(m.evidence),a.status).run();if(res.meta?.changes)added+=res.meta.changes;}await env.DB.prepare("UPDATE source_runs SET finished_at=?,status=?,items_seen=?,items_added=? WHERE id=?").bind(new Date().toISOString(),"success",seen,added,id).run();}catch(e){await env.DB.prepare("UPDATE source_runs SET finished_at=?,status=?,items_seen=?,items_added=?,error_message=? WHERE id=?").bind(new Date().toISOString(),"error",seen,added,String(e).slice(0,500),id).run();}return{source:src.name,seen,added};}
async function runCollection(env){const ss=sources(env),results=[];for(const s of ss)results.push(await collect(s,env));return{ranAt:new Date().toISOString(),configuredSources:ss.length,results};}
async function reclassify(env,limit=100){const n=Math.min(Math.max(Number(limit)||100,1),200),rows=await env.DB.prepare("SELECT id,title,summary,source_name FROM articles WHERE analysis_status='pending' ORDER BY collected_at DESC LIMIT ?").bind(n).all(),stmts=[],counts={processed:0,professionalAudio:0,worshipAudio:0,creatorAudio:0,adjacentIndustry:0,relevant35Plus:0,highPriority:0};for(const row of rows.results||[]){const m=classify(row.title,row.summary||"",row.source_name||"");stmts.push(env.DB.prepare("UPDATE articles SET category=?,priority=?,brand=?,content_type=?,is_phenyx_mention=?,relevance_score=?,market_pillar=?,product_family=?,model=?,evidence=?,analysis_status='rules_classified' WHERE id=?").bind(m.category,m.priority,m.brand,m.type,m.phenyx?1:0,m.relevance,m.pillar,m.prod,m.model,JSON.stringify(m.evidence),row.id));counts.processed++;if(m.pillar==="Professional Audio")counts.professionalAudio++;else if(m.pillar==="Worship Audio")counts.worshipAudio++;else if(m.pillar==="Creator Audio")counts.creatorAudio++;else counts.adjacentIndustry++;if(m.relevance>=35)counts.relevant35Plus++;if(m.priority==="High")counts.highPriority++;}if(stmts.length)await env.DB.batch(stmts);const remain=await env.DB.prepare("SELECT COUNT(*) AS count FROM articles WHERE analysis_status='pending'").first();return{reclassified:counts,remainingPending:remain?.count||0,note:"规则分类结果，不等同于深度 AI 分析。"};}

const TRANSLATION_MODEL = '@cf/meta/m2m100-1.2b';
async function translateText(text, env) {
  const input=String(text||'').trim();
  if(!input) return '';
  const result=await env.AI.run(TRANSLATION_MODEL,{text:input.slice(0,1100),source_lang:'en',target_lang:'zh'});
  const value=String(result?.translated_text||'').trim();
  if(!value) throw Error('Workers AI 未返回 translated_text');
  return value;
}
async function translatePending(env, requestedLimit=5, retryFailed=false) {
  if(!env.AI) throw Error('Workers AI binding AI 未配置：请在 wrangler.toml 添加 [ai] binding = "AI"');
  const limit=Math.min(Math.max(Number(requestedLimit)||5,1),10);
  const rows=await env.DB.prepare(`
    SELECT id,title,summary,translation_status FROM articles
    WHERE translation_status='pending' OR (?=1 AND translation_status='error')
    ORDER BY published_at DESC LIMIT ?
  `).bind(retryFailed?1:0,limit).all();
  let success=0,failed=0;
  const errors=[];
  for(const row of rows.results||[]) {
    try {
      const titleZh=await translateText(row.title,env);
      const summarySource=(row.summary||'').trim();
      const summaryZh=summarySource && summarySource !== (row.title||'').trim()
        ? await translateText(summarySource,env)
        : titleZh;
      await env.DB.prepare(`
        UPDATE articles
        SET title_zh=?,summary_zh=?,translation_status='completed',translated_at=?,translation_error=NULL
        WHERE id=?
      `).bind(titleZh,summaryZh,new Date().toISOString(),row.id).run();
      success++;
    } catch(e) {
      const message=String(e).slice(0,240);
      failed++;
      errors.push({id:row.id,error:message});
      await env.DB.prepare(`
        UPDATE articles SET translation_status='error', translation_error=? WHERE id=?
      `).bind(message,row.id).run();
    }
  }
  const pending=await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM articles WHERE translation_status='pending'
  `).first();
  const errorsTotal=await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM articles WHERE translation_status='error'
  `).first();
  return {processed:success+failed,translated:success,failed,remainingPending:pending?.count||0,
    remainingErrors:errorsTotal?.count||0,errors:errors.slice(0,5),model:TRANSLATION_MODEL};
}

async function handle(req,env){const u=new URL(req.url);if(req.method==="OPTIONS")return new Response(null,{status:204,headers:CORS});if(u.pathname==="/health")return j({ok:true,service:"phenyxpro-intel-feed",version:"2.2.0",time:new Date().toISOString()});if(u.pathname==="/api/briefing.json"&&req.method==="GET"){
  if(!auth(req,env))return j({error:"Unauthorized"},401);
  const raw=Number(u.searchParams.get('min_score')??0);
  const min=Number.isFinite(raw)?Math.min(Math.max(raw,0),100):0;
  const requested=Number(u.searchParams.get('limit')||100);
  const limit=Number.isFinite(requested)?Math.min(Math.max(Math.floor(requested),1),200):100;
  const requestedOffset=Number(u.searchParams.get('offset')||0);
  const offset=Number.isFinite(requestedOffset)?Math.min(Math.max(Math.floor(requestedOffset),0),1000000):0;
  const sort=u.searchParams.get('sort')==='score'?'score':'date';
  const orderBy=sort==='score'?'relevance_score DESC,published_at DESC':'published_at DESC,collected_at DESC';
  const r=await env.DB.prepare(`SELECT id,title,source_name,published_at,category,priority,brand,summary,analysis,confidence,content_type,sentiment,is_phenyx_mention,canonical_url,relevance_score,market_pillar,product_family,model,evidence,analysis_status,title_zh,summary_zh,translation_status
    FROM articles WHERE relevance_score>=? ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(min,limit,offset).all();
  const counts=await env.DB.prepare('SELECT COUNT(*) AS total, SUM(CASE WHEN relevance_score>=? THEN 1 ELSE 0 END) AS matching FROM articles').bind(min).first();
  const items=(r.results||[]).map(x=>({
    date:x.published_at?.slice(0,10)||'',category:x.category,priority:x.priority,title:x.title,
    titleZh:x.title_zh||'',summaryZh:x.summary_zh||'',translationStatus:x.translation_status||'pending',
    brand:x.brand||x.source_name||'',summary:x.summary||'',analysis:x.analysis||'',source:x.canonical_url,
    confidence:x.confidence||'Unreviewed',contentType:x.content_type,sentiment:x.sentiment,
    isPhenyxMention:!!x.is_phenyx_mention,relevanceScore:x.relevance_score,
    marketPillar:x.market_pillar,productFamily:x.product_family,model:x.model,
    evidence:x.evidence?JSON.parse(x.evidence):[],analysisStatus:x.analysis_status
  }));
  const totalMatching=counts?.matching||0;
  return j({generatedAt:new Date().toISOString(),mode:'LIVE',version:'2.2.0',minRelevanceScore:min,
    totalArticles:counts?.total||0,totalMatching,returned:items.length,offset,limit,
    hasMore:offset+items.length<totalMatching,nextOffset:offset+items.length,items});
}
if(u.pathname==='/api/admin/translate'&&req.method==='POST'){
  if(!auth(req,env))return j({error:'Unauthorized'},401);
  const limit=u.searchParams.get('limit')||5;
  const retry=u.searchParams.get('retry_failed')==='1';
  return j(await translatePending(env,limit,retry));
}
if(u.pathname==="/api/admin/run-collection"&&req.method==="POST"){if(!auth(req,env))return j({error:"Unauthorized"},401);return j(await runCollection(env));}if(u.pathname==="/api/admin/reclassify"&&req.method==="POST"){if(!auth(req,env))return j({error:"Unauthorized"},401);return j(await reclassify(env,u.searchParams.get("limit")||100));}if(u.pathname==="/api/admin/source-runs"&&req.method==="GET"){if(!auth(req,env))return j({error:"Unauthorized"},401);const r=await env.DB.prepare("SELECT * FROM source_runs ORDER BY started_at DESC LIMIT 100").all();return j({runs:r.results||[]});}if(u.pathname==="/api/admin/summary"&&req.method==="GET"){if(!auth(req,env))return j({error:"Unauthorized"},401);const r=await env.DB.prepare("SELECT market_pillar,category,COUNT(*) AS total,AVG(relevance_score) AS avg_relevance,SUM(CASE WHEN relevance_score>=35 THEN 1 ELSE 0 END) AS relevant FROM articles GROUP BY market_pillar,category ORDER BY total DESC").all();return j({summary:r.results||[]});}return j({error:"Not found"},404);}
export default{fetch(req,env){return handle(req,env).catch(e=>j({error:"Internal server error",detail:String(e).slice(0,300)},500));},scheduled(_event,env,ctx){ctx.waitUntil((async()=>{await runCollection(env);if(env.AI){try{await translatePending(env,8);}catch(e){console.error("Scheduled translation error:",String(e).slice(0,200));}}})());}};
