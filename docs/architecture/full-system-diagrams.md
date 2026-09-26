# Full System Diagrams

Type: reference
Status: active reference
Last reviewed: 2026-09-25

This document contains comprehensive Mermaid diagrams covering the current application architecture.

These diagrams are maintained as high-level references, not exact schema dumps. Validate route ownership, bindings, and database fields against `src/worker/index.js`, `wrangler.jsonc`, `functions/`, and `migrations/` when making implementation changes.

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph External["External Services"]
        ModalQwen["Modal Qwen<br/>Chat Completions"]
        OpenAI["OpenAI native Responses<br/>azure-gpt5"]
        AzureOpenAI["Azure OpenAI Responses<br/>azure-gpt5 fallback"]
        Claude["Azure AI Foundry<br/>Claude Opus 4.5"]
        AzureTTS["Azure OpenAI<br/>Text-to-Speech"]
        AzureSpeech["Azure Speech<br/>Client Tokens"]
        HumeAI["Hume AI<br/>Alternative TTS"]
        Stripe["Stripe<br/>Checkout, Portal, Webhooks"]
        EmailService["Email Service<br/>Quality Alerts"]
        Sentry["Sentry<br/>Errors and sampled replay"]
    end

    subgraph Cloudflare["Cloudflare Infrastructure"]
        Worker["Cloudflare Worker<br/>src/worker/index.js"]
        ReadingJob["READING_JOBS Durable Object<br/>ReadingJob"]
        WorkersAI["Workers AI<br/>Qwen evaluation; optional Llama vision"]
        D1["D1 (DB)<br/>App data, eval_metrics, quality, usage, media metadata"]
        KV_Rate["KV RATELIMIT<br/>Rate limiting"]
        KV_Feedback["KV FEEDBACK_KV<br/>Feedback cache"]
        KV_Metrics["KV METRICS_DB<br/>Media telemetry, media usage, card-video job metadata,<br/>ongoing compatibility archive input"]
        R2["R2 (R2_LOGS)<br/>Generated/user media, journal exports, archives"]
        Assets["ASSETS binding<br/>Static files"]
        Logpush["Logpush and observability"]
        CronVideo["Cron */10 * * * *<br/>Card-video usage reconciliation"]
        CronDaily["Cron 0 3 * * *<br/>Quality analysis, ongoing KV compatibility archival, cleanup"]
    end

    subgraph App["Tarot Application"]
        Frontend["Frontend<br/>React + Vite"]
        Shared["Shared<br/>Isomorphic modules"]
        LocalComposer["Local composer<br/>Deterministic fallback"]
    end

    Frontend <-->|"API calls and SSE"| Worker
    Worker --> WorkersAI
    Worker --> D1
    Worker --> KV_Rate
    Worker --> KV_Feedback
    Worker --> KV_Metrics
    Worker --> R2
    Worker --> Assets
    Worker --> Logpush
    Worker -->|"/api/tarot-reading/jobs/*"| ReadingJob
    Worker -->|1. narrative| ModalQwen
    Worker -->|2. azure-gpt5: native| OpenAI
    Worker -->|2. azure-gpt5: Azure fallback| AzureOpenAI
    Worker -->|3. fallback| Claude
    Worker -->|4. deterministic fallback| LocalComposer
    Worker -->|TTS| AzureTTS
    Worker -->|TTS alternative| HumeAI
    Worker -->|Payments| Stripe
    Worker -->|Alerts| EmailService
    Worker -->|Diagnostics and replay| Sentry
    Frontend --> AzureSpeech
    Worker --> CronVideo
    Worker --> CronDaily
    CronVideo --> KV_Metrics
    CronDaily --> D1
    CronDaily --> KV_Metrics
    Shared -.->|"Used by"| Frontend
    Shared -.->|"Used by"| Worker
