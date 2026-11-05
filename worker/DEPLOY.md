# Deploy (Cloudflare MCP / API multipart upload)

Worker name: `starlane-scuffle` · account subdomain `mati-sme` · URL `https://starlane-scuffle.mati-sme.workers.dev`

## Files to upload (ES modules, main module = `worker.js`)

| part name   | file               | content type                  |
|-------------|--------------------|-------------------------------|
| `worker.js` | `worker/worker.js` | `application/javascript+module` |
| `room.js`   | `worker/room.js`   | `application/javascript+module` |
| `metadata`  | JSON below         | `application/json`            |

`wrangler.jsonc` and `README.md` are for wrangler users only; do not upload them.

## metadata part

```json
{
  "main_module": "worker.js",
  "compatibility_date": "2024-11-12",
  "bindings": [{ "type": "durable_object_namespace", "name": "ROOMS", "class_name": "GameRoom" }],
  "migrations": { "new_tag": "v1", "new_sqlite_classes": ["GameRoom"] }
}
```

First upload only needs the `migrations` block; later uploads of unchanged classes must omit it (or send `old_tag: "v1"`).

## After upload

1. Enable the workers.dev route: `POST /accounts/{account}/workers/scripts/starlane-scuffle/subdomain` with `{"enabled": true}`.
2. Check: `GET https://starlane-scuffle.mati-sme.workers.dev/` -> `{"ok":true,...}`; `GET /room/ABCD` -> `{"exists":false}`.
3. WebSocket check: connect to `wss://starlane-scuffle.mati-sme.workers.dev/room/ABCD`, send `{"t":"hello","create":true}` -> expect `welcome`.
