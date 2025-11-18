# Development Setup Guide

## The Problem You Were Experiencing

**Issue:** The "Create Personal Narrative" button appeared but did nothing when clicked.

**Root Cause:** The `/api/tarot-reading` endpoint wasn't running in development mode. Running `npm run dev` only started Vite (the frontend), but not the Cloudflare Pages Functions (the backend API).

## The Solution

The personalized reading feature **IS fully wired and working**! The code correctly:

- ✅ Collects user reflections from each card
- ✅ Sends reflections to the API
- ✅ Incorporates reflections into the narrative
- ✅ Uses Azure GPT-5.1 for generation (when configured)

The issue was **only** with the development environment setup.

## How to Run the App Properly

### Quick Start

```bash
npm run dev
```

This script (`dev.sh`) automatically:
1. Starts Vite (frontend) on port 5173 or 5174
2. Starts Wrangler (API proxy) on port 8788
3. Configures everything to work together

**Access the app at: http://localhost:8788**

### Manual Setup (Advanced)

If you need to run components separately:

```bash
# Terminal 1: Start Vite
npm run dev:frontend

# Terminal 2: Start Wrangler (in another terminal)
npm run dev:wrangler
```

Then access at http://localhost:8788

## Important URLs

| URL | Purpose | Use It? |
|-----|---------|---------|
| http://localhost:8788 | **Full app with API** | ✅ **YES - Use this!** |
| http://localhost:5173 or 5174 | Vite only (no API) | ❌ No - API won't work |

## Testing Personalized Readings

1. Open http://localhost:8788
2. Select a spread (e.g., "Three-Card Story")
3. Complete the ritual (knock, cut)
4. Draw your cards
5. Reveal each card
6. **Optionally** add reflections in the "What resonates for you?" textarea
7. Click **"Create Personal Narrative"**
8. Wait for the narrative to generate (uses Azure GPT-5.1)

## Environment Configuration

### Local Development Secrets (`.dev.vars`)

Required secrets for the personalized reading feature:

```bash
# Azure OpenAI for reading generation
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_KEY=your-api-key
AZURE_OPENAI_GPT5_MODEL=gpt-5.1  # or gpt-5.1-pro

# Azure OpenAI for TTS (optional)
AZURE_OPENAI_TTS_ENDPOINT=https://your-tts-resource.openai.azure.com
AZURE_OPENAI_TTS_API_KEY=your-tts-api-key
AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT=gpt-audio-mini

# Vision proof signing (optional, for research mode)
VISION_PROOF_SECRET=your-random-secret-key
```

**Note:** Your `.dev.vars` file is already configured with these values.

## How the Personalized Reading Works

### Frontend Flow

1. **Card.jsx** - Collects user reflections via textarea
2. **TarotReading.jsx** - Formats reflections and sends to API
3. **generatePersonalReading()** function sends:
   - Spread info
   - Card details (positions, orientations, meanings)
   - User question
   - **User reflections** (formatted as "Position: reflection text")
   - Vision proof (if research mode enabled)

### Backend Flow

1. **functions/api/tarot-reading.js** receives the request
2. Validates payload
3. Performs spread analysis
4. Generates narrative using:
   - **Azure GPT-5.1** (primary, if configured) ✅ **Currently active**
   - Claude Sonnet 4.5 (fallback)
   - Local composer (final fallback)
5. Returns personalized narrative with reflections integrated

### Where Reflections Are Used

- **Azure GPT-5/Claude prompts** (functions/lib/narrative/prompts.js:278-280)
  - Included as "**Querent's Reflections**" in the AI prompt
- **All spread builders** (functions/lib/narrative/spreads/*.js)
  - Added as dedicated section via `buildReflectionsSection()`
  - Integrated into the narrative flow

## Narrative Backends

The app tries narrative backends in this order:

1. **Azure GPT-5.1** ← You have this configured!
2. Claude Sonnet 4.5 (if ANTHROPIC_API_KEY set)
3. Local composer (always available)

Check which backend was used in the API response:

```javascript
{
  "reading": "...",
  "provider": "azure-gpt5",  // ← Shows which backend generated it
  "themes": {...},
  "spreadAnalysis": {...}
}
```

## Troubleshooting

### Button still doesn't work?

1. **Check you're on the right URL:**
   - ✅ http://localhost:8788 (correct)
   - ❌ http://localhost:5174 (wrong - API won't work)

2. **Check browser console for errors:**
   - Open DevTools (F12)
   - Look for network errors when clicking the button
   - Check if `/api/tarot-reading` returns 200 OK

3. **Verify API is running:**
   ```bash
   curl http://localhost:8788/api/tarot-reading
   # Should return: {"status":"ok","provider":"azure-gpt5",...}
   ```

4. **Check environment variables:**
   ```bash
   # Ensure .dev.vars has the required secrets
   cat .dev.vars
   ```

### Port already in use?

If you see "Port 8788 is in use", kill the existing process:

```bash
lsof -ti:8788 | xargs kill -9
```

Or use the dev script which auto-cleans up ports.

## Key Files

### Frontend
- `src/TarotReading.jsx:1028-1195` - generatePersonalReading() function
- `src/components/Card.jsx:206-222` - Reflection textarea input

### Backend
- `functions/api/tarot-reading.js` - Main API endpoint
- `functions/lib/narrative/prompts.js` - AI prompt builder
- `functions/lib/narrative/spreads/*.js` - Spread-specific narratives

### Configuration
- `.dev.vars` - Local development secrets (git-ignored)
- `wrangler.toml` - Cloudflare Pages configuration
- `package.json` - Scripts and dependencies

## Production Deployment

When deployed to Cloudflare Pages, everything works automatically:

1. Build: `npm run build` creates `dist/`
2. Deploy: `npm run deploy` or via GitHub Actions
3. Secrets are stored in Cloudflare (not in repo)

Set production secrets with:

```bash
wrangler pages secret put AZURE_OPENAI_ENDPOINT --project-name=mystic-tarot
wrangler pages secret put AZURE_OPENAI_API_KEY --project-name=mystic-tarot
wrangler pages secret put AZURE_OPENAI_GPT5_MODEL --project-name=mystic-tarot
```

## Summary

- ✅ Personalized reading **IS** wired and active
- ✅ Reflections **ARE** collected and used
- ✅ Azure GPT-5.1 **IS** configured
- ❌ Problem was **only** dev environment setup
- ✅ **Fix:** Use `npm run dev` and access http://localhost:8788

Enjoy your personalized tarot readings! 🔮✨
