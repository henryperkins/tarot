# Developer Onboarding

Type: guide
Status: active
Last reviewed: 2026-04-23

This guide is the current starting point for engineers working in the Tableu repository.

## Environment Bootstrap

1. Create `.dev.vars` and populate the local secrets used by the Worker and local tooling.
2. Run `npm run config:check` after adding or changing environment variables.
3. Mirror production secrets with `wrangler secret put <NAME> --config wrangler.jsonc` when deploying.

Common local variables include:

- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`
- `AZURE_OPENAI_GPT5_MODEL`
- `AZURE_OPENAI_TTS_ENDPOINT`
- `AZURE_OPENAI_TTS_API_KEY`
- `AZURE_OPENAI_GPT_AUDIO_MINI_DEPLOYMENT`
- `AZURE_ANTHROPIC_ENDPOINT`
- `AZURE_ANTHROPIC_API_KEY`
- `AZURE_ANTHROPIC_MODEL`
- `VISION_PROOF_SECRET` when using vision research mode
- Auth variables such as `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_AUDIENCE`, `AUTH0_USERINFO_URL`, and `APP_URL` when testing auth flows

## Repo Shape

| Area | Purpose |
| --- | --- |
| `src/` | React web app |
| `functions/api/` | Worker route handlers |
| `functions/lib/` | Worker-only backend logic |
| `src/worker/index.js` | Worker router and route wiring |
| `server/` | Express server for static preview and auth-related local routes |
| `native/` | Expo native app |
| `shared/` | Code shared across frontend, worker, and native surfaces |
| `scripts/` | Deploy, evaluation, training, and utility scripts |

## Runtime Boundaries

- `src/lib/*` is browser-only.
- `functions/lib/*` and `functions/api/*` are Worker-only.
- `scripts/*` is Node.js tooling.
- Shared logic that must run in more than one environment belongs in `shared/`.

Do not cross-import browser code into Worker code or Worker code into browser code.

## Current Stack

- Frontend: React 19, Vite, Tailwind CSS
- Backend: Cloudflare Workers with route handlers in `functions/api/`
- Native: Expo SDK 55 preview, React Native 0.83, React Navigation 7, NativeWind 4
- Local static preview: Express server in `server/index.ts`
- Data: Cloudflare D1, KV, R2

## App Entry And Routing

- Web entrypoint: `src/main.jsx`
- Root providers: `AuthProvider`, `SubscriptionProvider`, `PreferencesProvider`, `ReadingProvider`, `ToastProvider`
- Router: `react-router-dom` with route composition in `src/components/AnimatedRoutes.jsx`

Current top-level web routes include:

| Path | Component |
| --- | --- |
| `/` | `TarotReading.jsx` |
| `/journal` | `components/Journal.jsx` |
| `/journal/gallery` | `pages/CardGalleryPage.jsx` |
| `/pricing` | `pages/PricingPage.jsx` |
| `/account` | `pages/AccountPage.jsx` |
| `/admin` | `pages/AdminDashboard.jsx` |
| `/design` | `pages/DesignSystemPage.jsx` |
| `/share/:token` | `pages/ShareReading.jsx` |
| `/reset-password` | `pages/ResetPasswordPage.jsx` |
| `/verify-email` | `pages/VerifyEmailPage.jsx` |
| `/auth/callback` | `pages/OAuthCallbackPage.jsx` |
| `*` | `TarotReading.jsx` fallback |

## State And Data Flow

Main app-wide contexts:

- `AuthContext` - session and auth state
- `SubscriptionContext` - tier normalization and entitlements
- `PreferencesContext` - theme, audio, personalization, onboarding, and UI preferences
- `ReadingContext` - active reading lifecycle and streaming state
- `ToastContext` - notifications

Data fetching is primarily custom-hook based using `fetch`, local component state, and context helpers.

## Local Workflows

### Full-stack web development

```bash
npm run dev:vite
```

### Static preview and auth server

```bash
npm run dev
```

### Native app

```bash
npm run dev:native
```

## Validation Commands

```bash
npm test
npm run test:e2e
npm run test:a11y
npm run gate:narrative
npm run gate:vision
npm run lint
```

## Suggested First Reads

1. `README.md`
2. `CLAUDE.md`
3. `docs/README.md`
4. `docs/NARRATIVE_ARCHITECTURE.md`
5. `docs/VISION_PIPELINE.md`
6. `docs/monetization/monetization-logic.md`

## Practical Next Steps

1. Boot `npm run dev:vite` and verify the web app loads.
2. Read `src/main.jsx` and `src/components/AnimatedRoutes.jsx` for app composition.
3. Trace the main reading flow from `src/TarotReading.jsx` into `functions/api/tarot-reading.js`.
4. Check the active tests around the area you plan to modify before making changes.
