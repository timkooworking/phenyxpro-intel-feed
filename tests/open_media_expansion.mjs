import { __test } from '../src/index.js';

function assert(value, message) { if (!value) throw new Error(message); }

const makeItem = (n, day) => ({
  title: `Church Sound Podcast Episode ${n}`,
  url: `https://podcast.example.test/episodes/${n}`,
  date: `2026-11-${String(day).padStart(2,'0')}T12:00:00Z`,
  description: `Episode ${n} metadata summary`
});
const archive = Array.from({length:366}, (_,i)=>makeItem(i+1, (i%26)+1));
const selected20 = __test.selectNewestFeedItems(archive,20);
assert(selected20.length===20,'podcast archive should be capped to 20 entries');
assert(selected20[0].date >= selected20[19].date,'selected podcast items should be newest-first');
assert(__test.selectNewestFeedItems(archive,500).length===100,'hard cap must not exceed 100 items per run');
assert(__test.selectNewestFeedItems(archive,30).length===30,'Church Production configured cap should support 30');

const podcastXml = `<?xml version="1.0"?><rss version="2.0"><channel>
  <item><title>Episode One</title><link>https://podcast.example.test/one</link><pubDate>Thu, 26 Nov 2026 12:00:00 GMT</pubDate><description><![CDATA[Episode summary]]></description><enclosure url="https://cdn.example.test/audio.mp3" type="audio/mpeg" /></item>
  <item><title>Episode Two</title><link>https://podcast.example.test/two</link><pubDate>Wed, 25 Nov 2026 12:00:00 GMT</pubDate><description>Second summary</description><enclosure url="https://cdn.example.test/audio2.mp3" type="audio/mpeg" /></item>
  <item><title>Episode Three</title><link>https://podcast.example.test/three</link><pubDate>Tue, 24 Nov 2026 12:00:00 GMT</pubDate><description>Third summary</description><enclosure url="https://cdn.example.test/audio3.mp3" type="audio/mpeg" /></item>
</channel></rss>`;
const parsed = __test.parse(podcastXml);
assert(parsed.length===3,'podcast RSS items should parse');
assert(!('enclosure' in parsed[0]) && !('audioUrl' in parsed[0]),'parser must not expose podcast enclosure/audio URL');

const fetchCalls=[];
const realFetch=globalThis.fetch;
globalThis.fetch=async url=>{
  fetchCalls.push(String(url));
  return new Response(podcastXml,{status:200,headers:{'Content-Type':'text/xml; charset=utf-8'}});
};
class MockStatement {
  constructor(sql){this.sql=sql;this.args=[];}
  bind(...args){this.args=args;return this;}
  async run(){return {meta:{changes:1}};}
  async first(){return null;}
}
const env={DB:{prepare:sql=>new MockStatement(sql),batch:stmts=>Promise.all(stmts.map(stmt=>stmt.run()))}};
try {
  const result=await __test.collect({
    id:'src-test-podcast',name:'Test Podcast',url:'https://rss.example.test/show.rss',
    sourceType:'media',maxItems:2,feedContentMode:'podcast_metadata'
  },env,[]);
  assert(result.seen===2,'collector must apply source-specific podcast cap');
  assert(result.added===2,'collector should insert only capped metadata entries');
  assert(fetchCalls.length===1 && fetchCalls[0]==='https://rss.example.test/show.rss','collector must fetch feed XML only, never enclosure audio');
  assert(!fetchCalls.some(x=>x.includes('/audio')),'no audio URLs may be fetched');
} finally { globalThis.fetch=realFetch; }

console.log('V3.0.3 open media feed parsing, newest-first caps and podcast metadata-only tests passed.');