```

## 2. Frontend Application Architecture

```mermaid
graph TB
    subgraph Entry["Application Entry"]
        Main["main.jsx<br>ReactDOM.createRoot"]
    end

    subgraph Contexts["Context Providers"]
        AuthCtx["AuthContext<br>Authentication State"]
        PrefsCtx["PreferencesContext<br>User Preferences"]
        ReadCtx["ReadingContext<br>Current Reading"]
        SubCtx["SubscriptionContext<br>Subscription State"]
        ToastCtx["ToastContext<br>Notifications"]
    end

    subgraph Pages["Page Components"]
        TarotReading["TarotReading.jsx<br>Main Reading Page"]
        AccountPage["AccountPage.jsx<br>User Account"]
        AdminDash["AdminDashboard.jsx<br>Quality Dashboard"]
        CardGallery["CardGalleryPage.jsx<br>Card Browser"]
        PricingPage["PricingPage.jsx<br>Subscription Plans"]
        ShareReading["ShareReading.jsx<br>Shared View"]
    end

    subgraph Components["UI Components"]
        direction TB
        ReadingComps["Reading Components<br>Card, CardModal, DeckPile<br>ReadingBoard, SpreadSelector"]
        AudioComps["Audio Components<br>AudioControls, NarrationText"]
        NarrativeComps["Narrative Components<br>StreamingNarrative, FollowUpSection"]
        VisionComps["Vision Components<br>CameraCapture, VisionHeatmapOverlay"]
        JournalComps["Journal Components<br>Journal, JournalEntryCard"]
        CoachComps["Coach Components<br>QuestionInput, GuidedIntentionCoach"]
        NavComps["Navigation<br>GlobalNav, Header, UserMenu"]
        ModalComps["Modals<br>AuthModal, ConfirmModal"]
        AdminComps["Admin Components<br>AlertsList, ScoreTrendsChart"]
        OnboardComps["Onboarding<br>OnboardingWizard, WelcomeHero"]
        JourneyComps["Reading Journey<br>JourneyContent, MajorArcanaMap"]
        ShareComps["Share Components<br>SharedSpreadView, CollaborativeNotesPanel"]
    end

    Main --> Contexts
    Contexts --> Pages
    Pages --> Components
    TarotReading --> ReadingComps
    TarotReading --> AudioComps
    TarotReading --> NarrativeComps
    TarotReading --> VisionComps
    TarotReading --> CoachComps
    AdminDash --> AdminComps
    ShareReading --> ShareComps
```

## 3. Frontend Hooks & Libraries

```mermaid
graph TB
    subgraph Hooks["Custom Hooks (src/hooks/)"]
        direction TB
        StateHooks["State Hooks<br>useTarotState, useJournal<br>useFeatureFlags"]
        UIHooks["UI Hooks<br>useSmallScreen, useLandscape<br>useReducedMotion, useModalA11y"]
        GestureHooks["Gesture Hooks<br>useSwipeNavigation, useSwipeDismiss<br>useHaptic"]
        DataHooks["Data Hooks<br>useArchetypeJourney, useJourneyData<br>useSaveReading"]
        AudioHooks["Audio Hooks<br>useAudioController"]
        VisionHooks["Vision Hooks<br>useVisionAnalysis, useVisionValidation"]
        FormHooks["Form Hooks<br>useAutoGrow, useInlineStatus"]
        LocationHooks["Location Hooks<br>useLocation, useBodyScrollLock"]
    end

    subgraph Libs["Libraries (src/lib/)"]
        direction TB
        DeckLib["Deck<br>deck.js, cardLookup.js<br>cardInsights.js"]
        AudioLib["Audio<br>audio.js, audioCache.js<br>audioHume.js, audioSpeechSDK.js"]
        JournalLib["Journal<br>journalInsights.js"]
        CoachLib["Coach<br>intentionCoach.js, coachStorage.js<br>questionQuality.js, followUpSuggestions.js"]
        JourneyLib["Journey<br>archetypeJourney.js"]
        ExportLib["Export<br>pdfExport.js"]
        OnboardLib["Onboarding<br>onboardingMetrics.js, onboardingVariant.js"]
        StorageLib["Storage<br>safeStorage.js"]
        DisplayLib["Display<br>formatting.js, textUtils.js<br>highlightUtils.js, themeText.js<br>suitColors.js"]
    end

    subgraph Utils["Utilities (src/utils/)"]
        Personalization["personalization.js<br>personalizationStorage.js"]
        SpreadUtils["spreadEntitlements.js<br>spreadArt.js"]
    end

    subgraph Data["Data Sources (src/data/)"]
        Cards["majorArcana.js<br>minorArcana.js"]
        Spreads["spreads.js<br>spreadBrowse.js"]
        Knowledge["knowledgeGraphData.js"]
        Content["emotionMapping.js<br>exampleQuestions.js<br>symbolCoordinates.js"]
    end

    StateHooks --> DeckLib
    StateHooks --> AudioLib
    DataHooks --> JourneyLib
    DataHooks --> JournalLib
    VisionHooks --> Hooks
    DeckLib --> Cards
    DeckLib --> Spreads
    CoachLib --> Data
