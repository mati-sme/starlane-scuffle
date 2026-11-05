// Starlane Scuffle edge entry: health at /, rooms at /room/{CODE} (WebSocket upgrade or JSON status) -> one GameRoom Durable Object per code.
export { GameRoom } from './room.js';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const CODE = /^[A-Z0-9]{4}$/;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/') return json({ ok: true, service: 'starlane-scuffle', rooms: '/room/{CODE}' });

    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{4})$/);
    if (!m) return json({ ok: false, error: 'not found' }, 404);
    const code = m[1].toUpperCase();
    if (!CODE.test(code)) return json({ ok: false, error: 'bad code' }, 400);

    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    const headers = new Headers(request.headers);
    headers.set('x-room-code', code);
    const res = await stub.fetch(new Request(request, { headers }));
    if (res.status === 101) return res; // WebSocket handshake: pass through untouched
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },
};
