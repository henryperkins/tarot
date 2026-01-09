# Mystic Tarot Application Architecture

> **Last Verified**: 2026-01-09
> **Verification Notes**: Comprehensive codebase review completed. See discrepancies section below.

```mermaid
graph TD
    %% ============================================
    %% EXTERNAL SERVICES
    %% ============================================
    resend_api["**Resend Email API**<br>functions/lib/emailService.js<br>`RESEND_API_KEY`"]
    jspdf_lib["**jsPDF Library**<br>[External NPM Package]"]
    stripe_api["**Stripe Payments**<br>functions/api/webhooks/stripe.js<br>`STRIPE_SECRET_KEY`"]
    ephemeris_server["**Ephemeris Server**<br>functions/lib/ephemerisIntegration.js<br>Astrological Context MCP"]
    hume_tts["**Hume AI TTS**<br>functions/api/tts-hume.js<br>`HUME_API_KEY`"]

    %% ============================================
    %% CLOUDFLARE SERVICES
    %% ============================================
    cf_workers_ai["**Cloudflare Workers AI**<br>wrangler.jsonc `binding: AI`<br>Used for evaluation"]
    cf_d1_db["**Cloudflare D1 Database**<br>wrangler.jsonc `binding: DB`<br>mystic-tarot-db"]
    cf_kv_ratelimit["**Cloudflare KV - Ratelimit**<br>wrangler.jsonc `binding: RATELIMIT`"]
    cf_kv_feedback["**Cloudflare KV - Feedback**<br>wrangler.jsonc `binding: FEEDBACK_KV`"]
    cf_kv_metrics["**Cloudflare KV - Metrics**<br>wrangler.jsonc `binding: METRICS_DB`"]
    cf_assets["**Cloudflare Assets**<br>wrangler.jsonc `assets.directory: ./dist`<br>SPA fallback enabled"]

    %% ============================================
    %% AZURE AI SERVICES
    %% ============================================
    azure_openai["**Azure OpenAI GPT-5**<br>functions/api/tarot-reading.js<br>`AZURE_OPENAI_API_KEY`<br>Primary narrative generation"]
    azure_anthropic["**Azure AI Foundry Anthropic**<br>functions/api/tarot-reading.js<br>`AZURE_ANTHROPIC_API_KEY`<br>Claude fallback provider"]
    azure_openai_tts["**Azure OpenAI TTS**<br>functions/api/tts.js<br>`gpt-4o-mini-tts`<br>Steerable speech synthesis"]
    azure_speech_sdk["**Azure Cognitive Services**<br>functions/api/speech-token.js<br>`AZURE_SPEECH_KEY`<br>Client-side Speech SDK tokens"]

    %% ============================================
    %% FRONTEND APPLICATION
    %% ============================================
    subgraph frontend["**Frontend Application (React + Vite)**"]
        main_app["**Main App Entry**<br>src/main.jsx<br>`ReactDOM.createRoot()`"]
        
        subgraph contexts["**Context Providers (5)**"]
            auth_ctx["AuthProvider"]
            sub_ctx["SubscriptionProvider"]
            pref_ctx["PreferencesProvider"]
            reading_ctx["ReadingProvider"]
            toast_ctx["ToastProvider"]
        end
        
        subgraph pages["**Page Components**<br>src/pages/"]
            home_page["Home / TarotReading"]
            account_page["AccountPage"]
            admin_page["AdminDashboard"]
            gallery_page["CardGalleryPage"]
            pricing_page["PricingPage"]
            share_page["ShareReading"]
            journal_page["JournalPage"]
        end
        
        ui_components["**UI Components**<br>src/components/"]
        utility_hooks["**Hooks & Utils**<br>src/hooks/, src/lib/"]
        tarot_reading["**TarotReading Component**<br>src/TarotReading.jsx"]
        pdf_export["**PDF Export**<br>src/lib/pdfExport.js"]
        audio_sdk["**Audio Speech SDK**<br>src/lib/audioSpeechSDK.js"]
    end

    %% ============================================
    %% WORKER APPLICATION
    %% ============================================
    subgraph worker["**Cloudflare Worker (tableau)**<br>wrangler.jsonc `main: ./src/worker/index.js`"]
        worker_router["**Worker Router**<br>src/worker/index.js<br>`export default { fetch, scheduled }`"]
        
        subgraph api_handlers["**API Handlers**<br>functions/api/"]
            reading_api["tarot-reading.js<br>Main reading endpoint"]
            tts_api["tts.js<br>Azure OpenAI TTS"]
            tts_hume_api["tts-hume.js<br>Hume AI TTS"]
            speech_token_api["speech-token.js<br>Azure Speech tokens"]
            share_api["share.js, share/[token].js"]
            journal_api["journal.js, journal/[id].js<br>journal-export.js"]
            auth_api["auth/login.js, logout.js<br>me.js, register.js"]
            stripe_api_handlers["webhooks/stripe.js<br>create-checkout-session.js<br>create-portal-session.js"]
            usage_api["usage.js"]
            feedback_api["feedback.js"]
            admin_api["admin/quality-stats.js"]
            archetype_api["archetype-journey.js<br>archetype-journey/[[path]].js"]
        end
        
        subgraph lib_modules["**Library Modules**<br>functions/lib/"]
            email_service["emailService.js<br>Resend API integration"]
            quality_alerts["qualityAlerts.js<br>Multi-channel alerts"]
            scheduled_handler["scheduled.js<br>`handleScheduled()`<br>Cron: 0 3 * * *"]
            share_data["shareData.js<br>`loadShareRecord()`"]
            narrative_builder["narrativeBuilder.js<br>Spread-specific prompts"]
            graph_rag["graphRAG.js<br>Knowledge graph retrieval"]
            quality_analysis["qualityAnalysis.js<br>Regression detection"]
            evaluation["evaluation.js<br>Safety gate + async eval"]
            ephemeris_int["ephemerisIntegration.js<br>Astrological context"]
        end
        
        og_injector["**OG Tag Injector**<br>`handleSharePageWithOgTags()`"]
    end

    %% ============================================
    %% FRONTEND INTERNAL CONNECTIONS
    %% ============================================
    main_app --> contexts
    main_app --> pages
    pages --> ui_components
    pages --> contexts
    ui_components --> utility_hooks
    tarot_reading --> ui_components
    tarot_reading --> contexts
    tarot_reading --> pdf_export
    tarot_reading --> audio_sdk

    %% ============================================
    %% FRONTEND TO EXTERNAL
    %% ============================================
    pdf_export -->|"Generates PDFs"| jspdf_lib
    audio_sdk -->|"Client-side speech"| azure_speech_sdk

    %% ============================================
    %% FRONTEND TO WORKER
    %% ============================================
    pages -->|"API calls"| worker_router

    %% ============================================
    %% WORKER INTERNAL CONNECTIONS
    %% ============================================
    worker_router -->|"Routes /api/*"| api_handlers
    worker_router -->|"Cron trigger"| scheduled_handler
    worker_router -->|"/share/:token"| og_injector
    worker_router -->|"Static assets"| cf_assets
    
    reading_api --> narrative_builder
    reading_api --> graph_rag
    reading_api --> evaluation
    reading_api --> ephemeris_int
    
    scheduled_handler --> quality_analysis
    scheduled_handler --> quality_alerts
    quality_alerts --> email_service
    
    og_injector --> share_data

    %% ============================================
    %% WORKER TO CLOUDFLARE SERVICES
    %% ============================================
    api_handlers -->|"DB operations"| cf_d1_db
    api_handlers -->|"Rate limiting"| cf_kv_ratelimit
    feedback_api -->|"Store feedback"| cf_kv_feedback
    reading_api -->|"Store metrics"| cf_kv_metrics
    evaluation -->|"AI inference"| cf_workers_ai
    
    scheduled_handler -->|"Archive to D1"| cf_d1_db
    scheduled_handler -->|"Cleanup KV"| cf_kv_metrics
    scheduled_handler -->|"Cleanup KV"| cf_kv_feedback
    
    og_injector -->|"Load share data"| cf_d1_db
    og_injector -->|"Fetch index.html"| cf_assets

    %% ============================================
    %% WORKER TO AZURE SERVICES
    %% ============================================
    reading_api -->|"GPT-5 narrative"| azure_openai
    reading_api -->|"Claude fallback"| azure_anthropic
    tts_api -->|"gpt-4o-mini-tts"| azure_openai_tts
    speech_token_api -->|"Issue tokens"| azure_speech_sdk

    %% ============================================
    %% WORKER TO OTHER EXTERNAL SERVICES
    %% ============================================
    email_service -->|"Send emails"| resend_api
    tts_hume_api -->|"Hume synthesis"| hume_tts
    stripe_api_handlers -->|"Payments"| stripe_api
    ephemeris_int -->|"Astrological data"| ephemeris_server
```