```

## 4. Worker API Architecture

```mermaid
graph TB
    subgraph Router["Worker Router<br>src/worker/index.js"]
        Fetch["fetch() handler"]
        CronVideo["scheduled(): */10 * * * *<br/>card-video usage reconciliation"]
        CronDaily["scheduled(): 0 3 * * *<br/>quality, compatibility archival, cleanup"]
        ShareOG["Share page OG injector"]
    end

    subgraph CoreAPIs["Core Reading APIs"]
        TarotAPI["POST /api/tarot-reading<br/>Main reading generation"]
        TarotDraw["POST /api/tarot-reading/draw<br/>Seeded draw"]
        TarotJobsStart["POST /api/tarot-reading/jobs<br/>Start job"]
        TarotJobsStream["GET /api/tarot-reading/jobs/:id/stream<br/>SSE stream"]
        TarotJobsCancel["POST /api/tarot-reading/jobs/:id/cancel<br/>Cancel job"]
        TarotJobsStatus["GET /api/tarot-reading/jobs/:id<br/>Job status"]
        FollowUpAPI["POST /api/reading-followup<br/>Follow-up questions"]
        GenerateQ["POST /api/generate-question<br/>AI question generation"]
        VisionAPI["POST /api/vision-proof<br/>Signed vision evidence"]
    end

    subgraph ReadingJobs["Configured Durable Object"]
        ReadingJob["READING_JOBS / ReadingJob<br/>Job state, bounded event replay, public SSE"]
    end

    subgraph AudioAPIs["Audio APIs"]
        TTSAPI["POST /api/tts<br>Azure TTS"]
        TTSHumeAPI["POST /api/tts-hume<br>Hume AI TTS"]
        SpeechToken["GET /api/speech-token<br>Azure Speech Tokens"]
    end

    subgraph JournalAPIs["Journal APIs"]
        JournalCRUD["POST/GET /api/journal<br>Journal CRUD"]
        JournalID["GET/DELETE /api/journal/[id]<br>Single Entry"]
        JournalSearch["GET /api/journal/search<br>Search Entries"]
        JournalFollowups["POST /api/journal/[id]/followups<br>Follow-up Threads"]
        JournalPattern["GET /api/journal/pattern-alerts<br>Pattern Detection"]
        JournalSummary["POST /api/journal-summary<br>AI Summarization"]
        JournalExport["GET /api/journal-export(/:id)<br>Export Journal"]
    end

    subgraph ShareAPIs["Sharing APIs"]
        ShareCreate["POST /api/share<br>Create Share"]
        ShareGet["GET /api/share/[token]<br>Get Shared Reading"]
        ShareOGImage["GET /api/share/[token]/og-image<br>OG Image"]
        ShareNotes["POST /api/share-notes/[token]<br>Collaborative Notes"]
    end

    subgraph AuthAPIs["Authentication APIs"]
        Login["POST /api/auth/login"]
        Register["POST /api/auth/register"]
        Logout["POST /api/auth/logout"]
        Me["GET /api/auth/me"]
        ForgotPassword["POST /api/auth/forgot-password"]
        ResetPassword["POST /api/auth/reset-password"]
        VerifyEmail["POST /api/auth/verify-email"]
        VerifyEmailResend["POST /api/auth/verify-email/resend"]
    end

    subgraph AccountAPIs["Account APIs"]
        AccountProfile["PATCH /api/account/profile"]
        AccountPassword["POST /api/account/password"]
        AccountDelete["POST /api/account/delete"]
    end

    subgraph SubscriptionAPIs["Subscription APIs"]
        Subscription["GET /api/subscription"]
        SubscriptionRestore["POST /api/subscription/restore"]
    end

    subgraph PaymentAPIs["Payment APIs"]
        Checkout["POST /api/create-checkout-session<br>Stripe Checkout"]
        Portal["POST /api/create-portal-session<br>Customer Portal"]
        Webhook["POST /api/webhooks/stripe<br>Stripe Webhooks"]
    end

    subgraph JourneyAPIs["Archetype Journey APIs"]
        JourneyGet["GET /api/archetype-journey<br/>Journey Data"]
        JourneyTrack["POST /api/archetype-journey/track<br/>Track card appearances"]
        JourneyPrefsGet["GET /api/archetype-journey/preferences"]
        JourneyPrefsPut["PUT /api/archetype-journey/preferences"]
        JourneyReset["POST /api/archetype-journey/reset"]
        CardFreq["GET /api/archetype-journey/card-frequency<br/>Card Stats"]
        Backfill["POST /api/archetype-journey-backfill<br/>Data Migration"]
    end

    subgraph AdminAPIs["Admin APIs"]
        Archive["POST /api/admin/archive<br>Manual Archive"]
        QualityStats["GET /api/admin/quality-stats<br>Quality Metrics"]
        HealthReading["GET /api/health/tarot-reading"]
        HealthTTS["GET /api/health/tts"]
        CoachBackfill["POST /api/coach-extraction-backfill<br>Coach Migration"]
    end

    subgraph OtherAPIs["Other APIs"]
        Feedback["POST /api/feedback"]
        Usage["GET /api/usage"]
        Memories["GET/POST/DELETE /api/memories"]
        Media["GET/POST/DELETE /api/media"]
        CardVideo["POST/GET /api/generate-card-video"]
        StoryArt["POST /api/generate-story-art"]
        KeysIndex["GET/POST /api/keys"]
        KeysID["GET/DELETE /api/keys/:id"]
    end

    Fetch --> CoreAPIs
    Fetch --> ReadingJobs
    Fetch --> AudioAPIs
    Fetch --> JournalAPIs
    Fetch --> ShareAPIs
    Fetch --> AuthAPIs
    Fetch --> AccountAPIs
    Fetch --> SubscriptionAPIs
    Fetch --> PaymentAPIs
    Fetch --> JourneyAPIs
    Fetch --> AdminAPIs
    Fetch --> OtherAPIs
