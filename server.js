// DAWRA server: static files + farmer accounts API (no dependencies)
// Run: node server.js  →  http://localhost:8766
// Data is stored in data/db.json (passwords hashed with scrypt + salt).
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = __dirname, PORT = process.env.PORT || 8766;
const DB_FILE = path.join(ROOT, 'data', 'db.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };
const SESSION_DAYS = 30;

// ---------- tiny JSON database ----------
let db = { users: {}, sessions: {} };
try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { /* first run */ }
function save() {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db, null, 1));
    fs.renameSync(DB_FILE + '.tmp', DB_FILE);
    return true;
  } catch (e) { console.error('DB write failed:', e.message); return false; }
}
db.users = db.users || {}; db.sessions = db.sessions || {};
// drop expired sessions at start-up
Object.keys(db.sessions).forEach(k => { if (db.sessions[k].exp < Date.now()) delete db.sessions[k]; });

const hash = (pin, salt) => crypto.scryptSync(pin, salt, 32).toString('hex');

// Demo farmer (0700000001 / 2468) is always available, even on a fresh host where data/ starts empty
if (!db.users['0700000001']) {
  const salt = crypto.randomBytes(16).toString('hex'), now = new Date().toISOString();
  db.users['0700000001'] = {
    name: 'فاطمة الزهراء', phone: '0700000001', salt, hash: hash('2468', salt), created: now,
    profile: {
      field: { lat: 32.512, lng: -6.701 }, place: 'أولاد عياد', area: 4, soil: 'clay',
      well: true, wellState: 'weak', wellDepth: 'deep', canal: true, waterLevel: 2, method: 'gravity',
      crops: { main: ['beet', 'durum', 'durum'], summer: ['none', 'maize', 'none'] },
      cont: 'yes', stopReason: null, trees: ['olive'], fert: 'chem', pest: 'some', livestock: true,
      prio: ['water', 'income', 'soil', 'forage'], complete: true, updated: now
    }
  };
  save();
}

// ---------- profile validation (never store arbitrary client JSON) ----------
const CROP_IDS = ['durum', 'soft', 'barley', 'faba', 'chickpea', 'lentil', 'pea', 'vetchoat', 'berseem', 'alfalfa', 'beet', 'quinoa', 'rapeseed', 'sunflower', 'cumin', 'coriander', 'fallow'];
const SUMMER_IDS = ['none', 'maize', 'sorghum'];
const one = (v, list) => list.includes(v) ? v : null;
const bool = v => v === true ? true : v === false ? false : null;
const num = (v, a, b) => { v = Number(v); return Number.isFinite(v) && v >= a && v <= b ? v : null; };
const clean = s => String(s || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 80);
function sanitizeProfile(p) {
  const f = p.field || {};
  const lat = num(f.lat, 20, 37), lng = num(f.lng, -18, 0); // Morocco bounding box (incl. southern provinces)
  const crops = p.crops || {};
  const main = Array.isArray(crops.main) && crops.main.length === 3 ? crops.main.map(x => one(x, CROP_IDS)) : null;
  const summer = Array.isArray(crops.summer) && crops.summer.length === 3 ? crops.summer.map(x => one(x, SUMMER_IDS)) : null;
  const prio = Array.isArray(p.prio) ? [...new Set(p.prio.filter(x => ['water', 'income', 'soil', 'forage'].includes(x)))] : [];
  const trees = Array.isArray(p.trees) ? [...new Set(p.trees.filter(x => ['olive', 'almond', 'citrus', 'pomegranate', 'none'].includes(x)))] : [];
  const out = {
    field: lat !== null && lng !== null ? { lat, lng } : null,
    place: clean(p.place), area: num(p.area, 0.01, 5000),
    soil: one(p.soil, ['clay', 'loam', 'sandy', 'stony', 'salty', 'unknown']),
    well: bool(p.well), wellState: one(p.wellState, ['good', 'weak', 'dry']), wellDepth: one(p.wellDepth, ['shallow', 'medium', 'deep']),
    canal: bool(p.canal), waterLevel: num(p.waterLevel, 1, 4) || 2, method: one(p.method, ['gravity', 'drip']) || 'gravity',
    crops: main && summer && !main.includes(null) && !summer.includes(null) ? { main, summer } : null,
    cont: one(p.cont, ['yes', 'no', 'unsure']), stopReason: one(p.stopReason, ['water', 'price', 'disease', 'try']),
    trees, fert: one(p.fert, ['chem', 'manure', 'both', 'none']), pest: one(p.pest, ['often', 'some', 'never']),
    livestock: bool(p.livestock), prio
  };
  const complete = !!(out.field && out.area && out.soil && out.well !== null && out.canal !== null && (!out.well || out.wellState) &&
    out.crops && out.cont && out.trees.length && out.fert && out.pest && out.livestock !== null && out.prio.length === 4);
  return { profile: { ...out, complete }, complete };
}

// per-IP limit on auth attempts: 30 per 15 min
const ipHits = {};
function ipLimited(ip) {
  const h = ipHits[ip] || { n: 0, t: Date.now() };
  if (Date.now() - h.t > 15 * 60e3) { h.n = 0; h.t = Date.now(); }
  h.n++; ipHits[ip] = h;
  return h.n > 30;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://server.arcgisonline.com https://cdnjs.cloudflare.com",
    "connect-src 'self' https://power.larc.nasa.gov https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com https://server.arcgisonline.com",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"
  ].join('; ')
};
const normPhone = p => String(p || '').replace(/[^\d+]/g, '').replace(/^\+212/, '0').replace(/^00212/, '0');
const publicUser = u => ({ name: u.name, phone: u.phone, created: u.created, profile: u.profile || null });