---

## Security Architecture

### Trust Zones & Boundaries

```mermaid
graph TB
    subgraph untrusted["🔴 Untrusted Zone (Internet)"]
        browser["Browser Client"]
        external_bots["Social Media Crawlers"]
    end

    subgraph edge["🟡 Edge Zone (Cloudflare)"]
        cf_ddos["DDoS Protection"]
        cf_waf["Web Application Firewall"]
        cf_assets_cdn["Assets CDN"]
    end

    subgraph worker_zone["🟢 Worker Zone (Cloudflare Workers)"]
        worker_entry["Worker Entry Point<br>src/worker/index.js"]
        cors_handler["CORS Handler<br>handleOptions() / addCorsHeaders()"]
        route_matcher["Route Matcher<br>matchRoute()"]
        
        subgraph auth_layer["Authentication Layer"]
            session_auth["Session Auth<br>validateSession()"]
            api_key_auth["API Key Auth<br>validateApiKey()"]
            cookie_parser["Cookie Parser<br>getSessionFromCookie()"]
        end
        
        subgraph rate_limit_layer["Rate Limiting Layer"]
            usage_tracking["Usage Tracking<br>usageTracking.js"]
            tier_limits["Tier-Based Limits<br>entitlements.js"]
            kv_ratelimit["KV Rate Store<br>RATELIMIT binding"]
        end
        
        subgraph safety_layer["Safety & Evaluation Layer"]
            crisis_detection["Crisis Detection<br>safetyChecks.js"]
            eval_gate["Evaluation Gate<br>evaluation.js"]
            pii_redaction["PII Redaction<br>promptEngineering.js"]
        end
        
        api_handlers["API Handlers<br>functions/api/"]
    end

    subgraph storage_zone["🔵 Storage Zone (Cloudflare)"]
        d1_db["D1 Database<br>Users, Sessions, Journals"]
        kv_metrics["KV: METRICS_DB"]
        kv_feedback["KV: FEEDBACK_KV"]
        r2_logs["R2: LOGS_BUCKET"]
    end

    subgraph ai_zone["🟣 AI Zone (External Services)"]
        azure_openai["Azure OpenAI<br>GPT-5 / TTS"]
        azure_anthropic["Azure Anthropic<br>Claude Fallback"]
        cf_workers_ai["Workers AI<br>Evaluation"]
    end

    browser --> cf_ddos
    external_bots --> cf_ddos
    cf_ddos --> cf_waf
    cf_waf --> cf_assets_cdn
    cf_waf --> worker_entry

    worker_entry --> cors_handler
    cors_handler --> route_matcher
    route_matcher --> auth_layer
    auth_layer --> rate_limit_layer
    rate_limit_layer --> safety_layer
    safety_layer --> api_handlers

    api_handlers --> storage_zone
    api_handlers --> ai_zone
    
    auth_layer --> d1_db
    rate_limit_layer --> kv_ratelimit
```