```

## 5. Backend Library Architecture

```mermaid
graph TB
    subgraph GraphRAG["GraphRAG System"]
         graphRAG["graphRAG.js<br>Graph-key retrieval + relevance filtering"]
        graphRAGAlerts["graphRAGAlerts.js<br>Quality Alerts"]
        graphContext["graphContext.js<br>Context Building"]
        knowledgeGraph["knowledgeGraph.js<br>Graph Traversal"]
        knowledgeBase["knowledgeBase.js<br>Base Queries"]
         embeddings["embeddings.js<br>Optional semantic scoring"]
    end

    subgraph Narrative["Narrative Generation"]
        narrativeBuilder["narrativeBuilder.js<br>Main Builder"]
        narrativeSpine["narrativeSpine.js<br>Structure"]
        promptEng["promptEngineering.js<br>Prompt Construction"]
        promptVer["promptVersioning.js<br>Version Management"]
        azureResp["azureResponses.js<br>API Handling"]

        subgraph NarrativeHelpers["Narrative Helpers"]
            nHelpers["helpers.js"]
            nPrompts["prompts/ (modules)<br>prompts.js (barrel)"]
            nReasoning["reasoning.js"]
            nReasoningInt["reasoningIntegration.js"]
            nStyle["styleHelpers.js"]
        end

        subgraph SpreadNarratives["Spread-Specific"]
            sSingle["singleCard.js"]
            sThree["threeCard.js"]
            sFive["fiveCard.js"]
            sCeltic["celticCross.js"]
            sRelation["relationship.js"]
            sDecision["decision.js"]
        end
    end

    subgraph Quality["Quality and Evaluation"]
        readingQuality["readingQuality.js<br/>Narrative metrics and structural gate"]
        evaluation["evaluation.js<br/>Workers AI evaluation and eval gate"]
        qualityAnalysis["qualityAnalysis.js<br/>D1 metrics analysis"]
        qualityAlerts["qualityAlerts.js<br/>D1 alert dispatch"]
        safetyChecks["safetyChecks.js<br/>Content safety"]
    end

    subgraph ABTesting["A/B Testing"]
        abTesting["abTesting.js<br>Variant Assignment"]
         clientId["clientId.js<br/>Client/rate-limit identifiers (not A/B assignment)"]
    end

    subgraph CardAnalysis["Card/Spread Analysis"]
        spreadAnalysis["spreadAnalysis.js<br>Pattern Analysis"]
        cardContext["cardContextDetection.js<br>Card Context"]
        contextDetect["contextDetection.js<br>General Context"]
        imageryHooks["imageryHooks.js<br>Visual Imagery"]
        positionWeights["positionWeights.js<br>Position Weight"]
        symbolAnnot["shared/symbols/symbolAnnotations.js<br>Symbols"]
    end

    subgraph Esoteric["Esoteric/Astro Metadata"]
        esotericMeta["esotericMeta.js<br>Esoteric Data"]
        minorMeta["minorMeta.js<br>Minor Arcana"]
        ephemeris["ephemerisIntegration.js<br>Astrological"]
        ephemerisW["ephemerisWorkers.js<br>Worker Integration"]
        timingMeta["pacingHeuristics.js<br>Lunar/Timing"]
    end

    subgraph Auth["Auth & Security"]
        auth["auth.js<br>Authentication"]
        crypto["crypto.js<br>Cryptography"]
        apiKeys["apiKeys.js<br>API Keys"]
        entitlements["entitlements.js<br>Features"]
    end

    subgraph Tracking["Tracking & Analytics"]
        usageTracking["usageTracking.js<br>Usage"]
        apiUsage["apiUsage.js<br>API Usage"]
        patternTracking["patternTracking.js<br>Patterns"]
    end

    subgraph Vision["Vision System"]
        visionProof["visionProof.js<br>Proof Generation"]
        visionLabels["visionLabels.js<br>Labels"]
    end

    subgraph Coach["Coach/Follow-up"]
        coachSuggestion["coachSuggestion.js<br>Suggestions"]
        followUpPrompt["followUpPrompt.js<br>Follow-up Prompts"]
    end

    subgraph Utils["Utilities"]
        utils["utils.js"]
        environment["environment.js"]
        urlSafety["urlSafety.js"]
        shareUtils["shareUtils.js"]
        shareData["shareData.js"]
        ogImage["ogImageBuilder.js"]
        journalSearch["journalSearch.js"]
        emailService["emailService.js"]
        scheduled["scheduled.js"]
    end

    narrativeBuilder --> graphRAG
    narrativeBuilder --> promptEng
    narrativeBuilder --> NarrativeHelpers
    narrativeBuilder --> SpreadNarratives
    narrativeBuilder --> CardAnalysis
    narrativeBuilder --> Esoteric
    readingQuality --> narrativeBuilder
    evaluation --> narrativeBuilder
    qualityAnalysis --> evaluation
    qualityAlerts --> qualityAnalysis
    qualityAlerts --> emailService
    abTesting --> promptVer
    graphRAG --> embeddings
    graphRAG --> knowledgeGraph
    graphRAG --> knowledgeBase
