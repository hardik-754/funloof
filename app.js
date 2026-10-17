const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { createStorage, failure } = require('./storage');
const ROOT = path.resolve(__dirname, '..');
const CATEGORIES = ['Wooden toys', 'Learning & activity', 'Vehicles & ride-ons', 'Soft toys', 'Arts & pretend play'];
const AGES = ['0–12 months', '1–3 years', '3–5 years', '6–10 years'];
const ARTS = ['rainbow', 'blocks', 'rocket', 'bunny', 'train', 'paint'];
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'";
function safeEqual(a, b) { const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest(); return crypto.timingSafeEqual(x, y); }
function string(value, max, required = true) { if (typeof value !== 'string' || value.length > max || required && !value.trim()) throw failure(400, 'Some fields are missing or too long.'); return value.trim(); }
function publicProduct(p) { const { id, name, category, age, price, mrp, stock, description, art, color, featured, image } = p; return { id, name, category, age, price, mrp, stock, description, art, color, featured, image }; }
function createApp(options = {}) {
  const env = options.env || process.env, hosted = options.hosted ?? !!(env.VERCEL || env.NODE_ENV === 'production');
  const storage = createStorage({ hosted, dataDir: options.dataDir || path.join(ROOT, 'data'), redisURL: env.UPSTASH_REDIS_REST_URL, redisToken: env.UPSTASH_REDIS_REST_TOKEN });
  let password = env.ADMIN_PASSWORD || '', secret = env.SESSION_SECRET || '';
  if (!hosted && !options.noLocalCredentials) {
    const local = options.localDir || path.join(ROOT, '.local'); fs.mkdirSync(local, { recursive: true, mode: 0o700 });
    function localSecret(name, size) { const f = path.join(local, name); if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(size).toString('base64url'), { mode: 0o600 }); return fs.readFileSync(f, 'utf8').trim(); }
    password ||= localSecret('admin-password.txt', 24); secret ||= localSecret('session-secret.txt', 48);
  }
  const authReady = password.length >= 16 && secret.length >= 32 && (!hosted || storage.cloud);
  const salt = crypto.createHash('sha256').update(secret).digest(), passwordHash = authReady ? crypto.scryptSync(password, salt, 64) : null;
  const cookieName = hosted ? '__Host-funloof_session' : 'funloof_session';
  function sign(body) { return crypto.createHmac('sha256', secret).update(body).digest('base64url'); }
  function authenticated(req) {
    if (!authReady) return false;
    const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!cookie || cookie.length > 1024) return false;
    const [body, signature, extra] = cookie.split('.'); if (!body || !signature || extra || !safeEqual(sign(body), signature)) return false;
    try { const session = JSON.parse(Buffer.from(body, 'base64url')); return session.exp > Date.now() && session.exp <= Date.now() + 8 * 3600000 && session.role === 'admin'; } catch { return false; }
  }
  function allowedHosts() {
    const hosts = new Set(hosted ? [] : ['127.0.0.1:4173', 'localhost:4173']);
    if (env.PORT && !hosted) { hosts.add(`127.0.0.1:${env.PORT}`); hosts.add(`localhost:${env.PORT}`); }
    for (const value of [env.SITE_ORIGIN, env.VERCEL_URL && 'https://' + env.VERCEL_URL, env.VERCEL_PROJECT_PRODUCTION_URL && 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL]) {
      if (value) try { const u = new URL(value); if (u.protocol === 'https:' || !hosted) hosts.add(u.host); } catch {}
    }
    return hosts;
  }
  function validOrigin(req) { try { const u = new URL(req.headers.origin); return allowedHosts().has(u.host) && u.host === req.headers.host && u.protocol === (hosted ? 'https:' : 'http:'); } catch { return false; } }
  async function body(req) {
    let raw = '', bytes = 0;
    if (req.body !== undefined) { raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body); bytes = Buffer.byteLength(raw); }
    else for await (const chunk of req) { bytes += chunk.length; if (bytes > 3000000) throw failure(413, 'Use a photo under 2 MB.'); raw += chunk; }
    if (bytes > 3000000) throw failure(413, 'Use a photo under 2 MB.');
    try { const parsed = JSON.parse(raw); if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw Error(); return parsed; } catch { throw failure(400, 'Invalid JSON request.'); }
  }
  function product(input) {
    const name = string(input.name, 100), description = string(input.description || '', 5000, false);
    if (input.id !== undefined && !/^[a-zA-Z0-9_-]{1,80}$/.test(input.id)) throw failure(400, 'Invalid product ID.');
    if (!CATEGORIES.includes(input.category) || !AGES.includes(input.age)) throw failure(400, 'Choose a valid category and age group.');
    if (![input.price, input.mrp].every(n => Number.isFinite(n) && n >= 0 && n <= 1000000 && Math.abs(n * 100 - Math.round(n * 100)) < 0.00001) || input.mrp < input.price || !Number.isInteger(input.stock) || input.stock < 0 || input.stock > 100000) throw failure(400, 'Enter valid prices (MRP ≥ price) and whole-number stock.');
    const image = input.image || ''; if (typeof image !== 'string') throw failure(400, 'Invalid image.');
    if (image) {
      const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image); if (!match) throw failure(400, 'Use a PNG, JPG, WebP or GIF image.');
      const bytes = Buffer.from(match[2], 'base64'), type = match[1]; if (bytes.length > 2 * 1024 * 1024) throw failure(413, 'Use a photo under 2 MB.');
      const valid = type === 'png' && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || type === 'jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 || type === 'gif' && /^GIF8[79]a/.test(bytes.subarray(0, 6).toString()) || type === 'webp' && bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
      if (!valid) throw failure(400, 'The image content does not match its format.');
    }
    if (input.color && !/^#[0-9a-fA-F]{6}$/.test(input.color)) throw failure(400, 'Invalid product colour.');
    return { id: input.id || crypto.randomUUID(), name, description, category: input.category, age: input.age, price: input.price, mrp: input.mrp, stock: input.stock, image, art: ARTS.includes(input.art) ? input.art : 'blocks', color: input.color || '#e8f3ef', featured: input.featured === true };
  }
  return async function handler(req, res) {
    const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };
    if (hosted) headers['Strict-Transport-Security'] = 'max-age=31536000';
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
    function json(code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
    try {
      if (!allowedHosts().has(req.headers.host)) return json(403, { error: 'Unrecognised host.' });
      const route = new URL(req.url, 'http://localhost').pathname, isAdmin = authenticated(req);
      const ip = hosted ? (req.headers['x-vercel-forwarded-for'] || req.socket?.remoteAddress || 'unknown') : req.socket?.remoteAddress || 'local';
      const clientKey = crypto.createHmac('sha256', secret || 'preview').update(String(ip)).digest('hex').slice(0, 32);
      const mutable = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      if (mutable && !validOrigin(req)) return json(403, { error: 'This request must come from this website.' });
      if (mutable && !/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) return json(415, { error: 'Use a JSON request.' });
      if (route === '/api/session' && req.method === 'GET') return json(200, { authenticated: isAdmin, configured: authReady, writable: storage.writable, hosted });
      if (route === '/api/login' && req.method === 'POST') {
        if (!authReady) return json(503, { error: 'Online admin access requires a strong admin password, session secret and connected database.' });
        if (!await storage.rateLimit('login:' + clientKey, 5, 900)) return json(429, { error: 'Too many sign-in attempts. Try again in 15 minutes.' });
        const input = await body(req), attempt = string(input.password, 256);
        const hash = await new Promise((resolve, reject) => crypto.scrypt(attempt, salt, 64, (e, v) => e ? reject(e) : resolve(v)));
        if (!crypto.timingSafeEqual(hash, passwordHash)) return json(401, { error: 'The password is incorrect.' });
        const token = Buffer.from(JSON.stringify({ role: 'admin', exp: Date.now() + 8 * 3600000, nonce: crypto.randomBytes(16).toString('hex') })).toString('base64url');
        res.setHeader('Set-Cookie', `${cookieName}=${token}.${sign(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${hosted ? '; Secure' : ''}`);
        return json(200, { ok: true });
      }
      if (route === '/api/logout' && req.method === 'POST') { res.setHeader('Set-Cookie', `${cookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${hosted ? '; Secure' : ''}`); return json(200, { ok: true }); }
      if (route === '/api/store' && req.method === 'GET') { const state = await storage.read(); return json(200, { products: state.products.map(publicProduct), orders: [], mode: storage.writable ? 'demo' : 'preview' }); }
      if (route === '/api/admin/store' && req.method === 'GET') { if (!isAdmin) return json(401, { error: 'Sign in to access the shop dashboard.' }); return json(200, await storage.read()); }
      if ((route === '/api/products' || route.startsWith('/api/products/') || route.startsWith('/api/orders/')) && !isAdmin) return json(401, { error: 'Sign in to manage your shop.' });
      if (route === '/api/products' && req.method === 'POST') {
        const p = product(await body(req)); const saved = await storage.mutate(state => { const i = state.products.findIndex(x => x.id === p.id); if (i < 0) { if (state.products.length >= 250) throw failure(400, 'This demo supports up to 250 products.'); state.products.push(p); } else state.products[i] = p; return p; }); return json(200, saved);
      }
      if (/^\/api\/products\/[a-zA-Z0-9_-]{1,80}$/.test(route) && req.method === 'DELETE') { await storage.mutate(state => { const id = route.split('/').pop(); if (!state.products.some(p => p.id === id)) throw failure(404, 'Product not found.'); state.products = state.products.filter(p => p.id !== id); }); return json(200, { ok: true }); }
      if (route === '/api/orders' && req.method === 'POST') {
        if (!await storage.rateLimit('checkout:' + clientKey, 20, 3600)) return json(429, { error: 'Demo limit reached. Try again later.' });
        const input = await body(req);
        if (Object.keys(input).some(k => k !== 'items')) throw failure(400, 'Demo checkout accepts toy selections only. Do not send personal details.');
        if (!Array.isArray(input.items) || !input.items.length || input.items.length > 50) throw failure(400, 'Choose between 1 and 50 toy selections.');
        const grouped = new Map(); for (const item of input.items) { if (!item || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 100) throw failure(400, 'Invalid toy quantity.'); grouped.set(item.id, (grouped.get(item.id) || 0) + item.qty); }
        function makeOrder(state) {
          const items = []; for (const [id, qty] of grouped) { const p = state.products.find(p => p.id === id); if (!p || p.stock < qty || qty > 100) throw failure(409, 'A toy is unavailable or has insufficient stock. Please update your bag.'); items.push({ id, name: p.name, price: p.price, qty }); }
          const order = { id: 'FL-' + crypto.randomUUID(), name: 'Demo Customer', email: 'demo@example.com', address: 'Demo only — no delivery address collected.', items, total: Math.round(items.reduce((n, p) => n + p.price * p.qty, 0) * 100) / 100, status: 'New demo', date: new Date().toISOString() };
          for (const item of items) state.products.find(p => p.id === item.id).stock -= item.qty; state.orders.unshift(order); state.orders = state.orders.slice(0, 500); return order;
        }
        if (!storage.writable) { const order = makeOrder(await storage.read()); return json(200, { id: order.id, total: order.total, persisted: false }); }
        const order = await storage.mutate(makeOrder); return json(200, { id: order.id, total: order.total, persisted: true });
      }
      if (/^\/api\/orders\/[a-zA-Z0-9_-]{1,90}$/.test(route) && req.method === 'PUT') { const input = await body(req); if (!['New demo', 'Processing', 'Completed'].includes(input.status)) throw failure(400, 'Invalid status.'); const order = await storage.mutate(state => { const o = state.orders.find(o => o.id === route.split('/').pop()); if (!o) throw failure(404, 'Order not found.'); o.status = input.status; return o; }); return json(200, order); }
      if (route.startsWith('/api/')) return json(404, { error: 'Not found.' });
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed.' });
      const routes = { '/': 'index.html', '/admin': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css', '/assets/funloof-logo.png': 'assets/funloof-logo.png', '/favicon.svg': 'favicon.svg' };
      const relative = routes[route]; if (!relative) return json(404, { error: 'Not found.' });
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };
      const data = await fs.promises.readFile(path.join(ROOT, 'public', relative)); res.writeHead(200, { 'Content-Type': types[path.extname(relative)] }); res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) { options.onError?.(error); json(error.status || 500, { error: error.status ? error.message : 'Unable to complete this request. Please try again.' }); }
  };
}
module.exports = { createApp };
