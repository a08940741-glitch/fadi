// DAWRA server: serves the static app files only (no accounts, no database, no dependencies).
// Each farmer's answers stay in their own browser (localStorage).
// Run: node server.js  →  http://localhost:8766
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = __dirname, PORT = process.env.PORT || 8766;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.md': 'text/plain; charset=utf-8' };

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
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

// Only these public files can ever be served (server.js, data/, .git/, .claude/ etc. are never reachable)
const PUBLIC = /^(index\.html|manifest\.json|sw\.js|README\.md|(css|js|icons)\/[a-z0-9_-]+\.(css|js|svg|png))$/i;

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { res.writeHead(400, SECURITY_HEADERS); return res.end('Bad request'); }
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