### Authentication Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant W as Worker
    participant A as Auth Layer
    participant D as D1 Database

    C->>W: Request with credentials
    W->>A: getUserFromRequest()
    
    alt Has Bearer Token (sk_*)
        A->>D: validateApiKey(token)
        D-->>A: API Key record + user
        A-->>W: User with auth_provider: 'api_key'
    else Has Bearer Token (session)
        A->>D: validateSession(token)
        D-->>A: Session + user data
        A-->>W: User with sessionId
    else Has Cookie
        A->>A: getSessionFromCookie()
        A->>D: validateSession(token)
        D-->>A: Session + user data
        A-->>W: User with sessionId
    else No credentials
        A-->>W: null (anonymous)
    end
    
    W->>W: Apply tier-based permissions
```

### Security Features by Layer

| Layer | Feature | Implementation |
|-------|---------|----------------|
| **Password Storage** | PBKDF2 (100k iterations) | [`functions/lib/auth.js:hashPassword()`](functions/lib/auth.js:26) |
| **Session Management** | HTTP-only SameSite cookies, 30-day expiry | [`functions/lib/auth.js:createSessionCookie()`](functions/lib/auth.js:289) |
| **API Keys** | SHA-256 hashed, `sk_` prefix | [`functions/lib/apiKeys.js:hashApiKey()`](functions/lib/apiKeys.js:25) |
| **CORS** | Origin echo, credentialed support | [`src/worker/index.js:handleOptions()`](src/worker/index.js:268) |
| **Rate Limiting** | Tier-based (guest: 20, user: 100, API: 1000) | [`functions/lib/usageTracking.js`](functions/lib/usageTracking.js:1) |
| **Crisis Detection** | Regex-based self-harm/medical patterns | [`functions/lib/safetyChecks.js:detectCrisisSignals()`](functions/lib/safetyChecks.js:66) |
| **Content Evaluation** | Workers AI safety scoring | [`functions/lib/evaluation.js:runSyncEvaluationGate()`](functions/lib/evaluation.js:715) |
| **PII Redaction** | Email, phone, SSN, dates, names | [`functions/lib/evaluation.js:redactUserQuestion()`](functions/lib/evaluation.js:33) |
| **Timing-Safe Comparison** | Constant-time password/key verification | [`functions/lib/crypto.js:timingSafeEqual()`](functions/lib/crypto.js:1) |

---

## Data Flow Architecture

### Reading Request Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant W as Worker Router
    participant V as Validation
    participant A as Auth
    participant R as Rate Limiter
    participant S as Safety Checks
    participant N as Narrative Backend
    participant E as Evaluation Gate
    participant M as Metrics Storage

    C->>W: POST /api/tarot-reading
    W->>W: CORS preflight (if OPTIONS)
    W->>V: safeParseReadingRequest()
    V-->>W: Validated payload
    
    W->>A: getUserFromRequest()
    A-->>W: User + subscription context
    
    W->>R: enforceReadingLimit()
    alt Limit exceeded
        R-->>C: 429 Tier Limited
    end
    
    W->>S: detectCrisisSignals()
    alt Crisis detected
        S-->>C: Safe fallback reading
    end
    
    W->>N: performSpreadAnalysis()
    N->>N: analyzeSpreadThemes()
    N->>N: GraphRAG retrieval
    N->>N: Ephemeris context
    
    loop Try narrative backends
        W->>N: runNarrativeBackend()
        N->>N: Build prompts
        N->>N: Call AI provider
        N->>N: Quality gate check
        alt Quality passes
            N-->>W: Reading content
        else Quality fails
            N->>N: Try next backend
        end
    end
    
    W->>E: runSyncEvaluationGate()
    alt Eval blocks
        E-->>C: Safe fallback + gateBlocked
    end
    
    W->>M: persistReadingMetrics()
    W->>E: scheduleEvaluation() (async)
    W-->>C: Reading response
```

