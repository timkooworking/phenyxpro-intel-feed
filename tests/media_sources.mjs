import worker from '../src/index.js';
function assert(check,message){if(!check)throw Error(message);}
const active={id:'src-gearnews',source_name:'Gearnews',source_type:'media',feed_url:'https://www.gearnews.com/feed/',status:'active',permission_status:'existing_configured',priority:100};
const blocked={id:'src-musicradar',source_name:'MusicRadar',source_type:'media',feed_url:'https://www.musicradar.com/feeds.xml',status:'permission_required',permission_status:'review_required',priority:99};
const pending={id:'src-church-production',source_name:'Church Production',source_type:'media',feed_url:'https://www.churchproduction.com/api/rss/content.rss',status:'needs_verification',permission_status:'review_required',priority:95};
const reddit={id:'com-reddit',source_name:'Reddit',source_type:'community',feed_url:'https://www.reddit.com/r/livesound/.rss',status:'pending_authorization',permission_status:'pending_authorization',priority:100};
const retailer={id:'ret-thomann',source_name:'Thomann',source_type:'retailer',feed_url:'https://example.invalid/product-feed.xml',status:'permission_required',permission_status:'not_authorized',priority:100};
const registry=[active,blocked,pending,reddit,retailer];
const queries=[];
class Statement{
  constructor(sql){this.sql=sql;this.args=[];queries.push(sql)}
  bind(...args){this.args=args;return this}
  async all(){
    if(this.sql.includes('source_registry ORDER BY priority DESC'))return {results:registry};
    if(this.sql.includes('SELECT id,source_name,source_type,website_url,feed_url,access_method'))return {results:registry};
    if(this.sql.includes('SELECT brand_name,aliases_json'))return {results:[]};
    if(this.sql.includes('FROM source_runs GROUP BY source_name'))return {results:[]};
    if(this.sql.includes('FROM articles GROUP BY source_name'))return {results:[]};
    if(this.sql.includes('FROM brand_watchlist b'))return {results:[{brand_name:'Xvive',matched_articles:0,observed_source_count:0,events_count:0}]};
    return {results:[]};
  }
  async first(){return {count:0};}
  async run(){return {meta:{changes:1}};}
}
const env={FEED_TOKEN:'test-token',DB:{prepare:(sql)=>new Statement(sql)},RSS_FEEDS:[
  'Gearnews|https://www.gearnews.com/feed/|Brand & Product',
  'MusicRadar|https://www.musicradar.com/feeds.xml|Media & Retail',
  'Unknown Media|https://unknown.example.test/rss|Media & Retail',
  'Reddit|https://www.reddit.com/r/livesound/.rss|Community',
  'Thomann|https://example.invalid/product-feed.xml|Retailer'
].join('\n')};
const headers={Authorization:'Bearer test-token'};
const unauthorized=await worker.fetch(new Request('https://test.local/api/admin/v3/source-monitor'),env);
assert(unauthorized.status===401,'source monitor must require FEED_TOKEN');
const monitor=await worker.fetch(new Request('https://test.local/api/admin/v3/source-monitor',{headers}),env);
const monitorJson=await monitor.json();
assert(monitor.status===200&&monitorJson.version==='3.0.2','source monitor endpoint must work');
assert(monitorJson.sources.find(x=>x.source_name==='Gearnews').collectorEligible===true,'active official feed must be eligible');
assert(monitorJson.sources.find(x=>x.source_name==='MusicRadar').collectorEligible===false,'permission-required feed must be disabled');
assert(monitorJson.sources.find(x=>x.source_name==='Reddit').collectionStatus==='not_enabled','Reddit must not be collected');
const coverage=await worker.fetch(new Request('https://test.local/api/admin/v3/brand-coverage',{headers}),env);
const coverageJson=await coverage.json();
assert(coverage.status===200&&coverageJson.brands[0].brand_name==='Xvive','brand coverage endpoint must work');
const calls=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async url=>{
  calls.push(String(url));
  return new Response('<?xml version="1.0"?><rss><channel><item><title>Shure new wireless microphone</title><link>https://media.test/a</link><pubDate>Thu, 26 Nov 2026 12:00:00 GMT</pubDate><description>New wireless microphone</description></item></channel></rss>',{status:200,headers:{'Content-Type':'application/rss+xml'}})
};
try{
  const collected=await worker.fetch(new Request('https://test.local/api/admin/run-collection',{method:'POST',headers}),env);
  const body=await collected.json();
  assert(collected.status===200,'collection endpoint should succeed');
  assert(body.configuredSources===1,'only approved Gearnews should be collected');
  assert(calls.length===1&&calls[0]==='https://www.gearnews.com/feed/','blocked URLs must never be fetched');
}finally{globalThis.fetch=realFetch;}
console.log('V3.0.2 media monitoring & permission gating tests passed.');