```

## 6. Shared Modules Architecture

```mermaid
graph TB
    subgraph SharedRoot["shared/"]
        fallbackAudio["fallbackAudio.js<br>Audio Fallback"]
    end

    subgraph Contracts["shared/contracts/"]
        readingSchema["readingSchema.js<br>Reading Data Schema"]
    end

    subgraph Journal["shared/journal/"]
        dedupe["dedupe.js<br>Deduplication"]
        stats["stats.js<br>Statistics"]
        summary["summary.js<br>Summarization"]
        trends["trends.js<br>Trend Analysis"]
    end

    subgraph Monetization["shared/monetization/"]
        subscription["subscription.js<br>Subscription Logic"]
    end

    subgraph Symbols["shared/symbols/"]
        symbolAnnotations["symbolAnnotations.js<br>Symbol System"]
    end

    subgraph Vision["shared/vision/"]
        cardNameMapping["cardNameMapping.js<br>Card Names"]
        deckAssets["deckAssets.js<br>Asset Paths"]
        deckProfiles["deckProfiles.js<br>Deck Config"]
        fineTuneCache["fineTuneCache.js<br>Model Cache"]
        minorSymbolLex["minorSymbolLexicon.js<br>Minor Symbols"]
        symbolDetector["symbolDetector.js<br>Detection"]
        tarotVisionPipe["tarotVisionPipeline.js<br>Pipeline"]
        visionBackends["visionBackends.js<br>Backend Abstraction"]
        visualSemantics["visualSemantics.js<br>Semantics"]
    end

    tarotVisionPipe --> visionBackends
    tarotVisionPipe --> symbolDetector
    symbolDetector --> minorSymbolLex
    symbolDetector --> fineTuneCache
    visionBackends --> deckProfiles
    visionBackends --> deckAssets
```

## 7. Data Flow Diagrams

### 7.1 Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant AuthModal
    participant AuthAPI as auth/login.js
    participant AuthLib as auth.js
    participant D1
    participant AuthCtx as AuthContext

    User->>AuthModal: Enter credentials
    AuthModal->>AuthAPI: POST /api/auth/login
    AuthAPI->>AuthLib: validateCredentials()
    AuthLib->>D1: SELECT from users
    D1-->>AuthLib: User data
    AuthLib->>D1: INSERT session
    D1-->>AuthLib: Session token
    AuthLib-->>AuthAPI: Session + user
    AuthAPI-->>AuthModal: Set cookie + user
    AuthModal->>AuthCtx: setUser(user)
    AuthCtx-->>User: Authenticated state
```

### 7.2 Payment/Subscription Flow

