const fs = require('node:fs');
const path = require('node:path');
const seed = require('./seed.json');
function failure(status, message) { return Object.assign(new Error(message), { status }); }
function createStorage({ hosted, dataDir, redisURL, redisToken }) {
  const cloud = !!(redisURL && redisToken);
  if (cloud && !/^https:\/\/[a-zA-Z0-9-]+\.upstash\.io\/?$/.test(redisURL)) throw new Error('Storage must use an HTTPS Upstash endpoint.');
  const writable = !hosted || cloud, file = path.join(dataDir, 'store.json'), key = 'funloof:store:v1';
  if (!hosted) { fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 }); if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(seed, null, 2), { mode: 0o600 }); }
  async function command(args) {
    const response = await fetch(redisURL, { method: 'POST', headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args), signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw failure(503, 'Storage is temporarily unavailable. Please retry.');
    const result = await response.json();
    if (result.error) throw failure(503, 'Storage is temporarily unavailable. Please retry.');
    return result.result;
  }
  async function raw() { if (cloud) return await command(['GET', key]); if (hosted) return null; return fs.readFileSync(file, 'utf8'); }
  let queue = Promise.resolve();
  async function mutate(fn) {
    if (!writable) throw failure(503, 'Online catalogue editing needs a connected database. The storefront is in read-only preview mode.');
    if (cloud) {
      // Compare-and-set prevents lost edits and overselling across function instances.
      for (let attempt = 0; attempt < 6; attempt++) {
        const previous = await raw(), state = previous ? JSON.parse(previous) : structuredClone(seed), result = fn(state);
        const saved = await command(['EVAL', "local current=redis.call('GET',KEYS[1]); if (not current and ARGV[1]=='') or current==ARGV[1] then redis.call('SET',KEYS[1],ARGV[2]); return 1 end; return 0", 1, key, previous || '', JSON.stringify(state)]);
        if (saved === 1) return result;
      }
      throw failure(409, 'Another update happened at the same time. Please try again.');
    }
    const task = queue.then(async () => { const state = JSON.parse(await raw()), result = fn(state), tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 }); fs.renameSync(tmp, file); return result; });
    queue = task.catch(() => {}); return task;
  }
  const limits = new Map();
  async function rateLimit(keyName, max, seconds) {
    if (cloud) { const n = await command(['EVAL', "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n", 1, 'funloof:limit:' + keyName, String(seconds)]); return n <= max; }
    const now = Date.now();
    if (limits.size > 5000) for (const [k, v] of limits) if (v.until < now) limits.delete(k);
    const entry = limits.get(keyName);
    if (!entry || entry.until < now) { limits.set(keyName, { count: 1, until: now + seconds * 1000 }); return true; }
    return ++entry.count <= max;
  }
  return { writable, cloud, rateLimit, mutate, async read() { const value = await raw(); return value ? JSON.parse(value) : structuredClone(seed); } };
}
module.exports = { createStorage, failure };
