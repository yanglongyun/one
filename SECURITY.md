# Security

`one` is a single-user, self-hosted personal AI agent. A running deployment can
control the desktop / Android / browser clients you connect to it, so treat its
credentials as real secrets and only ever point clients at a deployment you own.

## Trust model (read this before deploying publicly)

- **Single user.** There are no accounts or per-user isolation. Anyone who holds
  the access password (or a valid token) has the full power of the deployment.
- **`AUTH_SECRET` is mandatory.** The worker refuses to sign or verify tokens
  unless `AUTH_SECRET` is set (≥16 chars). Set it with
  `npx wrangler secret put AUTH_SECRET` (e.g. `openssl rand -hex 32`); for local
  dev put `AUTH_SECRET=...` in `worker/.dev.vars`.
- **A password is required before use.** On a fresh deploy the worker issues no
  tokens and accepts no device connections until you set an access password on
  first open. This closes the "public URL, not yet locked down" window.
- **The assistant uses SQL for both reads and writes.** The `sql` tool can
  execute single `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `PRAGMA`, and other
  SQLite statements against the D1 database, including system data (memories,
  notes, goals, schedules, tasks). Apps are native code shipped in this
  repository — nothing executable is stored in the database.

## Secrets

- Do not commit `worker/wrangler.jsonc`, `.dev.vars`, `.env`, database backups,
  device passwords, API keys, or Cloudflare identifiers. These are gitignored.
- Start from `worker/wrangler.example.jsonc` and keep the filled
  `worker/wrangler.jsonc` local.
- Store production secrets with Cloudflare secrets, e.g.
  `npx wrangler secret put AUTH_SECRET`.

## Browser and device access

The browser extension and device clients expose powerful automation capability.
Clients connect over TLS (`wss://`) by default except for `localhost`. Only
connect them to a deployment you control. Rotate the access password if it has
been shared, logged, or committed by mistake.

## Reporting

Please report security issues privately before opening a public issue.
