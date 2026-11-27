import worker from '../src/index.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class MockStatement {
  constructor(sql, db) { this.sql = sql; this.db = db; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    if (this.sql.includes("source_type FROM source_registry")) return { source_type: this.db.retailSourceType, status: this.db.retailStatus, permission_status: this.db.retailPermission };
    return { count: 0 };
  }
  async all() { return { results: [] }; }
  async run() { return { meta: { changes: 1 } }; }
}
class MockDB {
  constructor() { this.retailSourceType = 'retailer'; this.retailStatus = 'permission_required'; this.retailPermission = 'not_authorized'; }
  prepare(sql) { return new MockStatement(sql, this); }
}

const env = { FEED_TOKEN: 'test-token', DB: new MockDB() };
const health = await worker.fetch(new Request('https://worker.test/health'), env);
const healthJson = await health.json();
assert(health.status === 200 && healthJson.version === '3.0.3', 'health version must be 3.0.3');
assert(healthJson.translationEnabled === false, 'translation must remain disabled');
assert(healthJson.features.redditStatus === 'pending_authorization', 'Reddit must remain pending authorization');

const translate = await worker.fetch(new Request('https://worker.test/api/admin/translate', {
  method: 'POST', headers: { Authorization: 'Bearer test-token' }
}), env);
assert(translate.status === 410, 'machine translation endpoint must remain disabled');

const unauthorized = await worker.fetch(new Request('https://worker.test/api/admin/v3/summary'), env);
assert(unauthorized.status === 401, 'V3 admin endpoints must require FEED_TOKEN');

const summary = await worker.fetch(new Request('https://worker.test/api/admin/v3/summary', {
  headers: { Authorization: 'Bearer test-token' }
}), env);
assert(summary.status === 200, 'authorized V3 summary should respond');

const retailBlocked = await worker.fetch(new Request('https://worker.test/api/admin/v3/retail-observations', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ sourceId: 'ret-sweetwater', productName: 'Test', productUrl: 'https://retailer.test/item', currency: 'USD', permissionReference: 'none' })
}), env);
assert(retailBlocked.status === 403, 'retail ingestion must be blocked until source authorization');

console.log('V3.0.3 Worker smoke tests passed.');