### Subscription & Entitlement Flow

```mermaid
flowchart LR
    subgraph client["Client Request"]
        req[Request]
    end

    subgraph auth["Authentication"]
        auth_check{Auth Type?}
        session[Session Cookie]
        api_key[API Key sk_*]
        anon[Anonymous]
    end

    subgraph subscription["Subscription Context"]
        get_ctx["getSubscriptionContext()"]
        tier_check{Tier Check}
        free[Free: 5 reads/mo]
        plus[Plus: 50 reads/mo]
        pro[Pro: Unlimited + API]
    end

    subgraph entitlements["Entitlement Gates"]
        spread_gate{Spread Allowed?}
        api_gate{API Access?}
        usage_gate{Within Limits?}
    end

    req --> auth_check
    auth_check -->|Cookie| session
    auth_check -->|Bearer sk_| api_key
    auth_check -->|None| anon
    
    session --> get_ctx
    api_key --> get_ctx
    anon --> get_ctx
    
    get_ctx --> tier_check
    tier_check -->|free| free
    tier_check -->|plus| plus
    tier_check -->|pro| pro
    
    free --> spread_gate
    plus --> spread_gate
    pro --> spread_gate
    
    spread_gate -->|Yes| api_gate
    spread_gate -->|No| reject1[403 Tier Limited]
    
    api_gate -->|Yes| usage_gate
    api_gate -->|No| reject2[403 Pro Required]
    
    usage_gate -->|Yes| proceed[Process Reading]
    usage_gate -->|No| reject3[429 Limit Exceeded]
```

