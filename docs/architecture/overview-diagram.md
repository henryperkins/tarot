Type: reference
Status: active reference
Last reviewed: 2026-09-25

This is a high-level runtime view. The application uses one Cloudflare Worker plus its `ASSETS` binding; there is no separate application server runtime. For endpoint-level details, verify `src/worker/index.js`, `wrangler.jsonc`, and the relevant `functions/api/` handler.

The [provider inventory](../provider-reference.md) covers feature-specific routing, optional owner subscription inference, model defaults and configuration.

```mermaid
flowchart TB
%% Frontend
    subgraph Frontend [**React SPA Frontend**]
        direction TB
        FE_Entry["Main Entrypoint (index.html & src/main.jsx)"]
        FE_Contexts["Context Providers:<br/>AuthContext.jsx, SubscriptionContext.jsx,<br/>PreferencesContext.jsx, ReadingContext.jsx, ToastContext.jsx"]
        FE_Router["Routing (BrowserRouter with AnimatedRoutes)"]
        FE_SW["Service Worker (sw.js) – offline caching"]
    end
    FE_Entry --> FE_Contexts --> FE_Router
    FE_Entry -.-> FE_SW
    
%% Backend - Cloudflare Worker
    subgraph Worker [**Cloudflare Worker (src/worker/index.js)**]
        direction TB
        Router["Worker Router – routes /api/* requests"]
        CORS["CORS Handler (OPTIONS preflight,<br/>adds Access-Control-Allow-* headers)"]
        OG_Injection["Share OG Tag Injector (injects meta tags<br/>for /share/:token pages)"]
        CronDaily["Scheduled Cron (0 3 * * *)<br/>quality analysis, ongoing KV compatibility archival, cleanup"]
        subgraph API_Functions [API Route Handlers (functions/api/*)]
            direction TB
            API_Tarot["Tarot Reading (tarot-reading.js) – core reading logic"]
            API_Jobs["Reading Job API (tarot-reading-job-start/status/stream/cancel.js) –<br/>/jobs start/status/stream/cancel"]
            API_Followup["Follow-up Q&A (reading-followup.js)"]
            API_TTS["Text-to-Speech (tts.js)"]
            API_SpeechToken["Retired Speech Token (speech-token.js) – HTTP 410"]
            API_Journal["Journal Entries (journal.js & variants)"]
            API_Feedback["Feedback (feedback.js)"]
            API_Memories["Memories & Usage (memories.js, usage.js)"]
            API_Share["Sharing (share.js, share/[token].js,<br/>share-notes.js, og-image.js)"]
            API_Subscription["Subscriptions (subscription.js, restore.js)"]
            API_Payments["Stripe Checkout/Portal (create-checkout-session.js,<br/>create-portal-session.js) & Webhook"]
            API_Auth["Auth (auth/login.js, register.js, etc. & OAuth)"]
            API_Account["Account Settings (account/profile.js, password.js, delete.js)"]
            API_Admin["Admin & Health (admin/archive.js, quality-stats.js,<br/>coach-extraction-backfill.js, health/*)"]
            API_Keys["API Keys (keys/index.js, [id].js)"]
        end
        DurableObj["READING_JOBS Durable Object: **ReadingJob**<br/>(src/worker/readingJob.js)<br/>manages job state, persists events, and streams SSE results"]
        LocalComposer["Local Composer<br/>deterministic English narrative fallback"]
    end
    Router -->|"/api/*"| API_Functions
    Router -->|"/api/tarot-reading/jobs/*"| DurableObj
    Router -->|"/share/:token"| OG_Injection
    Worker -->|Cron Trigger| CronDaily
    Router --> CORS
    
%% Data Storage (Cloudflare)
    subgraph CF_Storage [**Cloudflare Data Storage**]
        D1DB[(D1 (DB) – SQLite<br/>app data, eval_metrics, quality, usage, media metadata)]
        KV_Metrics["KV (METRICS_DB) – media telemetry, media usage, legacy video-job metadata, ongoing compatibility archive input"]
        KV_Feedback["KV (FEEDBACK_KV) – feedback cache"]
        R2Bucket["R2 (R2_LOGS) – generated/user media, journal exports, archives"]
    end
    Worker --> D1DB
    Worker --> KV_Metrics
    Worker --> KV_Feedback
    Worker --> R2Bucket
    CronDaily --> D1DB
    CronDaily --> KV_Metrics
    CronDaily --> KV_Feedback
    
%% External Services
    subgraph External [**External Services**]
        StripeAPI["Stripe API – payments"]
        ModalQwen["Modal Qwen<br/>Chat Completions"]
        OpenAINative["openai-native<br/>OpenAI native Responses"]
        Claude["Anthropic API<br/>Claude Opus 5.5"]
        ReaderTTS["Reader voice – ElevenLabs when configured,<br/>otherwise Workers AI Deepgram Aura-2"]
    end
    Worker -->|1. narrative| Claude
    Worker -->|2. narrative| ModalQwen
    Worker -->|3. narrative| OpenAINative
    Worker -->|4. deterministic fallback| LocalComposer
    Worker -->|TTS generation| ReaderTTS
    Worker -->|Create sessions, Portal| StripeAPI
    Worker <-->|Stripe Webhook| StripeAPI
    Frontend <-->|API calls (REST & SSE)| Worker
    Worker --> Assets["Static Assets (binding to /dist)"]
    Frontend --> Assets
```