```mermaid
sequenceDiagram
    participant User
    participant PricingPage
    participant CheckoutAPI as create-checkout-session.js
    participant Stripe
    participant WebhookAPI as webhooks/stripe.js
    participant D1
    participant SubCtx as SubscriptionContext

    User->>PricingPage: Select plan
    PricingPage->>CheckoutAPI: POST /api/create-checkout-session
    CheckoutAPI->>Stripe: Create session
    Stripe-->>CheckoutAPI: Session URL
    CheckoutAPI-->>PricingPage: Redirect URL
    PricingPage->>Stripe: Redirect to checkout
    User->>Stripe: Complete payment
    Stripe->>WebhookAPI: POST /api/webhooks/stripe
    WebhookAPI->>D1: UPDATE users.subscription_*
    D1-->>WebhookAPI: Confirmed
    WebhookAPI-->>Stripe: 200 OK
    User->>PricingPage: Return to app
    PricingPage->>SubCtx: Refresh subscription
    SubCtx-->>User: Premium features enabled
```

### 7.3 Reading Generation with GraphRAG Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant ReadingAPI as tarot-reading.js
    participant Analysis as spreadAnalysis.js
    participant Memory as userMemory.js
    participant GraphRAG as graphRAG.js
    participant Provider as configured narrative providers
    participant Gate as tarot-reading.js + readingQuality.js
    participant Evaluation as evaluation.js
    participant WorkersAI
    participant D1 as D1 eval_metrics

    Frontend->>ReadingAPI: POST /api/tarot-reading
    ReadingAPI->>Analysis: Analyze drawn cards, reversals, and context
    ReadingAPI->>Memory: Load stored memory when available
    Memory-->>ReadingAPI: Lower-precedence personalization context
    ReadingAPI->>GraphRAG: Retrieve eligible pattern passages
    GraphRAG-->>ReadingAPI: Optional passages and GraphRAG metadata
    ReadingAPI->>Provider: Try modal-qwen → azure-gpt5 → claude-opus45 → local-composer
    Provider-->>ReadingAPI: Accepted narrative and provider metadata
    ReadingAPI->>Gate: Check coverage, hallucinations, spine, high-weight positions
    Gate-->>ReadingAPI: Pass or retry/fallback
    ReadingAPI-->>Frontend: Reading and metadata
    ReadingAPI->>Evaluation: Schedule async evaluation
    Evaluation->>WorkersAI: Score reading
    WorkersAI-->>Evaluation: Scores and safety flag
    Evaluation->>D1: Upsert eval_metrics payload
```

### 7.4 Vision Pipeline Flow

```mermaid
sequenceDiagram
    participant User
    participant CameraCapture
    participant VisionAPI as vision-proof.js
    participant VisionBackends as visionBackends.js
    participant CLIP as tarotVisionPipeline.js
    participant Llama as llamaVisionPipeline.js
    participant SymbolDetector as symbolDetector.js
    participant VisionPanel as VisionValidationPanel

    User->>CameraCapture: Capture card image
    CameraCapture->>VisionAPI: POST /api/vision-proof
    VisionAPI->>VisionBackends: Resolve backend (default clip-default)
    VisionBackends->>CLIP: Analyze card match and symbols
    CLIP-->>VisionAPI: Matches, confidence, symbol evidence
    opt server-side llama-vision or hybrid backend
        VisionBackends->>Llama: Analyze image
        Llama-->>VisionBackends: Optional orientation, reasoning, visible details
        VisionBackends-->>VisionAPI: Optional server-side evidence
    end
    VisionAPI->>SymbolDetector: Verify symbols when enabled
    SymbolDetector-->>VisionAPI: Symbol annotations
    VisionAPI-->>CameraCapture: Sanitized results
    CameraCapture->>VisionPanel: Show validation
    VisionPanel-->>User: Confirm or correct card
```

### 7.5 Quality Evaluation & Alerting Flow

```mermaid
sequenceDiagram
    participant ReadingAPI as tarot-reading.js
    participant Evaluation as evaluation.js
    participant WorkersAI
    participant D1 as D1
    participant Scheduled as scheduled.js
    participant QualityAnalysis as qualityAnalysis.js
    participant QualityAlerts as qualityAlerts.js
    participant EmailService as emailService.js
    participant Email as External Email
    participant AdminDash as AdminDashboard

    ReadingAPI->>Evaluation: Schedule async evaluation
    Evaluation->>WorkersAI: Score reading
    WorkersAI-->>Evaluation: Scores and safety flag
    Evaluation->>D1: Upsert eval_metrics
    Scheduled->>QualityAnalysis: Daily analysis of eval_metrics
    QualityAnalysis->>D1: Write quality_stats and quality_alerts
    QualityAnalysis->>QualityAlerts: Check regression and safety thresholds
    QualityAlerts->>D1: Store alert status
    QualityAlerts->>EmailService: Send configured alert
    EmailService->>Email: Dispatch alert
    AdminDash->>QualityAnalysis: GET /api/admin/quality-stats
    QualityAnalysis->>D1: Read eval_metrics and quality tables
    QualityAnalysis-->>AdminDash: Render quality history