### Metrics & Evaluation Pipeline

```mermaid
flowchart TB
    subgraph sync_path["Synchronous Path"]
        reading[Reading Generated]
        gate_check["runSyncEvaluationGate()"]
        gate_decision{Gate Decision}
        safe_fallback[Safe Fallback Reading]
        pass_through[Original Reading]
    end

    subgraph async_path["Async Path (waitUntil)"]
        schedule["scheduleEvaluation()"]
        run_eval["runEvaluation()"]
        heuristic["buildHeuristicScores()"]
        eval_decision{Eval Result?}
    end

    subgraph storage["Storage"]
        metrics_kv["METRICS_DB KV"]
        block_log["Block Event Log"]
        gateway_patch["AI Gateway Metadata"]
    end

    reading --> gate_check
    gate_check --> gate_decision
    gate_decision -->|Blocked| safe_fallback
    gate_decision -->|Passed| pass_through
    
    safe_fallback --> block_log
    pass_through --> schedule
    
    schedule --> run_eval
    run_eval --> eval_decision
    eval_decision -->|Success| metrics_kv
    eval_decision -->|Error/Timeout| heuristic
    heuristic --> metrics_kv
    
    metrics_kv --> gateway_patch
```

---

## Rate Limiting Strategy

### Tier-Based Limits

| Tier | Monthly Readings | TTS Requests | API Calls | Spreads Available |
|------|-----------------|--------------|-----------|-------------------|
| **Free** | 5 | 10 | 0 | Single, Three-Card, Five-Card |
| **Plus** | 50 | 100 | 0 | All standard spreads |
| **Pro** | Unlimited | 500 | 1000/month | All + custom spreads |

### Implementation Details

```
Storage Hierarchy:
1. Authenticated users → D1 usage_tracking table (per user/month)
2. Anonymous users → KV RATELIMIT (per IP/month)
3. Global rate limits → KV with TTL

Key Format:
- readings-monthly:{clientId}:{YYYY-MM}
- tts-monthly:{userId}:{YYYY-MM}
- api-calls:{userId}:{YYYY-MM}

Reservation Pattern:
- Pre-increment counter before expensive operations
- Release on failure via releaseReadingReservation()
- Prevents usage leaks on errors
```

---

## Verification Summary

### ✅ Verified Correct Components

| Component | Location | Status |
|-----------|----------|--------|
| React + Vite Frontend | `src/main.jsx` | ✅ Correct |
| Worker Entry Point | `src/worker/index.js` | ✅ Correct |
| D1 Database (DB) | `wrangler.jsonc` | ✅ Correct |
| KV Namespaces (3) | `wrangler.jsonc` | ✅ Correct |
| Workers AI | `wrangler.jsonc` | ✅ Correct |
| Assets Binding | `wrangler.jsonc` | ✅ Correct |
| Scheduled Handler | `functions/lib/scheduled.js` | ✅ Correct |
| Azure OpenAI GPT-5 | `functions/api/tarot-reading.js` | ✅ Correct |
| Azure Anthropic Claude | `functions/api/tarot-reading.js` | ✅ Correct |
| Share OG Injector | `src/worker/index.js` | ✅ Correct |

