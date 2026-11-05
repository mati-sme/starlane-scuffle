// Runs worker/room.js (the GameRoom Durable Object) on a plain Node WebSocket server, for tests without wrangler.
// Usage: const { url, close } = await startLocalRooms(); -> ws://127.0.0.1:<port>   (needs the `ws` package: set WS_DIR)
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { WebSocketServer } = require(require.resolve('ws', { paths: [process.env.WS_DIR ?? '/tmp/wsdep/node_modules', process.cwd()] }));

export async function startLocalRooms() {
  const src = readFileSync(resolve(fileURLToPath(import.meta.url), '../../worker/room.js'), 'utf8')
    .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }');
  globalThis.WebSocketRequestResponsePair = class {};
  const file = join(mkdtempSync(join(tmpdir(), 'room-')), 'room.mjs');
  writeFileSync(file, src);
  const { GameRoom } = await import(pathToFileURL(file).href);

  const rooms = new Map();
  const roomFor = (code) => {
    if (rooms.has(code)) return rooms.get(code);
    const store = new Map(), sockets = new Set();
    const ctx = {
      storage: { get: async (k) => store.get(k), put: async (k, v) => { store.set(k, structuredClone(v)); }, deleteAll: async () => store.clear(), setAlarm: async () => {}, deleteAlarm: async () => {} },
      blockConcurrencyWhile: (fn) => fn(),
      setWebSocketAutoResponse() {},
      acceptWebSocket: (w) => sockets.add(w),
      getWebSockets: () => [...sockets],
    };
    const room = new GameRoom(ctx, {});
    const r = { room, sockets };
    rooms.set(code, r);
    return r;
  };

  const http = createServer((req, res) => res.writeHead(200, { 'content-type': 'application/json' }).end('{"ok":true}'));
  const wss = new WebSocketServer({ server: http });
  wss.on('connection', (raw, req) => {
    const code = (req.url.match(/\/room\/([A-Za-z0-9]{4})/)?.[1] ?? 'XXXX').toUpperCase();
    const { room, sockets } = roomFor(code);
    let att = { code, token: null };
    const w = {
      get readyState() { return raw.readyState; },
      send: (m) => raw.send(m), close: () => { try { raw.close(); } catch {} },
      serializeAttachment: (a) => { att = a; }, deserializeAttachment: () => att,
    };
    sockets.add(w);
    raw.on('message', (d) => { Promise.resolve(room.webSocketMessage(w, d.toString())).catch((e) => console.error('room error', e)); });
    raw.on('close', () => { Promise.resolve(room.webSocketClose(w)).then(() => sockets.delete(w)); });
  });
  await new Promise((r) => http.listen(0, '127.0.0.1', r));
  return { url: `ws://127.0.0.1:${http.address().port}`, close: () => { wss.close(); http.close(); } };
}
