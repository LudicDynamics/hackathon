// Seat gateway: the AIRP server holds one active world per process, so each
// player gets a whole container ("seat"). This proxy pins a browser to a seat
// by cookie, turns visitors away when every seat is taken, and restarts a seat
// before handing it to someone new so nobody inherits another player's save.
import http from 'node:http';
import net from 'node:net';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.PORT ?? 8870);
// A seat with no open WebSocket is released after GRACE_MS; any seat is
// released after IDLE_MS without traffic from its player, even with a tab open.
const GRACE_MS = Number(process.env.GRACE_MS ?? 3 * 60_000);
const IDLE_MS = Number(process.env.IDLE_MS ?? 30 * 60_000);
// The app opens its WebSocket right after load; a claim that never does
// (crawler, health check, curl) gives the seat back quickly.
const PROBE_MS = Number(process.env.PROBE_MS ?? 45_000);
const COOKIE = 'airp_seat';
// The public URL prefix the host nginx strips, so the cookie stays on this app.
const COOKIE_PATH = process.env.COOKIE_PATH ?? '/';

const seats = (process.env.SEATS ?? 'airp-seat-1:80,airp-seat-2:80').split(',').map((entry) => {
  const [host, port] = entry.trim().split(':');
  // `dirty` forces a restart before first use: the gateway cannot know what a
  // running seat already holds.
  return { host, port: Number(port ?? 80), owner: null, lastSeen: 0, sockets: 0, everConnected: false, ready: false, dirty: true };
});

const now = () => Date.now();
const tokenOf = (req) => /(?:^|;\s*)airp_seat=([\w-]+)/.exec(req.headers.cookie ?? '')?.[1];
const released = (seat) => {
  const idle = now() - seat.lastSeen;
  return !seat.owner || idle > IDLE_MS || (seat.sockets === 0 && idle > (seat.everConnected ? GRACE_MS : PROBE_MS));
};

function dockerRestart(name) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: '/var/run/docker.sock', path: `/containers/${name}/restart?t=5`, method: 'POST' }, (res) => {
      res.resume();
      res.statusCode < 300 ? resolve() : reject(new Error(`docker restart ${name}: ${res.statusCode}`));
    });
    req.on('error', reject);
    req.end();
  });
}

function probe(seat) {
  return new Promise((resolve) => {
    const req = http.get({ host: seat.host, port: seat.port, path: '/api/worlds', timeout: 3000 }, (res) => { res.resume(); resolve(res.statusCode === 200); });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function reset(seat) {
  seat.ready = false;
  try {
    await dockerRestart(seat.host);
    for (let i = 0; i < 60 && !(await probe(seat)); i++) await new Promise((r) => setTimeout(r, 1000));
    seat.ready = await probe(seat);
  } catch (error) {
    console.error(error);
  }
  if (!seat.ready) seat.dirty = true;
}

/** The caller's seat, claiming a released one when allowed; null otherwise. */
function seatFor(token, mayClaim) {
  const own = seats.find((seat) => seat.owner === token);
  if (own || !mayClaim) return own ?? null;
  const free = seats.find(released);
  if (!free) return null;
  const needsReset = free.dirty || free.owner !== null;
  Object.assign(free, { owner: token, lastSeen: now(), sockets: 0, everConnected: false, dirty: false });
  if (needsReset) void reset(free);
  return free;
}

const PAGE_STYLE = 'body{margin:0;min-height:100vh;display:grid;place-items:center;background:#16140f;color:#e9e1cf;font:16px/1.7 system-ui,sans-serif;text-align:center;padding:0 16px}p{margin:.3em 0}small{opacity:.6}';
const page = (lines, refresh) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="${refresh}"><title>AIRP</title><style>${PAGE_STYLE}</style><main>${lines.map((l) => `<p>${l}</p>`).join('')}<small>${refresh}s</small></main>`;
const FULL = page(['现在玩家已满，请稍后再来。', 'ただいま満席です。しばらくしてからお越しください。', 'All seats are taken. Please come back shortly.'], 20);
const WARMING = page(['正在为你准备世界…', 'ワールドを準備しています…', 'Preparing your world…'], 3);

function send(res, status, body, cookie) {
  const isHtml = body.startsWith('<!doctype');
  res.writeHead(status, { 'content-type': isHtml ? 'text/html; charset=utf-8' : 'application/json', 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.url === '/__seats') {
    return send(res, 200, JSON.stringify(seats.map((s) => ({ taken: !released(s), ready: s.ready, sockets: s.sockets, idleSec: s.owner ? Math.round((now() - s.lastSeen) / 1000) : null }))));
  }
  const token = tokenOf(req) ?? randomUUID();
  const cookie = tokenOf(req) ? undefined : `${COOKIE}=${token}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Lax; Max-Age=86400`;
  const wantsPage = (req.headers.accept ?? '').includes('text/html');
  // Only a page navigation may claim a seat; stray asset or API requests may not.
  const seat = seatFor(token, wantsPage);
  if (!seat) return send(res, 503, wantsPage ? FULL : JSON.stringify({ code: 'no_seat', error: 'Open the page to take a seat.' }), cookie);
  seat.lastSeen = now();
  if (!seat.ready) return send(res, 503, wantsPage ? WARMING : JSON.stringify({ code: 'seat_warming', error: 'Seat is starting.' }), cookie);

  const upstream = http.request({ host: seat.host, port: seat.port, method: req.method, path: req.url, headers: req.headers }, (upRes) => {
    const headers = { ...upRes.headers };
    if (cookie) headers['set-cookie'] = [...[headers['set-cookie'] ?? []].flat(), cookie];
    res.writeHead(upRes.statusCode ?? 502, headers);
    upRes.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) send(res, 502, wantsPage ? WARMING : JSON.stringify({ code: 'seat_unreachable' })); else res.destroy(); });
  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  const token = tokenOf(req);
  const seat = token && seats.find((s) => s.owner === token && s.ready);
  if (!seat) { socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n'); return; }
  const upstream = net.connect(seat.port, seat.host, () => {
    const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstream.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head.length) upstream.write(head);
    socket.pipe(upstream).pipe(socket);
  });
  seat.sockets++;
  seat.everConnected = true;
  seat.lastSeen = now();
  socket.on('data', () => { if (seat.owner === token) seat.lastSeen = now(); });
  let closed = false;
  const close = () => { if (closed) return; closed = true; seat.sockets = Math.max(0, seat.sockets - 1); socket.destroy(); upstream.destroy(); };
  socket.on('error', close).on('close', close);
  upstream.on('error', close).on('close', close);
});

server.listen(PORT, () => console.log(`seat gateway on :${PORT} → ${seats.map((s) => `${s.host}:${s.port}`).join(', ')}`));