### ⚠️ Discrepancies Found

| Original Diagram | Actual Implementation | Impact |
|-----------------|----------------------|--------|
| "External Email Service" | **Resend API** (`RESEND_API_KEY`) | Rename needed |
| Generic "Context Providers" | **5 specific providers**: Auth, Subscription, Preferences, Reading, Toast | Add detail |
| Generic "Page Components" | **7 specific pages**: Home, Account, Admin, Gallery, Pricing, Share, Journal | Add detail |
| "Azure TTS" (single) | **Two TTS systems**: Azure OpenAI gpt-4o-mini-tts + Hume AI | Split node |
| Missing | **Stripe Integration**: checkout, portal, webhooks | Add nodes |
| Missing | **Auth System**: login, logout, register, me | Add nodes |
| Missing | **Journal System**: CRUD, export, patterns | Add nodes |
| Missing | **Archetype Journey**: tracking, backfill | Add nodes |
| Missing | **Hume AI TTS**: `functions/api/tts-hume.js` | Add node |
| Missing | **Ephemeris Server**: astrological context | Add node |
| Missing | **GraphRAG System**: knowledge graph retrieval | Add to lib |
| Missing | **Quality Analysis**: regression detection | Add to lib |

### 📦 Complete API Endpoint Inventory

```
functions/api/
├── archetype-journey.js
├── archetype-journey/
│   ├── [[path]].js
│   └── card-frequency.js
├── archetype-journey-backfill.js
├── auth/
│   ├── login.js
│   ├── logout.js
│   ├── me.js
│   └── register.js
├── admin/
│   └── quality-stats.js
├── coach-extraction-backfill.js
├── create-checkout-session.js
├── create-portal-session.js
├── feedback.js
├── generate-question.js
├── journal.js
├── journal/
│   ├── [id].js
│   └── pattern-alerts.js
├── journal-export.js
├── share.js
├── share/[token].js
├── share-notes/[token].js
├── speech-token.js
├── tarot-reading.js
├── tts.js
├── tts-hume.js
├── usage.js
└── webhooks/
    └── stripe.js
```

### 🔧 Environment Secrets Required

| Secret | Service | Used By |
|--------|---------|---------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI | tarot-reading.js |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI | tarot-reading.js |
| `AZURE_OPENAI_GPT5_MODEL` | Azure OpenAI | tarot-reading.js |
| `AZURE_ANTHROPIC_API_KEY` | Azure AI Foundry | tarot-reading.js |
| `AZURE_ANTHROPIC_ENDPOINT` | Azure AI Foundry | tarot-reading.js |
| `AZURE_OPENAI_TTS_API_KEY` | Azure OpenAI TTS | tts.js |
| `AZURE_OPENAI_TTS_ENDPOINT` | Azure OpenAI TTS | tts.js |
| `AZURE_SPEECH_KEY` | Azure Cognitive Services | speech-token.js |
| `AZURE_SPEECH_REGION` | Azure Cognitive Services | speech-token.js |
| `RESEND_API_KEY` | Resend Email | emailService.js |
| `STRIPE_SECRET_KEY` | Stripe | webhooks/stripe.js |
| `STRIPE_WEBHOOK_SECRET` | Stripe | webhooks/stripe.js |
| `HUME_API_KEY` | Hume AI | tts-hume.js |
| `VISION_PROOF_SECRET` | Vision validation | tarot-reading.js |
| `ADMIN_API_KEY` | Admin endpoints | scheduled.js |

### 📊 Cron Schedule

| Schedule | Task | Handler |
|----------|------|---------|
| `0 3 * * *` (Daily 3 AM UTC) | Archive metrics/feedback KV→D1, cleanup sessions, quality analysis | `handleScheduled()` |
*Generated by [CodeViz.ai](https://codeviz.ai) on 1/9/2026, 7:31:12 AM*
