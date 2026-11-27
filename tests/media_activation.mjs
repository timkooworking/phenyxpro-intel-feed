import worker from '../src/index.js';
function assert(value,message){if(!value)throw Error(message);}
const active={id:'src-gearnews',source_name:'Gearnews',source_type:'media',website_url:'https://www.gearnews.com',feed_url:'https://www.gearnews.com/feed/',status:'active',permission_status:'existing_configured',permission_reference:'existing production config',priority:90};
const pending={id:'src-church-production',source_name:'Church Production',source_type:'media',website_url:'https://www.churchproduction.com',feed_url:'https://www.churchproduction.com/api/rss/content.rss',status:'needs_verification',permission_status:'review_required',permission_reference:null,priority:95};
const restricted={id:'src-musicradar',source_name:'MusicRadar',source_type:'media',feed_url:'https://www.musicradar.com/feeds.xml',status:'permission_required',permission_status:'review_required',permission_reference:null,priority:95};
const community={id:'com-reddit',source_name:'Reddit',source_type:'community',feed_url:null,status:'pending_authorization',permission_status:'pending_authorization'};
const registry=[active,pending,restricted,community];
const logs=[];
class Statement{
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async all(){
    if(this.sql.includes('FROM source_registry ORDER BY priority DESC,source_name ASC'))return {results:registry};
    if(this.sql.includes('FROM source_runs GROUP BY source_name'))return {results:[{source_name:'Gearnews',runs_30d:2,successes_30d:2,failures_30d:0}]};
    if(this.sql.includes('FROM articles GROUP BY source_name'))return {results:[]};
    if(this.sql.includes('FROM source_feed_checks ORDER BY checked_at'))return {results:logs};
    return {results:[]};
  }
  async first(){if(this.sql.includes('FROM source_registry WHERE id=?'))return registry.find(x=>x.id===this.args[0])||null;return {count:0};}
  async run(){
    if(this.sql.startsWith('INSERT INTO source_feed_checks')){
      const [id,source_id,source_name,checked_at,success,http_status,parsed_items,error_message]=this.args;
      logs.unshift({source_name,checked_at,success,http_status,parsed_items,error_message});
    }
    return {meta:{changes:1}};
  }
}
const env={FEED_TOKEN:'test-token',DB:{prepare:sql=>new Statement(sql)}};
const headers={Authorization:'Bearer test-token','Content-Type':'application/json'};
const request=(url,init={})=>worker.fetch(new Request('https://worker.test'+url,{headers,...init}),env);
const unauth=await worker.fetch(new Request('https://worker.test/api/admin/v3/media-activation'),env);
assert(unauth.status===401,'activation queue requires token');
const q=await request('/api/admin/v3/media-activation');const list=await q.json();
assert(q.status===200&&list.version==='3.0.5','queue returned');
assert(list.sources.length===3,'community excluded from media queue');
assert(list.sources.find(x=>x.sourceName==='Church Production').stage==='permission_review','candidate remains unapproved');
assert(list.sources.find(x=>x.sourceName==='Gearnews').stage==='collecting','historical success shown');
const fetched=[];const real=globalThis.fetch;
globalThis.fetch=async url=>{
  fetched.push(String(url));
  return new Response(`<?xml version="1.0"?><rss><channel><item><title>Shure wireless microphone</title><link>https://media.test/shure</link><pubDate>Thu, 26 Nov 2026 12:00:00 GMT</pubDate><description>Wireless</description></item></channel></rss>`,{status:200,headers:{'Content-Type':'application/rss+xml'}});
};
try{
  const blocked=await request('/api/admin/v3/sources/check-feed',{method:'POST',body:JSON.stringify({id:'src-church-production'})});
  assert(blocked.status===403&&fetched.length===0,'unapproved candidate not fetched');
  const restrictedResult=await request('/api/admin/v3/sources/check-feed',{method:'POST',body:JSON.stringify({id:'src-musicradar'})});
  assert(restrictedResult.status===403&&fetched.length===0,'restricted publisher not fetched');
  const good=await request('/api/admin/v3/sources/check-feed',{method:'POST',body:JSON.stringify({id:'src-gearnews'})});
  const j=await good.json();assert(good.status===200&&j.ok&&j.parsedItems===1,'approved RSS check succeeds');
  assert(fetched.length===1&&fetched[0]===active.feed_url,'only registered active feed accessed');
  globalThis.fetch=async url=>{fetched.push(String(url));return new Response('<html><title>Access denied</title></html>',{status:200,headers:{'Content-Type':'text/html'}});};
  const bad=await request('/api/admin/v3/sources/check-feed',{method:'POST',body:JSON.stringify({id:'src-gearnews'})});
  const bj=await bad.json();assert(bad.status===502&&!bj.ok&&/not RSS\/Atom/.test(bj.error),'HTTP200 HTML rejected');
  const checks=await request('/api/admin/v3/source-feed-checks');const cj=await checks.json();
  assert(checks.status===200&&cj.checks.length===2&&cj.checks[0].success===0,'feed-check audit history saved');
} finally {globalThis.fetch=real;}
console.log('V3.0.5 media activation queue, protected feed checks, and HTML failure tests passed.');
