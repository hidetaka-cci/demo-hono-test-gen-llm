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

### CircleCI CLI / chunk CLI / Chunk sidecars
The update script installs the `circleci` and `chunk` CLIs into `/usr/local/bin` (idempotent; skipped if already present). Linux x86_64 has no Homebrew, so they are installed from official release artifacts, not `brew`.
- CircleCI auth is provided via the `CIRCLECI_TOKEN` environment variable (a configured secret). `chunk auth status` should show CircleCI "✓ Valid" with no extra setup. Never `echo`/`printenv` the token.
- Sidecar org ID and snapshot image come from `.chunk/config.json` (`orgID`, `validation.sidecarImage`). `chunk sidecar create` needs `--org-id` (interactive org selection does not work in agent sessions); pair it with `--image <sidecarImage>` to boot from the snapshot.
- `chunk sidecar create` can intermittently time out with `context deadline exceeded`; simply retry — connectivity is fine (verify with `chunk sidecar list`).
- Before `chunk sidecar sync`, an SSH keypair must exist at `~/.ssh/chunk_ai`. If missing: `ssh-keygen -t ed25519 -f ~/.ssh/chunk_ai -N ""` then `chunk sidecar add-ssh-key --public-key-file ~/.ssh/chunk_ai.pub`. The key is not persisted by the update script, so regenerate/register per fresh VM as needed.
- The `chunk validate` subcommand hangs in this VM — **all variants** (`chunk validate`, `chunk validate --remote`, `chunk validate --remote --cmd ...`, and even `chunk validate --list` / `--dry-run`). It also ignores `SIGTERM`/`timeout`, so a stuck invocation must be killed with `kill -9 <pid>`. Do not rely on `chunk validate` here.
- For remote validation use `chunk sidecar exec` instead, which works reliably: `chunk sidecar exec --command bash --args -lc --args "cd ~/<repo> && npm ci && npm test"`. The synced tree lives at `~/demo-hono-test-gen-llm` on the sidecar (path varies by base image — confirm with `chunk sidecar current --json`).
