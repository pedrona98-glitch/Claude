// Server del gioco online. Nessuna dipendenza: solo Node 20+.
//   node server/index.js            (porta 8787, dati in ./server-data/world.json)
//   PORT=8080 DATA_DIR=/data node server/index.js
// Tutti i dati vivono in memoria e vengono salvati su file a intervalli: basta per il lancio
// (qualche migliaio di giocatori attivi); oltre conviene passare a un database.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createWorld, emptyData, ApiError } from '../shared/social.js';

const PORT = Number(process.env.PORT) || 8787;
const DATA_DIR = process.env.DATA_DIR || path.resolve('server-data');
const FILE = path.join(DATA_DIR, 'world.json');
const SAVE_EVERY_MS = 30e3;
const MAX_BODY = 4096;
const RATE = { windowMs: 10e3, max: 60 }; // richieste per IP

fs.mkdirSync(DATA_DIR, { recursive: true });
let data = emptyData();
if (fs.existsSync(FILE)) data = { ...data, ...JSON.parse(fs.readFileSync(FILE, 'utf8')) };
const world = createWorld(data);

let dirty = false;
function save() {
  if (!dirty) return;
  dirty = false;
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(world.data));
  fs.renameSync(tmp, FILE); // scrittura atomica: mai un file a metà
}
setInterval(save, SAVE_EVERY_MS).unref();
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { dirty = true; save(); process.exit(0); });

const hits = new Map();
function limited(ip, now) {
  const h = hits.get(ip);
  if (!h || now - h.t > RATE.windowMs) { hits.set(ip, { t: now, n: 1 }); return false; }
  return ++h.n > RATE.max;
}
setInterval(() => { const now = Date.now(); for (const [ip, h] of hits) if (now - h.t > RATE.windowMs) hits.delete(ip); }, 60e3).unref();

const STATUS = { unauthorized: 401, not_found: 404, unknown_action: 404, too_fast: 429 };

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true, players: Object.keys(world.data.users).length, servers: world.data.servers.length });
  const match = req.method === 'POST' && /^\/api\/([a-z.]+)$/.exec(req.url);
  if (!match) return send(res, 404, { error: 'not_found' });
  const now = Date.now();
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;
  if (limited(ip, now)) return send(res, 429, { error: 'too_fast' });

  let body = '', tooBig = false;
  req.on('data', (chunk) => { body += chunk; if (body.length > MAX_BODY) { tooBig = true; req.destroy(); } });
  req.on('end', () => {
    if (tooBig) return;
    try {
      const payload = body ? JSON.parse(body) : {};
      const token = (req.headers.authorization || '').replace(/^Bearer /, '');
      const out = world.handle(token, match[1], payload, now);
      dirty = true;
      send(res, 200, out);
    } catch (err) {
      if (err instanceof ApiError) send(res, STATUS[err.code] || 400, { error: err.code });
      else if (err instanceof SyntaxError) send(res, 400, { error: 'bad_request' });
      else { console.error(err); send(res, 500, { error: 'server_error' }); }
    }
  });
});

server.listen(PORT, () => console.log(`Sky Squadron server in ascolto sulla porta ${PORT}, dati in ${FILE}`));