```

### 7.6 A/B Testing Flow (when enabled)

```mermaid
sequenceDiagram
    participant Frontend
    participant ReadingAPI as tarot-reading.js
    participant ABTesting as abTesting.js
    participant D1 as D1 eval_metrics

    Frontend->>ReadingAPI: POST /api/tarot-reading
    Note over ReadingAPI: A/B testing is disabled unless AB_TESTING_ENABLED=true
    ReadingAPI->>ABTesting: Load active experiments from D1
    ABTesting-->>ReadingAPI: Matching experiments
    ReadingAPI->>ABTesting: getABAssignment(requestId, experiments, spread/provider)
    ABTesting-->>ReadingAPI: Deterministic request-id variant
    ReadingAPI->>ReadingAPI: Apply getVariantPromptOverrides(variantId)
    ReadingAPI->>D1: Persist variant-tagged reading telemetry
    D1-->>ReadingAPI: Telemetry stored
    ReadingAPI-->>Frontend: Reading and metadata
```

### 7.7 Journal Pattern Detection Flow

```mermaid
sequenceDiagram
    participant User
    participant JournalComp as Journal Component
    participant JournalAPI as journal.js API
    participant JourneyAPI as archetype-journey.js
    participant PatternTracking as patternTracking.js
    participant D1 as D1
    participant PatternAlerts as journal/pattern-alerts.js
    participant PatternBanner as PatternAlertBanner

    User->>JournalComp: Save journal entry
    JournalComp->>JournalAPI: POST /api/journal
    JournalAPI->>D1: INSERT journal_entries
    JournalAPI-->>JournalComp: Entry saved
    JournalComp->>JourneyAPI: Best-effort POST /api/archetype-journey/track
    JourneyAPI->>D1: INSERT card_appearances
    JourneyAPI->>PatternTracking: Track eligible graph patterns
    PatternTracking->>D1: INSERT pattern_occurrences
    JourneyAPI-->>JournalComp: Tracking result

    JournalComp->>PatternAlerts: GET /api/journal/pattern-alerts
    PatternAlerts->>D1: Query recent patterns
    PatternAlerts-->>JournalComp: Active alerts
    JournalComp->>PatternBanner: Display alerts
    PatternBanner-->>User: Show pattern insights
```

### 7.8 Follow-up Flow

```mermaid
sequenceDiagram
    participant User
    participant FollowUpSection
    participant FollowUpAPI as reading-followup.js
    participant JournalSearch as journalSearch.js
    participant FollowUpPrompt as followUpPrompt.js
    participant D1
    participant Provider as Azure Responses follow-up provider

    User->>FollowUpSection: Request follow-up
    FollowUpSection->>FollowUpAPI: POST /api/reading-followup
    FollowUpAPI->>JournalSearch: Find related journal entries and patterns
    JournalSearch->>D1: Query journal_entries when entitled
    D1-->>JournalSearch: Related entries
    JournalSearch-->>FollowUpAPI: Optional journal context
    FollowUpAPI->>FollowUpPrompt: buildFollowUpPrompt(reading, context, history)
    FollowUpPrompt-->>FollowUpAPI: Bounded follow-up prompt
    FollowUpAPI->>Provider: Generate response
    Provider-->>FollowUpAPI: Follow-up narrative
    FollowUpAPI-->>FollowUpSection: Response, turn, optional journal context, metadata
```

### 7.9 Archetype Journey Flow

```mermaid
sequenceDiagram
    participant User
    participant JourneyPage as ReadingJourney
    participant JourneyAPI as archetype-journey.js
    participant D1 as D1
    participant JourneyHook as useArchetypeJourney
    participant JourneyStory as JourneyStorySection

    User->>JourneyPage: View journey
    JourneyPage->>JourneyHook: useArchetypeJourney()
    JourneyHook->>JourneyAPI: GET /api/archetype-journey
    JourneyAPI->>D1: Query card_appearances, archetype_badges, user_analytics_prefs
    D1-->>JourneyAPI: Journey records
    JourneyAPI-->>JourneyHook: Journey data
    JourneyHook-->>JourneyPage: State update
    JourneyPage->>JourneyStory: Render sections
    JourneyStory-->>User: Display journey visualization
