# Cloudflare Workers Migration Guide

This document describes the migration from Cloudflare Pages Functions to Cloudflare Workers with Static Assets.

## Overview

The project has been migrated from:
- **Before**: Cloudflare Pages Functions (`functions/api/*.js`)
- **After**: Cloudflare Workers with Static Assets (`src/worker/index.js`)

## Why Migrate?

1. **Unified Runtime**: Workers provide a more consistent runtime environment
2. **Better Development Experience**: `wrangler dev` provides faster iteration
3. **More Configuration Options**: Full `wrangler.toml` support for bindings
4. **Future-Proof**: Workers is Cloudflare's primary compute platform

## Architecture Changes

### Before (Pages Functions)
```
public/
├── _routes.json          # Route configuration
functions/
├── api/
│   ├── tarot-reading.js  # onRequestGet/onRequestPost
│   ├── tts.js
│   └── ...
```

### After (Workers)
```
src/worker/
├── index.js              # Main Worker entry point with router
wrangler.toml             # Worker configuration
dist/                     # Built static assets (served by ASSETS binding)
functions/                # Legacy handlers (still used, imported by worker)
├── api/
├── lib/
```

## Configuration

### wrangler.jsonc

The project uses `wrangler.jsonc` (JSON with Comments) for configuration:

```jsonc
{
  "name": "tableau",
  "main": "./src/worker/index.js",
  "compatibility_date": "2025-11-24",
  "compatibility_flags": ["nodejs_compat"],
  
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  
  "d1_databases": [{
    "binding": "DB",
    "database_id": "YOUR_D1_DATABASE_ID",
    "database_name": "mystic-tarot-db"
  }],
  
  "kv_namespaces": [
    { "binding": "RATELIMIT", "id": "YOUR_KV_ID" },
    { "binding": "FEEDBACK_KV", "id": "YOUR_FEEDBACK_KV_ID" },
    { "binding": "METRICS_DB", "id": "YOUR_METRICS_KV_ID" }
  ],
  
  "r2_buckets": [{
    "binding": "LOGS_BUCKET",
    "bucket_name": "tarot-logs"
  }],
  
  "logpush": true,
  "observability": { "enabled": true }
}
```

## Development Commands

### Start Development Server
```bash
npm run dev
# Or just workers:
npm run dev:workers
```

### Build
```bash
npm run build
```

### Deploy
```bash
npm run deploy
# Or specifically for workers:
npm run deploy:workers
```

### Preview Locally
```bash
npm run preview:workers
```

## Setting Up Bindings

### D1 Database
```bash
# Create the database
wrangler d1 create tableau-db

# Update wrangler.toml with the database_id

# Apply migrations
wrangler d1 execute tableau-db --local --file=./migrations/001_initial.sql
```

### KV Namespaces
```bash
# Create rate limiting KV
wrangler kv:namespace create RATELIMIT
wrangler kv:namespace create METRICS_DB

# Update wrangler.toml with the namespace IDs
```

### Secrets Migration

**IMPORTANT**: Pages secrets are stored separately from Workers secrets. You must re-add all secrets to the Workers deployment.

#### Using the Migration Script

```bash
# Interactive mode (prompts for each value)
./scripts/migrate-secrets.sh

# Or use values from your .dev.vars file
./scripts/migrate-secrets.sh --from-env
```

#### Required Secrets
```bash
wrangler secret put AZURE_OPENAI_ENDPOINT
wrangler secret put AZURE_OPENAI_API_KEY
wrangler secret put AZURE_OPENAI_GPT5_MODEL
```

#### Optional Secrets
```bash
wrangler secret put AZURE_OPENAI_TTS_ENDPOINT
wrangler secret put AZURE_OPENAI_TTS_API_KEY
wrangler secret put AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put VISION_PROOF_SECRET
wrangler secret put HUME_API_KEY
```

#### Verify Secrets
```bash
wrangler secret list --name tableau
```

## Handler Compatibility

The existing Pages Functions handlers (`onRequestGet`, `onRequestPost`, etc.) remain unchanged. The Worker entry point imports and calls them with a compatible context object:

```javascript
// Worker provides the same context structure as Pages Functions
const context = {
  request,
  env,
  params,          // Extracted from URL pattern
  waitUntil,
  next,            // Falls through to static assets
  data: {},
};

const response = await handler(context);
```

## Route Mapping

Routes are defined in `src/worker/index.js`:

| URL Pattern | Handler Module |
|-------------|----------------|
| `/api/tarot-reading` | `functions/api/tarot-reading.js` |
| `/api/tts` | `functions/api/tts.js` |
| `/api/journal` | `functions/api/journal.js` |
| `/api/journal/:id` | `functions/api/journal/[id].js` |
| `/api/auth/login` | `functions/api/auth/login.js` |
| `/api/share/:token` | `functions/api/share/[token].js` |
| ... | ... |

## Port Changes

- **Old**: `localhost:8788` (Pages dev)
- **New**: `localhost:8787` (Workers dev)

## Troubleshooting

### Missing Bindings
Ensure `wrangler.toml` has the correct database_id and namespace IDs from your Cloudflare dashboard.

### Module Import Errors
The Worker uses ESM imports. Ensure all function files use `export` syntax.

### CORS Issues
CORS headers are added automatically by the Worker router for all API responses.

### Static Assets Not Found
Ensure `npm run build` has been run to populate `dist/` before starting the dev server.

## Rollback

To rollback to Pages Functions:
1. Restore `public/_routes.json`
2. Use `wrangler pages dev` instead of `wrangler dev`
3. Deploy with `wrangler pages deploy` instead of `wrangler deploy`