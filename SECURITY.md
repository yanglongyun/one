# Security

`one` is a personal AI agent system. A running deployment can control connected
desktop, Android, or browser clients, so treat its credentials as real secrets.

## Secrets

- Do not commit `worker/wrangler.jsonc`, `.dev.vars`, `.env`, database backups,
  device passwords, API keys, or Cloudflare identifiers.
- Start from `worker/wrangler.example.jsonc` and keep the filled
  `worker/wrangler.jsonc` local.
- Store production secrets with Cloudflare secrets, for example
  `npx wrangler secret put AUTH_SECRET`.

## Browser and Device Access

The browser extension and device clients expose powerful automation capability.
Only connect them to a deployment you control. Rotate the access password if it
has been shared, logged, or committed by mistake.

## Reporting

Please report security issues privately before opening a public issue.
