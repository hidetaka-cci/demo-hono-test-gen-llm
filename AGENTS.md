# AGENTS.md

## Cursor Cloud specific instructions

This is a single Cloudflare Workers + Hono datetime API (TypeScript). There is no database, auth, or external service — the app is fully self-contained. Standard commands live in `package.json` and `README.md`; only the non-obvious caveats are noted here.

### Services
- **Worker dev server** — `npm run dev` (`wrangler dev`), serves all endpoints on `http://localhost:8787`.
- **Test suite** — `npm test` (Vitest). Tests import the Hono `app` and dispatch requests in-process, so they do NOT need the dev server running.

### Non-obvious caveats
- `wrangler dev` is interactive on first run in a fresh environment: it prompts "install Cloudflare skills for Cursor?" — answer `n`. Run it inside a tmux session (not a one-shot foreground command) so you can respond to the prompt and keep the server alive.
- There is no separate build step for local dev; `wrangler dev` bundles on the fly. `npm run cf-typegen` only regenerates Worker binding types and is optional.
- `POST /offset-datetime` expects the shape `{"datetime": "<ISO>", "offset": {"days": .., "hours": ..}}` — `offset` must be a nested object, not top-level fields.
- `npm install` reports npm audit vulnerabilities; these are transitive dev-dependency advisories and do not block dev/test/run.
