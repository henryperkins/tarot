# Tableau ChatGPT MCP Adapter

Thin MCP service that exposes this repo's tarot jobs backend to ChatGPT Apps.

## What it exposes

- `start_tarot_reading` -> `POST /api/tarot-reading/jobs`
- `get_tarot_reading_status` -> `GET /api/tarot-reading/jobs/:id`
- `cancel_tarot_reading` -> `POST /api/tarot-reading/jobs/:id/cancel`
- `wait_for_tarot_reading` -> polling helper around status endpoint

## Prerequisites

- Node 20+
- A valid backend API key (`sk_...`) from Tableau
- Backend reachable at `TABLEAU_BASE_URL`

## Setup

1. Copy env file:
   - `cp .env.example .env`
2. Fill:
   - `TABLEAU_BASE_URL`
   - `TABLEAU_API_KEY`
   - Optional host binding controls:
     - `ADAPTER_BIND_HOST` (default `0.0.0.0`)
     - `ADAPTER_ALLOWED_HOSTS` (comma-separated hostnames for DNS-rebinding protection)
3. Install:
   - `npm install`
4. Run:
   - `npm run start`

Default endpoint:

- `http://localhost:3334/mcp`

## Dev mode

- `npm run dev`

## OAuth mode (optional)

Use this for per-user tools instead of static service-account auth.

1. Set `OAUTH_ENABLED=true` in `.env`.
2. Configure either:
   - `OAUTH_ISSUER_URL` (adapter discovers metadata from `/.well-known/*`), or
   - `OAUTH_METADATA_URL` directly.
3. Set `OAUTH_RESOURCE_SERVER_URL` to your public MCP URL (for example `https://adapter.example.com/mcp`).
4. Choose token verification strategy:
   - Introspection: set `OAUTH_INTROSPECTION_URL` (+ optional `OAUTH_INTROSPECTION_CLIENT_ID/SECRET`).
   - JWT: set `OAUTH_JWKS_URI` (or rely on `jwks_uri` from metadata).

When enabled, the adapter exposes:

- `/.well-known/oauth-protected-resource/mcp`
- `/.well-known/oauth-authorization-server`

and requires bearer auth on `/mcp`.

## Quick backend smoke check

This validates backend auth + jobs contract directly:

- `npm run smoke:backend`

## Connect in ChatGPT

1. Enable Developer Mode:
   - `Settings -> Apps & Connectors -> Advanced settings`
2. Create connector:
   - `Settings -> Connectors -> Create`
3. Use connector URL:
   - `https://<your-public-host>/mcp`
4. Save, verify tools, then test in a chat.

## Notes

- Default mode uses a static backend API key.
- In default mode, OAuth discovery routes return `404` intentionally.
- In OAuth mode, discovery routes are served and `/mcp` requires bearer auth.
- For production, set `ADAPTER_ALLOWED_HOSTS` (for example `adapter.example.com`) when binding to `0.0.0.0`.
