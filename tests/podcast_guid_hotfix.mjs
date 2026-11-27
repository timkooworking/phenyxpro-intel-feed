import worker, {__test} from '../src/index.js';
function assert(condition,message){ if(!condition)throw Error(message); }
const signalFeed='https://rss.buzzsprout.com/748181.rss';
const churchFeed='https://rss.buzzsprout.com/894865.rss';
function feed(show){
  return `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Podcast</title><link>https://www.buzzsprout.com/${show}</link>
  <item><itunes:title>Episode 150</itunes:title><title>150. Wireless Systems &amp; RF Basics</title><description><![CDATA[<p>Shure wireless antennas and IEMs</p>]]></description><enclosure url="https://cdn.buzzsprout.com/${show}/dummy.mp3" type="audio/mpeg"/><guid isPermaLink="false">Buzzsprout-18989590</guid><pubDate>Thu, 26 Nov 2026 12:00:00 GMT</pubDate></item>
  <item><title>149. Vocal Mixing</title><guid isPermaLink="false">Buzzsprout-18989591</guid><pubDate>Wed, 25 Nov 2026 12:00:00 GMT</pubDate><enclosure url="https://cdn.buzzsprout.com/${show}/second.mp3" type="audio/mpeg"/></item>
  </channel></rss>`;
}
for(const [id,url] of [['748181',signalFeed],['894865',churchFeed]]){
  const parsed=__test.inspectFeedXml(feed(id),{feedContentMode:'podcast_metadata',feedUrl:url});
  assert(parsed.declared===2 && parsed.items.length===2,'Buzzsprout GUID-only items must parse as two episodes');
  assert(parsed.items.every(x=>x.url.startsWith(`https://www.buzzsprout.com/${id}/episodes/`)),'fallback must use public episode pages');
  assert(parsed.items[0].url.includes('/18989590-150-wireless-systems-and-rf-basics'),'fallback must preserve episode ID and generate readable slug');
  assert(parsed.items.every(x=>!x.url.includes('.mp3') && !x.url.includes('cdn.')),'never store enclosure audio URLs as canonical links');
}
const normalXml='<rss><channel><item><title>Story</title><link>https://media.example.test/story</link><guid>Buzzsprout-999</guid></item></channel></rss>';
assert(__test.inspectFeedXml(normalXml).items[0].url==='https://media.example.test/story','legacy normal article links unchanged');
const broken='<rss><channel><item><title>Episode</title><guid isPermaLink="false">opaque-uuid</guid><enclosure url="https://example.test/audio.mp3"/></item></channel></rss>';
let rejected=false;
try{__test.inspectFeedXml(broken,{feedContentMode:'podcast_metadata',feedUrl:signalFeed});}catch(e){rejected=/no.*parsable.*link/i.test(String(e));}
assert(rejected,'arbitrary nonpermalink GUIDs should not become fabricated or audio URLs');
const calls=[];
const oldFetch=globalThis.fetch;
globalThis.fetch=async u=>{calls.push(String(u)); return new Response(feed('748181'),{status:200,headers:{'Content-Type':'text/xml; charset=utf-8'}});};
const env={
  FEED_TOKEN:'unit-test-token',
  DB:{prepare(sql){return {bind(...args){this.args=args;return this;},async first(){return{id:'src-signal',source_name:'Signal To Noise',source_type:'media',feed_url:signalFeed,status:'active',permission_status:'approved_public_feed',feed_content_mode:'podcast_metadata'};},async run(){return{meta:{changes:1}};}};}}
};
try{
  const res=await worker.fetch(new Request('https://worker.test/api/admin/v3/sources/check-feed',{
    method:'POST',headers:{Authorization:'Bearer unit-test-token','Content-Type':'application/json'},body:JSON.stringify({id:'src-signal'})
  }),env);
  const data=await res.json();
  assert(res.status===200&&data.ok===true&&data.httpStatus===200&&data.parsedItems===2,'live preflight must parse Buzzsprout GUID-only items');
  assert(calls.length===1 && calls[0]===signalFeed,'preflight fetches only registered RSS XML and no enclosures');
}finally{globalThis.fetch=oldFetch;}
console.log('Buzzsprout GUID-only RSS fallback, safety and Worker preflight tests passed.');