```

## 8. Database Schema Overview (Current)

`migrations/*.sql` is authoritative for columns and constraints. The table-name map below replaces the obsolete schema diagram; it intentionally does not infer relationships that are not defined by the migrations.

| Area | Current tables |
|---|---|
| Accounts and auth | `users`, `sessions`, `user_tokens`, `api_keys` |
| Journal and sharing | `journal_entries`, `journal_followups`, `share_tokens`, `share_token_entries`, `share_notes`, `share_note_reports` |
| Journey and patterns | `card_appearances`, `archetype_badges`, `user_analytics_prefs`, `pattern_occurrences`, `pattern_tracking_failures` |
| Personalization and follow-up | `user_memories`, `follow_up_usage` |
| Media and usage | `user_media`, `usage_tracking`, `processed_webhook_events` |
| Reading quality | `eval_metrics`, `quality_stats`, `quality_alerts`, `ab_experiments` |
| Compatibility archives | `metrics_archive`, `feedback_archive`, `archival_summaries` |
| OAuth operations | `oauth_registration_counters` |
| Migration bookkeeping | `_migrations` |
| Legacy reading tables | `readings`, `cards`, `reading_stats` |

The legacy reading tables are retained for compatibility; the current reading path stores journal content in `journal_entries` and runtime reading/evaluation telemetry in `eval_metrics`.


## 9. External Service Integrations

```mermaid
graph LR
    subgraph NarrativeProviders["Narrative Providers"]
        Modal["Modal Qwen<br/>Chat Completions"]
        OpenAI["OpenAI native Responses<br/>azure-gpt5 when configured"]
        Azure["Azure OpenAI Responses<br/>azure-gpt5 fallback"]
        Claude["Azure AI Foundry<br/>Claude Opus 4.5"]
        Local["Local composer<br/>Deterministic fallback"]
    end

    subgraph Worker["Cloudflare Worker"]
        API["API and scheduled handlers"]
        AI["Workers AI<br/>Qwen evaluation; optional Llama vision"]
        D1["D1 (DB)<br/>App, eval_metrics, quality, usage, media metadata"]
        KV["KV namespaces<br/>RATELIMIT, FEEDBACK_KV, METRICS_DB"]
        R2["R2_LOGS<br/>Generated/user media, exports, archives"]
        DO["READING_JOBS<br/>ReadingJob Durable Object"]
        Assets["ASSETS<br/>Static files"]
        Sentry["Sentry<br/>Errors and sampled replay"]
    end

    subgraph OtherServices["Other Services"]
        Stripe["Stripe<br/>Checkout, Portal, Webhooks"]
        AzureTTS["Azure OpenAI TTS"]
        AzureSpeech["Azure Speech<br/>Client tokens"]
        Hume["Hume AI<br/>Alternative TTS"]
        Email["Email provider<br/>Quality alerts"]
    end

    API -->|1| Modal
    API -->|2. native| OpenAI
    API -->|2. Azure fallback| Azure
    API -->|3| Claude
    API -->|4| Local
    API --> AI
    API --> D1
    API --> KV
    API --> R2
    API --> DO
    API --> Assets
    API --> Sentry
    API --> Stripe
    API --> AzureTTS
    API --> AzureSpeech
    API --> Hume
    API --> Email
```

## 10. Component Hierarchy Summary

File and route counts are intentionally omitted because they change independently of the architecture. Use the repository tree and `src/worker/index.js` for an exact inventory.

```mermaid
graph TB
    Frontend["Frontend: React + Vite"]
    Worker["Worker: src/worker/index.js + functions/api/"]
    Backend["Worker services: functions/lib/ + shared/"]
    Storage["Cloudflare storage: D1, KV, R2"]
    Jobs["Configured ReadingJob Durable Object"]
    Providers["Narrative, vision, TTS, payment, and observability providers"]

    Frontend --> Worker
    Worker --> Backend
    Worker --> Storage
    Worker --> Jobs
    Worker --> Providers
```

---

## 11. Historical CodeViz Export (Quarantined)

The previous generated CodeViz export was removed from this active reference because it contained obsolete paths, bindings, and schema assumptions. Do not use it for implementation. Any replacement export must be regenerated from `wrangler.jsonc`, `src/worker/index.js`, and `migrations/`.
