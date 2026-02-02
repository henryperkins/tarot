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
        Cron["Scheduled Cron Handler (handleScheduled<br/>@ 3AM daily)"]
        subgraph API_Functions [API Route Handlers (functions/api/*)]
            direction TB
            API_Tarot["Tarot Reading (tarot-reading.js) – core reading logic"]
            API_Jobs["Reading Job API (tarot-reading-jobs*.js) –<br/>/jobs start/status/stream/cancel"]
            API_Followup["Follow-up Q&A (reading-followup.js)"]
            API_TTS["Text-to-Speech (tts.js, tts-hume.js)"]
            API_SpeechToken["Speech Token (speech-token.js)"]
            API_Journal["Journal Entries (journal.js & variants)"]
            API_Feedback["Feedback (feedback.js)"]
            API_Memories["Memories & Usage (memories.js, usage.js)"]
            API_Share["Sharing (share.js, share/[token].js,<br/>share-notes.js, og-image.js)"]
            API_Subscription["Subscriptions (subscription.js, restore.js)"]
            API_Payments["Stripe Checkout/Portal (create-checkout-session.js,<br/>create-portal-session.js) & Webhook"]
            API_Auth["Auth (auth/login.js, register.js, etc. & OAuth)"]
            API_Account["Account Settings (account/profile.js, password.js, delete.js)"]
            API_Admin["Admin & Health (admin/archive.js, quality-stats.js,<br/>coach-backfill.js, health/*)"]
            API_Keys["API Keys (keys/index.js, [id].js)"]
        end
        DurableObj["Durable Object: **ReadingJob** (src/worker/readingJob.js)<br/>– manages reading job state, calls tarot-reading logic,<br/>persists events, streams SSE results"]
    end
    Router -->|"/api/*"| API_Functions
    Router -->|"/api/tarot-reading/jobs/*"| DurableObj
    Router -->|"/share/:token"| OG_Injection
    Router -->|Cron Trigger| Cron
    Router --> CORS
    
%% Data Storage (Cloudflare)
    subgraph CF_Storage [**Cloudflare Data Storage**]
        D1DB[(D1 Database – SQLite<br/>primary app DB (mystic-tarot-db))]
        KV_Metrics["KV (METRICS_DB) – temp quality metrics"]
        KV_Feedback["KV (FEEDBACK_KV) – user feedback cache"]
        R2Bucket["R2 Bucket – S3-compatible storage<br/>(logs & exports)"]
    end
    Worker --> D1DB
    Worker --> KV_Metrics
    Worker --> KV_Feedback
    Worker --> R2Bucket
    Cron --> D1DB
    Cron --> KV_Metrics
    Cron --> KV_Feedback
    
%% Backend - Express Server (for Dev/OIDC)
    subgraph ExpressSrv [**Express API Server (server/index.ts)**]
        ExpressAuth["OIDC Auth Setup (passport OpenID Connect,<br/>session store via connect-pg-simple)"]
        ExpressRoutes["Auth Routes (/api/login, /api/logout,<br/>/api/callback, /api/auth/user)"]
        ExpressHealth["Health Check (/api/health)"]
        ExpressStatic["Static Content Server<br/>(serves React /dist files)"]
    end
    ExpressSrv -->|Sessions & Users| Postgres
    ExpressSrv --> OIDC_Provider
    Frontend <-->|Auth redirect| ExpressSrv
    Frontend -->|Load static assets| ExpressStatic
    
%% External Services
    subgraph External [**External Services**]
        OIDC_Provider["OpenID Connect Provider<br/>(Replit Auth)"]
        Postgres["Neon Postgres – User DB (drizzle-orm)"]
        StripeAPI["Stripe API – payments"]
        AzureOpenAI["Azure OpenAI GPT-5 API – narrative generation"]
        AzureSpeech["Azure Speech Service – TTS (client SDK)"]
        HumeAI["Hume AI API – alt. TTS/emotion"]
        LogRocket["LogRocket – client monitoring"]
    end
    Worker -->|"Generate reading"| AzureOpenAI
    Worker -->|TTS generation| AzureOpenAI
    Worker -->|Hume emotion TTS| HumeAI
    Worker -->|Create sessions, Portal| StripeAPI
    Worker <-->|Stripe Webhook| StripeAPI
    Worker -->|Issue OIDC JWT| OIDC_Provider
    ExpressAuth --> Postgres
    Frontend -->|OIDC Login Flow| OIDC_Provider
    Frontend -->|Log data| LogRocket
    Frontend -->|Speech audio fetch| AzureSpeech
    Frontend <-->|API calls (REST & SSE)| Worker
    Worker --> Assets["Static Assets (binding to /dist)"]
    Frontend --> Assets
```
