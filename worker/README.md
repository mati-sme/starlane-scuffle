# Starlane Scuffle online worker

Cloudflare Worker + one Durable Object (`GameRoom`) per 4-character room code. Free tier, SQLite-backed DO, WebSocket **hibernation**
(`ctx.acceptWebSocket`, `webSocketMessage/Close/Error`, `setWebSocketAutoResponse('ping' -> 'pong')`).

| file | role |
|------|------|
| `worker.js` | `GET /` health; `/room/{CODE}` (code uppercased) -> DO by name; WebSocket upgrade or JSON status (CORS open) |
| `room.js` | `GameRoom`: lobby authority, resume tokens, relay |
| `wrangler.jsonc` | name `starlane-scuffle`, DO binding `ROOMS`, migration `new_sqlite_classes: ["GameRoom"]` |
| `DEPLOY.md` | exact multipart upload for the Cloudflare MCP |

## Sync model: host-sim + relay (no host migration)

* The **creator is the sim host**: their browser runs the normal `Match` with 2 human heroes, bots fill the rest of 5v5.
* The **guest** sends `in` messages (~20 Hz: move x/z in world space, attack, one-shot cast / spend bits). The DO forwards them to the host.
* The host applies them to the guest's hero, stays authoritative for every entity and sends full `snap` messages (~10 Hz) plus `ev` events. The DO forwards them to the guest.
* The guest runs a *mirror*: it predicts only its own hero (movement + skills), chases snapshot positions for everything else and hard-corrects its own hero when it drifts. No damage is computed on the guest.
* The DO owns the lobby (players, teams, champion picks, phase, seed) in storage, so it survives hibernation.

## Reconnect

`welcome` hands each player a `token` (the client keeps it in localStorage per room code). A dropped player keeps their slot for 45 s; sending
`hello` with the token re-attaches the same slot/team/champion and replaces any stale socket. If the host is away the guest is told (`peer` connected:false)
and pauses; the host's own tab pauses while its socket is down and resumes in place. If the host *reloads the page* the sim is lost: the host client sends `abort`
and the room returns to the lobby. Past 45 s a missing guest is dropped and their hero becomes a bot on the host; a missing host closes the match (`closed`).
An empty room is wiped after 10 minutes (alarm).

## Messages (JSON; `ping` / `pong` are plain strings answered by the runtime)

client -> room: `hello {code?, create?, token?, name}`, `pick {team, hero}`, `rename {name}`, `start {practice?}`, `abort`, `in {...}` (guest), `snap {...}` / `ev {...}` (host)
room -> client: `welcome {code, slot, token, phase, start?}`, `lobby {players, phase}`, `start {seed, picks}`, `peer {slot, connected, gone?}`, `closed {why}`, `err {code, msg}`, forwarded `in` / `snap` / `ev`.

## Local dev

`npx wrangler dev` in this folder, then open the game with `?ws=ws://localhost:8787`.