// simple brute-force protection: max 8 failed logins per phone per 15 min
const fails = {};
function tooMany(phone) {
  const f = fails[phone];
  return f && f.n >= 8 && Date.now() - f.t < 15 * 60e3;
}
function addFail(phone) {
  const f = fails[phone] || { n: 0, t: Date.now() };
  if (Date.now() - f.t > 15 * 60e3) { f.n = 0; f.t = Date.now(); }
  f.n++; fails[phone] = f;
}

function newSession(phone) {
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { phone, exp: Date.now() + SESSION_DAYS * 864e5 };
  // keep at most 5 sessions per farmer
  const mine = Object.keys(db.sessions).filter(k => db.sessions[k].phone === phone).sort((a, b) => db.sessions[a].exp - db.sessions[b].exp);
  while (mine.length > 5) delete db.sessions[mine.shift()];
  return token;
}
function auth(req) {
  const m = (req.headers.authorization || '').match(/^Bearer ([a-f0-9]{48})$/);
  if (!m) return null;
  const s = db.sessions[m[1]];
  if (!s || s.exp < Date.now()) return null;
  return { token: m[1], user: db.users[s.phone] };
}

function send(res, code, obj) {
  res.writeHead(code, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 200e3) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
  });
}

async function api(req, res, p) {
  try {
    // behind the HTTPS tunnel (127.0.0.1) or Render's proxy, every request comes from the proxy: use the forwarded client address
    const remote = req.socket.remoteAddress || '?';
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const behindProxy = process.env.RENDER || remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
    const ip = behindProxy && fwd ? fwd.slice(0, 64) : remote;
    if ((p === '/api/register' || p === '/api/login') && req.method === 'POST' && ipLimited(ip)) return send(res, 429, { error: 'locked' });
    if (req.method !== 'GET' && !String(req.headers['content-type'] || '').startsWith('application/json')) return send(res, 415, { error: 'type' });
    if (p === '/api/register' && req.method === 'POST') {
      const b = await body(req);
      const phone = normPhone(b.phone), name = clean(b.name).slice(0, 60), pin = String(b.pin || '');
      if (!/^0[5-7]\d{8}$/.test(phone)) return send(res, 400, { error: 'phone' });
      if (name.length < 2) return send(res, 400, { error: 'name' });
      if (!/^\d{4,8}$/.test(pin)) return send(res, 400, { error: 'pin' });
      if (db.users[phone]) return send(res, 409, { error: 'exists' });
      const salt = crypto.randomBytes(16).toString('hex');
      db.users[phone] = { name, phone, salt, hash: hash(pin, salt), created: new Date().toISOString(), profile: null };
      const token = newSession(phone);
      if (!save()) return send(res, 500, { error: 'storage' });
      return send(res, 201, { token, user: publicUser(db.users[phone]) });
    }
    if (p === '/api/login' && req.method === 'POST') {
      const b = await body(req);
      const phone = normPhone(b.phone), pin = String(b.pin || '');
      if (tooMany(phone)) return send(res, 429, { error: 'locked' });
      const u = db.users[phone];
      if (!u || !crypto.timingSafeEqual(Buffer.from(hash(pin, u.salt), 'hex'), Buffer.from(u.hash, 'hex'))) {
        addFail(phone); return send(res, 401, { error: 'wrong' });
      }
      delete fails[phone];
      const token = newSession(phone); save();
      return send(res, 200, { token, user: publicUser(u) });
    }
    const a = auth(req);
    if (!a || !a.user) return send(res, 401, { error: 'auth' });
    if (p === '/api/me' && req.method === 'GET') return send(res, 200, { user: publicUser(a.user) });
    if (p === '/api/profile' && req.method === 'PUT') {
      const b = await body(req);
      if (!b.profile || typeof b.profile !== 'object') return send(res, 400, { error: 'profile' });
      const { profile, complete } = sanitizeProfile(b.profile);
      if (!complete) return send(res, 400, { error: 'profile' });
      a.user.profile = { ...profile, updated: new Date().toISOString() };
      if (!save()) return send(res, 500, { error: 'storage' });
      return send(res, 200, { user: publicUser(a.user) });
    }
    if (p === '/api/logout' && req.method === 'POST') { delete db.sessions[a.token]; save(); return send(res, 200, { ok: true }); }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    return send(res, 400, { error: 'bad request' });
  }
}

// Only these public files can ever be served (data/, server.js, .claude/ etc. are never reachable)
const PUBLIC = /^(index\.html|manifest\.json|sw\.js|README\.md|(css|js|icons)\/[a-z0-9_-]+\.(css|js|svg|png))$/i;

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400, SECURITY_HEADERS); return res.end('Bad request'); }
  if (p.startsWith('/api/')) return api(req, res, p);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SECURITY_HEADERS); return res.end(); }
  if (p === '/') p = '/index.html';
  const rel = p.replace(/^\/+/, '');
  if (!PUBLIC.test(rel) || rel.includes('..')) { res.writeHead(404, SECURITY_HEADERS); return res.end('Not found'); }
  const file = path.join(ROOT, rel);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, SECURITY_HEADERS); return res.end('Not found'); }
    res.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('DAWRA running on http://localhost:' + PORT);
  // addresses other devices on the same Wi-Fi can use
  const nets = require('os').networkInterfaces();
  Object.keys(nets).forEach(name => (nets[name] || []).forEach(n => {
    if (n.family === 'IPv4' && !n.internal) console.log('LAN: http://' + n.address + ':' + PORT + '  (' + name + ')');
  }));
});
