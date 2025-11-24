# Deployment Guide - Mystic Tarot

This guide covers deployment, secrets management, and local development for the Mystic Tarot Cloudflare Pages project.

## Table of Contents

- [Quick Start](#quick-start)
- [Secrets Management](#secrets-management)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Bindings (Future)](#bindings-future)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Node.js 18.0.0 or later
- Wrangler v3.91.0 or later (installed via `npm install`)
- Cloudflare account with access to Pages

### Initial Setup

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```

---

## Secrets Management

Secrets are **encrypted** and used for sensitive data like API keys. They are **never** visible after being set.

### Local Development Secrets

For local development, secrets are stored in `.dev.vars` (already exists, **DO NOT COMMIT**):

```bash
# .dev.vars format (dotenv syntax)
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key-here
AZURE_OPENAI_GPT5_MODEL=gpt-5.1
AZURE_OPENAI_TTS_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_TTS_API_KEY=your-tts-api-key-here
AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT=your-tts-deployment-name
```

**Important**: `.dev.vars` is in `.gitignore` and should **never** be committed to git.

### Production Secrets

Set production secrets using the Wrangler CLI:

```bash
# Set each secret (you'll be prompted for the value)
wrangler pages secret put AZURE_OPENAI_ENDPOINT --project-name=mystic-tarot
wrangler pages secret put AZURE_OPENAI_API_KEY --project-name=mystic-tarot
wrangler pages secret put AZURE_OPENAI_GPT5_MODEL --project-name=mystic-tarot
wrangler pages secret put AZURE_OPENAI_TTS_ENDPOINT --project-name=mystic-tarot
wrangler pages secret put AZURE_OPENAI_TTS_API_KEY --project-name=mystic-tarot
wrangler pages secret put AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT --project-name=mystic-tarot
```

**Tip**: You can pipe values to avoid interactive prompts:

```bash
echo "https://your-resource.openai.azure.com" | wrangler pages secret put AZURE_OPENAI_ENDPOINT --project-name=mystic-tarot
```

### Preview Environment Secrets

For branch deployments (preview environments), use the `--env=preview` flag:

```bash
wrangler pages secret put AZURE_OPENAI_API_KEY --project-name=mystic-tarot --env=preview
```

### Managing Secrets

```bash
# List all secrets (shows names only, not values)
wrangler pages secret list --project-name=mystic-tarot

# Delete a secret
wrangler pages secret delete AZURE_OPENAI_API_KEY --project-name=mystic-tarot

# Bulk upload secrets from JSON file
echo '{"SECRET_NAME": "secret-value"}' | wrangler pages secret bulk --project-name=mystic-tarot
```

### Environment Variables vs Secrets

| Type | Use For | Storage | Visibility |
|------|---------|---------|------------|
| **Environment Variables** (`[vars]` in wrangler.toml) | Non-sensitive config (API version, format settings) | `wrangler.toml` (committed to git) | Visible in dashboard and config |
| **Secrets** (`.dev.vars` local, `wrangler secret` production) | Sensitive data (API keys, tokens, endpoints) | Encrypted in Cloudflare, `.dev.vars` for local | Never visible after setting |

---

## Local Development

### Start Local Development Server

```bash
# Option 1: Using npm script (starts Vite dev server for frontend only)
npm run dev

# Option 2: Test with Pages Functions locally
npx wrangler pages dev dist

# Option 3: With specific port and HTTPS
npx wrangler pages dev dist --port=8788 --local-protocol=https
```

### How Local Development Works

1. **Frontend Development** (`npm run dev`):
   - Runs Vite dev server on `http://localhost:5173`
   - Hot module replacement (HMR) for fast development
   - **Does NOT run Pages Functions**

2. **Full Stack Development** (`wrangler pages dev dist`):
   - Serves static assets from `dist/` directory
   - Runs Pages Functions (`/api/*` routes)
   - Uses `.dev.vars` for secrets
   - Default: `http://localhost:8788`

### Local Development with Bindings

When you add bindings (KV, D1, R2, etc.), you can test them locally:

```bash
# Example: KV namespace binding
npx wrangler pages dev dist --kv=TAROT_CACHE

# Example: D1 database binding
npx wrangler pages dev dist --d1=DB

# Example: R2 bucket binding
npx wrangler pages dev dist --r2=AUDIO_STORAGE
```

**Note**: Bindings specified via CLI flags take precedence over `wrangler.toml`.

### Local Development Workflow

```bash
# 1. Make changes to source files
# 2. Build the project
npm run build

# 3. Test locally with Functions
npx wrangler pages dev dist

# 4. Deploy when ready
npm run deploy
```

### Debugging Prompt Payloads

Need to inspect the exact prompt sent to GPT-5 or Claude? Add `LOG_LLM_PROMPTS=true` (or `DEBUG_LLM_PROMPTS=true`) to `.dev.vars` or your Pages secret set. When this flag is enabled the Pages Function logs the full `systemPrompt` and `userPrompt` payloads for each request. These logs include user questions and reflections, so leave the flag disabled in production unless absolutely necessary.

Telemetry & budgets
- `LOG_ENHANCEMENT_TELEMETRY=true` mirrors the enhancement summary/validation payloads for each reading (section counts, enhancement tags). Keep it disabled outside staging because it includes section text snippets.
- `PROMPT_BUDGET_AZURE`, `PROMPT_BUDGET_CLAUDE`, and `PROMPT_BUDGET_DEFAULT` let you set approximate token ceilings (characters ÷ 4 heuristic) for each backend. When set, the builder will trim low-priority prompt content (low-weight imagery → GraphRAG block → deck geometry tables → diagnostics) and report the estimated token counts in the prompt metadata.

---

## Deployment

### Deploy to Production

```bash
# Build and deploy in one command
npm run build && npm run deploy

# Or using wrangler directly
wrangler pages deploy dist --project-name=mystic-tarot
```

### Deploy to Preview (Branch Deployment)

```bash
# Deploy to a specific branch
wrangler pages deploy dist --project-name=mystic-tarot --branch=feature-branch

# If in a git workspace, wrangler auto-detects the branch
wrangler pages deploy dist
```

### Deployment URLs

- **Production**: `https://mystic-tarot.pages.dev` and `https://tarot.lakefrontdev.com`
- **Branch Previews**: `https://<BRANCH_NAME>.mystic-tarot.pages.dev`

### Deployment Checklist

Before deploying to production, ensure:

- [ ] All secrets are set (run `wrangler pages secret list --project-name=mystic-tarot`)
- [ ] `npm run build` completes successfully
- [ ] `_routes.json` is in `public/` directory (controls which routes invoke Functions)
- [ ] Test locally with `npx wrangler pages dev dist`
- [ ] Verify production URL after deployment

### Continuous Deployment

The project can be set up with CI/CD:

```yaml
# Example GitHub Actions workflow
name: Deploy to Cloudflare Pages
on:
  push:
    branches: [master]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - run: npm run deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Bindings (Future)

Bindings connect your Pages Functions to Cloudflare services. Here's how to add them when needed:

### KV Namespace (Caching, Rate Limiting)

```bash
# 1. Create KV namespace
wrangler kv:namespace create "TAROT_CACHE"

# 2. Add to wrangler.toml
# [[kv_namespaces]]
# binding = "TAROT_CACHE"
# id = "your-kv-namespace-id"
# preview_id = "your-preview-kv-namespace-id"

# 3. Use in Functions
# const value = await context.env.TAROT_CACHE.get("key");
```

### D1 Database (Reading History, Analytics)

```bash
# 1. Create D1 database
wrangler d1 create mystic-tarot-db

# 2. Add to wrangler.toml
# [[d1_databases]]
# binding = "DB"
# database_name = "mystic-tarot-db"
# database_id = "your-database-id"

# 3. Use in Functions
# const results = await context.env.DB.prepare("SELECT * FROM readings").all();
```

### R2 Bucket (Audio Storage)

```bash
# 1. Create R2 bucket
wrangler r2 bucket create mystic-tarot-audio

# 2. Add to wrangler.toml
# [[r2_buckets]]
# binding = "AUDIO_STORAGE"
# bucket_name = "mystic-tarot-audio"
# preview_bucket_name = "mystic-tarot-audio-preview"

# 3. Use in Functions
# await context.env.AUDIO_STORAGE.put("reading.mp3", audioData);
```

### Analytics Engine (Usage Tracking)

```bash
# Add to wrangler.toml
# [[analytics_engine_datasets]]
# binding = "ANALYTICS"

# Use in Functions
# context.env.ANALYTICS.writeDataPoint({
#   blobs: ["reading-generated"],
#   doubles: [1],
#   indexes: [context.env.ENVIRONMENT]
# });
```

---

## Troubleshooting

### Issue: Secrets not found in production

**Solution**: Ensure secrets are set for the production environment:

```bash
wrangler pages secret list --project-name=mystic-tarot
```

If missing, set them using `wrangler pages secret put`.

### Issue: Functions not executing locally

**Solution**: Make sure you're using `wrangler pages dev dist`, not just `npm run dev`:

```bash
npm run build
npx wrangler pages dev dist
```

### Issue: Routes not working as expected

**Solution**: Check `public/_routes.json` configuration. Only paths matching `include` will invoke Functions.

### Issue: CORS errors in development

**Solution**: Ensure your API endpoints return proper CORS headers. Check `functions/api/*.js` files.

### Issue: Wrangler authentication errors

**Solution**: Re-authenticate with Cloudflare:

```bash
wrangler login
```

### Issue: Build fails

**Solution**: Clear node_modules and reinstall:

```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Check Deployment Status

```bash
# List recent deployments
wrangler pages deployment list --project-name=mystic-tarot

# View project info
wrangler pages project list
```

---

## Useful Commands Reference

```bash
# Development
npm run dev                          # Vite dev server (frontend only)
npm run build                        # Build for production
npm run preview                      # Preview production build
npx wrangler pages dev dist          # Test with Functions locally

# Deployment
npm run deploy                       # Deploy to Cloudflare Pages
wrangler pages deploy dist           # Deploy manually

# Secrets Management
wrangler pages secret put <KEY>      # Set a secret
wrangler pages secret list           # List all secrets
wrangler pages secret delete <KEY>   # Delete a secret

# Project Management
wrangler pages project list          # List all projects
wrangler pages deployment list       # List deployments

# Bindings (when needed)
wrangler kv:namespace create <NAME>  # Create KV namespace
wrangler d1 create <NAME>            # Create D1 database
wrangler r2 bucket create <NAME>     # Create R2 bucket
```

---

## Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Wrangler Configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Bindings Reference](https://developers.cloudflare.com/pages/functions/bindings/)
- [Secrets Management](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Local Development](https://developers.cloudflare.com/pages/functions/local-development/)
