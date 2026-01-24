# Complete Architecture Diagram - Mystic Tarot Application

This document contains comprehensive Mermaid diagrams covering the full application architecture.

## 1. High-Level System Architecture

```mermaid
graph TB
    subgraph External["External Services"]
        Stripe["🔒 Stripe<br>Payment Processing"]
        AzureOpenAI["🤖 Azure OpenAI<br>GPT-5 Narrative"]
        AzureAnthropic["🤖 Azure Anthropic<br>Claude Fallback"]
        AzureTTS["🔊 Azure TTS<br>Text-to-Speech"]
        AzureSpeech["🎙️ Azure Speech SDK<br>Client Tokens"]
        HumeAI["🔊 Hume AI<br>Alternative TTS"]
        EmailService["📧 Email Service<br>Quality Alerts"]
    end

    subgraph Cloudflare["Cloudflare Infrastructure"]
        WorkersAI["⚡ Workers AI<br>Qwen Evaluation"]
        D1["🗄️ D1 Database<br>Primary Storage"]
        KV_Rate["📊 KV RATELIMIT<br>Rate Limiting"]
        KV_Feedback["📊 KV FEEDBACK_KV<br>User Feedback"]
        KV_Metrics["📊 KV METRICS_DB<br>Quality Metrics"]
        Assets["📦 Assets Binding<br>Static Files"]
        Logpush["📝 Logpush<br>Log Export"]
    end

    subgraph App["Tarot Application"]
        Frontend["🖥️ Frontend<br>React + Vite"]
        Worker["⚙️ Worker<br>src/worker/index.js"]
        Shared["📚 Shared<br>Isomorphic Modules"]
    end

    Frontend <-->|"API Calls"| Worker
    Worker --> WorkersAI
    Worker --> D1
    Worker --> KV_Rate
    Worker --> KV_Feedback
    Worker --> KV_Metrics
    Worker --> Assets
    Worker --> Logpush
    Worker -->|"Narratives"| AzureOpenAI
    Worker -->|"Fallback"| AzureAnthropic
    Worker -->|"Audio"| AzureTTS
    Worker -->|"Tokens"| AzureSpeech
    Worker -->|"Audio Alt"| HumeAI
    Worker -->|"Alerts"| EmailService
    Worker -->|"Payments"| Stripe
    Frontend --> AzureSpeech
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
        Fetch["fetch() Handler"]
        Scheduled["scheduled() Handler<br>Cron: 0 3 * * *"]
        ShareOG["Share Page OG Injector"]
    end

    subgraph CoreAPIs["Core Reading APIs"]
        TarotAPI["POST /api/tarot-reading<br>Main Reading Generation"]
        TarotJobsStart["POST /api/tarot-reading/jobs<br>Start Job"]
        TarotJobsStream["GET /api/tarot-reading/jobs/[id]/stream<br>Stream Job"]
        TarotJobsCancel["POST /api/tarot-reading/jobs/[id]/cancel<br>Cancel Job"]
        TarotJobsStatus["GET /api/tarot-reading/jobs/[id]<br>Job Status"]
        FollowUpAPI["POST /api/reading-followup<br>Follow-up Questions"]
        GenerateQ["POST /api/generate-question<br>AI Question Generation"]
        VisionAPI["POST /api/vision-proof<br>Card Vision Analysis"]
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
        JourneyGet["GET /api/archetype-journey<br>Journey Data"]
        JourneyPath["GET /api/archetype-journey/[[path]]<br>Dynamic Routes"]
        CardFreq["GET /api/archetype-journey/card-frequency<br>Card Stats"]
        Backfill["POST /api/archetype-journey-backfill<br>Data Migration"]
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
        KeysIndex["GET/POST /api/keys"]
        KeysID["GET/DELETE /api/keys/[id]"]
    end

    Fetch --> CoreAPIs
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
        graphRAG["graphRAG.js<br>Semantic Retrieval"]
        graphRAGAlerts["graphRAGAlerts.js<br>Quality Alerts"]
        graphContext["graphContext.js<br>Context Building"]
        knowledgeGraph["knowledgeGraph.js<br>Graph Traversal"]
        knowledgeBase["knowledgeBase.js<br>Base Queries"]
        embeddings["embeddings.js<br>Vector Embeddings"]
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

    subgraph Evaluation["Quality Evaluation"]
        evaluation["evaluation.js<br>Narrative Eval"]
        qualityAnalysis["qualityAnalysis.js<br>Metrics Analysis"]
        qualityAlerts["qualityAlerts.js<br>Alert Dispatch"]
        safetyChecks["safetyChecks.js<br>Content Safety"]
    end

    subgraph ABTesting["A/B Testing"]
        abTesting["abTesting.js<br>Variant Assignment"]
        clientId["clientId.js<br>Client Identity"]
    end

    subgraph CardAnalysis["Card/Spread Analysis"]
        spreadAnalysis["spreadAnalysis.js<br>Pattern Analysis"]
        cardContext["cardContextDetection.js<br>Card Context"]
        contextDetect["contextDetection.js<br>General Context"]
        imageryHooks["imageryHooks.js<br>Visual Imagery"]
        positionWeights["positionWeights.js<br>Position Weight"]
        symbolAnnot["symbolAnnotations.js<br>Symbols"]
    end

    subgraph Esoteric["Esoteric/Astro Metadata"]
        esotericMeta["esotericMeta.js<br>Esoteric Data"]
        minorMeta["minorMeta.js<br>Minor Arcana"]
        ephemeris["ephemerisIntegration.js<br>Astrological"]
        ephemerisW["ephemerisWorkers.js<br>Worker Integration"]
        timingMeta["timingMeta.js<br>Lunar/Timing"]
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
    evaluation --> narrativeBuilder
    qualityAlerts --> evaluation
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
    WebhookAPI->>D1: UPDATE subscriptions
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
    participant GraphRAG as graphRAG.js
    participant Embeddings as embeddings.js
    participant KnowledgeGraph as knowledgeGraph.js
    participant NarrativeBuilder as narrativeBuilder.js
    participant AzureOpenAI
    participant Evaluation as evaluation.js
    participant WorkersAI
    participant D1

    Frontend->>ReadingAPI: POST /api/tarot-reading
    ReadingAPI->>GraphRAG: getRelevantPassages(cards, question)
    GraphRAG->>Embeddings: generateEmbedding(query)
    Embeddings-->>GraphRAG: Query vector
    GraphRAG->>KnowledgeGraph: searchSimilar(vector)
    KnowledgeGraph-->>GraphRAG: Related passages
    GraphRAG-->>ReadingAPI: Contextual passages
    ReadingAPI->>NarrativeBuilder: buildNarrative(cards, passages, question)
    NarrativeBuilder->>AzureOpenAI: Generate narrative
    AzureOpenAI-->>NarrativeBuilder: Raw narrative
    NarrativeBuilder-->>ReadingAPI: Formatted narrative
    ReadingAPI->>Evaluation: evaluateNarrative(narrative)
    Evaluation->>WorkersAI: Qwen evaluation
    WorkersAI-->>Evaluation: Quality scores
    Evaluation-->>ReadingAPI: Evaluation results
    ReadingAPI->>D1: Store reading
    ReadingAPI-->>Frontend: Reading + metadata
```

### 7.4 Vision Pipeline Flow

```mermaid
sequenceDiagram
    participant User
    participant CameraCapture
    participant VisionAPI as vision-proof.js
    participant VisionPipeline as tarotVisionPipeline.js
    participant VisionBackends as visionBackends.js
    participant SymbolDetector as symbolDetector.js
    participant WorkersAI
    participant VisionPanel as VisionValidationPanel

    User->>CameraCapture: Capture card image
    CameraCapture->>VisionAPI: POST /api/vision-proof
    VisionAPI->>VisionPipeline: processImage(image)
    VisionPipeline->>VisionBackends: selectBackend(deckId)
    VisionBackends-->>VisionPipeline: Backend config
    VisionPipeline->>WorkersAI: Identify card
    WorkersAI-->>VisionPipeline: Card candidates
    VisionPipeline->>SymbolDetector: detectSymbols(image)
    SymbolDetector-->>VisionPipeline: Symbol annotations
    VisionPipeline-->>VisionAPI: Card + confidence + symbols
    VisionAPI-->>CameraCapture: Vision results
    CameraCapture->>VisionPanel: Show validation
    VisionPanel-->>User: Confirm/correct card
```

### 7.5 Quality Evaluation & Alerting Flow

```mermaid
sequenceDiagram
    participant ReadingAPI as tarot-reading.js
    participant Evaluation as evaluation.js
    participant WorkersAI
    participant QualityAnalysis as qualityAnalysis.js
    participant KV_Metrics as METRICS_DB
    participant QualityAlerts as qualityAlerts.js
    participant EmailService as emailService.js
    participant Email as External Email
    participant AdminDash as AdminDashboard

    ReadingAPI->>Evaluation: evaluateNarrative()
    Evaluation->>WorkersAI: Qwen quality check
    WorkersAI-->>Evaluation: Scores
    Evaluation->>QualityAnalysis: analyzeScores(scores)
    QualityAnalysis->>KV_Metrics: Store metrics
    QualityAnalysis->>QualityAlerts: checkThresholds(metrics)

    alt Score below threshold
        QualityAlerts->>EmailService: sendAlertEmail()
        EmailService->>Email: Dispatch alert
    end

    QualityAnalysis-->>ReadingAPI: Analysis complete

    AdminDash->>QualityAnalysis: GET /api/admin/quality-stats
    QualityAnalysis->>KV_Metrics: Read metrics
    KV_Metrics-->>QualityAnalysis: Historical data
    QualityAnalysis-->>AdminDash: Render charts
```

### 7.6 A/B Testing Flow

```mermaid
sequenceDiagram
    participant Frontend
    participant ReadingAPI as tarot-reading.js
    participant ABTesting as abTesting.js
    participant ClientId as clientId.js
    participant PromptVersioning as promptVersioning.js
    participant NarrativeBuilder as narrativeBuilder.js
    participant Evaluation as evaluation.js
    participant KV_Metrics as METRICS_DB

    Frontend->>ReadingAPI: POST /api/tarot-reading
    ReadingAPI->>ABTesting: getVariant(request)
    ABTesting->>ClientId: getClientId(request)
    ClientId-->>ABTesting: Client identifier
    ABTesting->>ABTesting: assignVariant(clientId)
    ABTesting-->>ReadingAPI: Variant assignment
    ReadingAPI->>PromptVersioning: getPromptForVariant(variant)
    PromptVersioning-->>ReadingAPI: Variant-specific prompt
    ReadingAPI->>NarrativeBuilder: buildNarrative(prompt)
    NarrativeBuilder-->>ReadingAPI: Narrative
    ReadingAPI->>Evaluation: evaluate(narrative, variant)
    Evaluation->>KV_Metrics: Store per-variant metrics
    Evaluation-->>ReadingAPI: Evaluation with variant tag
    ReadingAPI-->>Frontend: Reading + variant info
```

### 7.7 Journal Pattern Detection Flow

```mermaid
sequenceDiagram
    participant User
    participant JournalComp as Journal Component
    participant JournalAPI as journal.js API
    participant PatternTracking as patternTracking.js
    participant D1
    participant PatternAlerts as journal/pattern-alerts.js
    participant QualityAlerts as qualityAlerts.js
    participant PatternBanner as PatternAlertBanner

    User->>JournalComp: Save journal entry
    JournalComp->>JournalAPI: POST /api/journal
    JournalAPI->>D1: INSERT journal entry
    JournalAPI->>PatternTracking: detectPatterns(entry, history)
    PatternTracking->>D1: Query pattern_tracking
    PatternTracking->>D1: UPDATE pattern_tracking
    PatternTracking-->>JournalAPI: Pattern results
    JournalAPI-->>JournalComp: Entry saved

    JournalComp->>PatternAlerts: GET /api/journal/pattern-alerts
    PatternAlerts->>D1: Query recent patterns
    PatternAlerts-->>JournalComp: Active alerts
    JournalComp->>PatternBanner: Display alerts
    PatternBanner-->>User: Show pattern insights
```

### 7.8 Coach/Follow-up Flow

```mermaid
sequenceDiagram
    participant User
    participant FollowUpSection
    participant FollowUpAPI as reading-followup.js
    participant FollowUpPrompt as followUpPrompt.js
    participant CoachSuggestion as coachSuggestion.js
    participant JournalSearch as journalSearch.js
    participant D1
    participant AzureOpenAI
    participant CoachComp as CoachSuggestion Component

    User->>FollowUpSection: Request follow-up
    FollowUpSection->>FollowUpAPI: POST /api/reading-followup
    FollowUpAPI->>JournalSearch: searchRelevantEntries(query)
    JournalSearch->>D1: Query journals
    D1-->>JournalSearch: Related entries
    JournalSearch-->>FollowUpAPI: Context from journal
    FollowUpAPI->>FollowUpPrompt: buildFollowUpPrompt(reading, context)
    FollowUpPrompt->>CoachSuggestion: generateSuggestions()
    CoachSuggestion-->>FollowUpPrompt: Suggestions
    FollowUpPrompt-->>FollowUpAPI: Enhanced prompt
    FollowUpAPI->>AzureOpenAI: Generate response
    AzureOpenAI-->>FollowUpAPI: Follow-up narrative
    FollowUpAPI-->>FollowUpSection: Response + suggestions
    FollowUpSection->>CoachComp: Display suggestions
    CoachComp-->>User: Show coaching options
```

### 7.9 Archetype Journey Flow

```mermaid
sequenceDiagram
    participant User
    participant JourneyPage as ReadingJourney
    participant JourneyAPI as archetype-journey.js
    participant JourneyLib as archetypeJourney.js (lib)
    participant D1
    participant JourneyHook as useArchetypeJourney
    participant JourneyStory as JourneyStorySection

    User->>JourneyPage: View journey
    JourneyPage->>JourneyHook: useArchetypeJourney()
    JourneyHook->>JourneyAPI: GET /api/archetype-journey
    JourneyAPI->>JourneyLib: getJourneyData(userId)
    JourneyLib->>D1: Query archetype_journey
    D1-->>JourneyLib: Journey records
    JourneyLib->>JourneyLib: computeArchetypeProgression()
    JourneyLib-->>JourneyAPI: Processed journey
    JourneyAPI-->>JourneyHook: Journey data
    JourneyHook-->>JourneyPage: State update
    JourneyPage->>JourneyStory: Render sections
    JourneyStory-->>User: Display journey visualization
```

## 8. Database Schema Overview

```mermaid
erDiagram
    users ||--o{ sessions : has
    users ||--o{ journals : writes
    users ||--o{ readings : performs
    users ||--o{ subscriptions : has
    users ||--o{ api_keys : owns
    users ||--o{ archetype_journey : tracks
    users ||--o{ user_preferences : configures

    readings ||--o{ reading_cards : contains
    readings ||--o{ shares : generates
    readings ||--o{ quality_tracking : measured_by

    journals ||--o{ journal_tags : tagged_with

    shares ||--o{ share_notes : has

    users {
        int id PK
        string email
        string display_name
        string password_hash
        timestamp created_at
    }

    sessions {
        string token PK
        int user_id FK
        timestamp expires_at
    }

    journals {
        int id PK
        int user_id FK
        string question
        text reflection
        json cards
        string spread_type
        float latitude
        float longitude
        timestamp created_at
    }

    readings {
        string request_id PK
        int user_id FK
        json cards
        string spread_type
        text narrative
        json evaluation
        timestamp created_at
    }

    subscriptions {
        int id PK
        int user_id FK
        string stripe_customer_id
        string stripe_subscription_id
        string status
        string plan
        timestamp current_period_end
    }

    archetype_journey {
        int id PK
        int user_id FK
        string card_name
        int encounter_count
        json journey_data
        timestamp last_seen
    }

    quality_tracking {
        int id PK
        string reading_id FK
        float coherence_score
        float relevance_score
        float safety_score
        string prompt_version
        timestamp created_at
    }

    pattern_tracking {
        int id PK
        int user_id FK
        string pattern_type
        json pattern_data
        int occurrence_count
        timestamp first_seen
        timestamp last_seen
    }

    shares {
        string token PK
        int reading_id FK
        int user_id FK
        timestamp expires_at
        timestamp created_at
    }

    api_keys {
        int id PK
        int user_id FK
        string key_hash
        string name
        string tier
        timestamp created_at
        timestamp last_used
    }
```

## 9. External Service Integrations

```mermaid
graph LR
    subgraph AzureServices["Azure AI Services"]
        AzureOpenAI["Azure OpenAI<br>GPT-5 Model<br>Narrative Generation"]
        AzureAnthropic["Azure AI Foundry<br>Claude (Fallback)<br>Narrative Generation"]
        AzureTTS["Azure TTS<br>gpt-4o-audio-mini<br>Text-to-Speech"]
        AzureSpeech["Azure Speech SDK<br>Client Token Auth<br>Browser Speech"]
    end

    subgraph CloudflareServices["Cloudflare Services"]
        WorkersAI["Workers AI<br>Llama 3 8B<br>Quality Evaluation"]
        D1["D1 Database<br>SQLite<br>Primary Storage"]
        KV["KV Namespaces<br>RATELIMIT, FEEDBACK_KV<br>METRICS_DB"]
        Assets["Assets Binding<br>Static Files<br>SPA Fallback"]
        Logpush["Logpush<br>Log Export"]
    end

    subgraph PaymentServices["Payment Services"]
        Stripe["Stripe<br>Checkout<br>Customer Portal<br>Webhooks"]
    end

    subgraph AlternativeServices["Alternative Services"]
        HumeAI["Hume AI<br>Expressive TTS<br>Alternative Audio"]
        EmailProvider["Email Provider<br>Quality Alerts<br>Notifications"]
    end

    subgraph Worker["Cloudflare Worker"]
        API["API Layer"]
    end

    API --> AzureOpenAI
    API --> AzureAnthropic
    API --> AzureTTS
    API --> AzureSpeech
    API --> WorkersAI
    API --> D1
    API --> KV
    API --> Assets
    API --> Stripe
    API --> HumeAI
    API --> EmailProvider
```

## 10. Component Hierarchy Summary

```mermaid
graph TB
    subgraph Frontend["Frontend Layer"]
        MainJSX["main.jsx"]
        Contexts["5 Context Providers"]
        Pages["9 Page Components"]
        Components["143 UI Components"]
        Hooks["27 Custom Hooks"]
        FrontLibs["23 Frontend Libraries"]
        Utils["4 Utility Modules"]
        Data["8 Data Sources"]
    end

    subgraph Worker["Worker Layer"]
        WorkerEntry["src/worker/index.js"]
        APIs["52 API Endpoints"]
        BackendLibs["87 Backend Libraries"]
    end

    subgraph Shared["Shared Layer"]
        SharedMods["23 Shared Modules"]
    end

    subgraph Infra["Infrastructure"]
        Cloudflare["Cloudflare<br>Workers, D1, KV, AI"]
        Azure["Azure<br>OpenAI, TTS, Speech"]
        Stripe["Stripe<br>Payments"]
        Hume["Hume AI<br>TTS Alternative"]
    end

    MainJSX --> Contexts
    Contexts --> Pages
    Pages --> Components
    Components --> Hooks
    Components --> FrontLibs
    Components --> Utils
    FrontLibs --> Data

    WorkerEntry --> APIs
    APIs --> BackendLibs

    FrontLibs -.-> SharedMods
    BackendLibs -.-> SharedMods

    APIs --> Cloudflare
    APIs --> Azure
    APIs --> Stripe
    APIs --> Hume
```

---

## Quick Reference: File Counts

| Layer | Category | Count |
|-------|----------|-------|
| Frontend | Context Providers | 5 |
| Frontend | Pages | 8 |
| Frontend | Components | 159 |
| Frontend | Hooks | 27 |
| Frontend | Libraries | 26 |
| Frontend | Utils | 4 |
| Frontend | Data Sources | 8 |
| Worker | API Endpoints | 52 |
| Worker | Backend Libraries | 87 |
| Shared | Modules | 23 |
| External | Services | 12 |
## 11. CodeViz System Architecture Export

```mermaid
graph TD

    base.cv::user["**End User**<br>[External]"]
    base.cv::d1_db["**Cloudflare D1 Database**<br>wrangler.jsonc `d1_databases`, migrations/0001_initial_schema.sql"]
    base.cv::kv_ratelimit["**Cloudflare KV: Ratelimit**<br>wrangler.jsonc `kv_namespaces` `RATELIMIT`"]
    base.cv::kv_feedback["**Cloudflare KV: Feedback**<br>wrangler.jsonc `kv_namespaces` `FEEDBACK_KV`"]
    base.cv::kv_metrics["**Cloudflare KV: Metrics**<br>wrangler.jsonc `kv_namespaces` `METRICS_DB`"]
    base.cv::cloudflare_ai["**Cloudflare Workers AI**<br>wrangler.jsonc `ai`, package.json `@xenova/transformers`"]
    base.cv::azure_openai["**Azure OpenAI Service**<br>wrangler.jsonc `AZURE_OPENAI_ENDPOINT`, wrangler.jsonc `AZURE_OPENAI_API_KEY`"]
    base.cv::azure_anthropic["**Azure AI Foundry Anthropic**<br>wrangler.jsonc `AZURE_ANTHROPIC_ENDPOINT`"]
    base.cv::azure_tts["**Azure Text-to-Speech**<br>wrangler.jsonc `AZURE_OPENAI_TTS_ENDPOINT`"]
    base.cv::azure_speech_sdk["**Azure Speech SDK**<br>wrangler.jsonc `AZURE_SPEECH_KEY`, package.json `microsoft-cognitiveservices-speech-sdk`"]
    base.cv::admin["**Administrator**<br>wrangler.jsonc `ADMIN_API_KEY`"]
    base.cv::cloudflare_log_obs["**Cloudflare Logging & Observability**<br>wrangler.jsonc `logpush`, wrangler.jsonc `observability`"]
    base.cv::email_service["**Email Service**<br>wrangler.jsonc `ALERT_EMAIL_TO`"]
    subgraph base.cv::frontend_app["**Tarot Frontend**<br>package.json `react`, vite.config.js, src/main.jsx"]
        base.cv::web_browser["**Web Browser**<br>src/main.jsx `ReactDOM.createRoot`, index.html"]
        base.cv::service_worker["**Service Worker**<br>src/main.jsx `navigator.serviceWorker.register`, public/sw.js"]
        %% Edges at this level (grouped by source)
        base.cv::web_browser["**Web Browser**<br>src/main.jsx `ReactDOM.createRoot`, index.html"] -->|"Delegates network requests to"| base.cv::service_worker["**Service Worker**<br>src/main.jsx `navigator.serviceWorker.register`, public/sw.js"]
    end
    subgraph base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"]
        base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"]
    end
    %% Edges at this level (grouped by source)
    base.cv::user["**End User**<br>[External]"] -->|"Uses"| base.cv::frontend_app["**Tarot Frontend**<br>package.json `react`, vite.config.js, src/main.jsx"]
    base.cv::user["**End User**<br>[External]"] -->|"Uses"| base.cv::web_browser["**Web Browser**<br>src/main.jsx `ReactDOM.createRoot`, index.html"]
    base.cv::frontend_app["**Tarot Frontend**<br>package.json `react`, vite.config.js, src/main.jsx"] -->|"Makes API calls to"| base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Reads from and writes to"| base.cv::d1_db["**Cloudflare D1 Database**<br>wrangler.jsonc `d1_databases`, migrations/0001_initial_schema.sql"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Reads from and writes to"| base.cv::kv_ratelimit["**Cloudflare KV: Ratelimit**<br>wrangler.jsonc `kv_namespaces` `RATELIMIT`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Writes feedback to"| base.cv::kv_feedback["**Cloudflare KV: Feedback**<br>wrangler.jsonc `kv_namespaces` `FEEDBACK_KV`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Writes metrics to"| base.cv::kv_metrics["**Cloudflare KV: Metrics**<br>wrangler.jsonc `kv_namespaces` `METRICS_DB`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Invokes AI models on"| base.cv::cloudflare_ai["**Cloudflare Workers AI**<br>wrangler.jsonc `ai`, package.json `@xenova/transformers`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Generates narratives using"| base.cv::azure_openai["**Azure OpenAI Service**<br>wrangler.jsonc `AZURE_OPENAI_ENDPOINT`, wrangler.jsonc `AZURE_OPENAI_API_KEY`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Generates narratives using (fallback)"| base.cv::azure_anthropic["**Azure AI Foundry Anthropic**<br>wrangler.jsonc `AZURE_ANTHROPIC_ENDPOINT`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Generates audio for"| base.cv::azure_tts["**Azure Text-to-Speech**<br>wrangler.jsonc `AZURE_OPENAI_TTS_ENDPOINT`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Uses for speech processing"| base.cv::azure_speech_sdk["**Azure Speech SDK**<br>wrangler.jsonc `AZURE_SPEECH_KEY`, package.json `microsoft-cognitiveservices-speech-sdk`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Performs scheduled archiving and cleanup"| base.cv::d1_db["**Cloudflare D1 Database**<br>wrangler.jsonc `d1_databases`, migrations/0001_initial_schema.sql"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Performs scheduled cleanup"| base.cv::kv_ratelimit["**Cloudflare KV: Ratelimit**<br>wrangler.jsonc `kv_namespaces` `RATELIMIT`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Performs scheduled archival"| base.cv::kv_feedback["**Cloudflare KV: Feedback**<br>wrangler.jsonc `kv_namespaces` `FEEDBACK_KV`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Performs scheduled archival"| base.cv::kv_metrics["**Cloudflare KV: Metrics**<br>wrangler.jsonc `kv_namespaces` `METRICS_DB`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Sends logs and metrics to"| base.cv::cloudflare_log_obs["**Cloudflare Logging & Observability**<br>wrangler.jsonc `logpush`, wrangler.jsonc `observability`"]
    base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"] -->|"Sends alerts via"| base.cv::email_service["**Email Service**<br>wrangler.jsonc `ALERT_EMAIL_TO`"]
    base.cv::admin["**Administrator**<br>wrangler.jsonc `ADMIN_API_KEY`"] -->|"Manages and monitors"| base.cv::cloudflare_worker["**Tarot Backend Worker**<br>package.json `wrangler`, wrangler.jsonc, src/worker/index.js, functions/api/"]
    base.cv::admin["**Administrator**<br>wrangler.jsonc `ADMIN_API_KEY`"] -->|"Manages and monitors"| base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"]
    base.cv::web_browser["**Web Browser**<br>src/main.jsx `ReactDOM.createRoot`, index.html"] -->|"Makes API calls to"| base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"]
    base.cv::service_worker["**Service Worker**<br>src/main.jsx `navigator.serviceWorker.register`, public/sw.js"] -->|"Fetches assets and API data from"| base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Reads from and writes to"| base.cv::d1_db["**Cloudflare D1 Database**<br>wrangler.jsonc `d1_databases`, migrations/0001_initial_schema.sql"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Reads from and writes to"| base.cv::kv_ratelimit["**Cloudflare KV: Ratelimit**<br>wrangler.jsonc `kv_namespaces` `RATELIMIT`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Writes feedback to"| base.cv::kv_feedback["**Cloudflare KV: Feedback**<br>wrangler.jsonc `kv_namespaces` `FEEDBACK_KV`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Writes metrics to"| base.cv::kv_metrics["**Cloudflare KV: Metrics**<br>wrangler.jsonc `kv_namespaces` `METRICS_DB`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Invokes AI models on"| base.cv::cloudflare_ai["**Cloudflare Workers AI**<br>wrangler.jsonc `ai`, package.json `@xenova/transformers`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Generates narratives using"| base.cv::azure_openai["**Azure OpenAI Service**<br>wrangler.jsonc `AZURE_OPENAI_ENDPOINT`, wrangler.jsonc `AZURE_OPENAI_API_KEY`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Generates narratives using (fallback)"| base.cv::azure_anthropic["**Azure AI Foundry Anthropic**<br>wrangler.jsonc `AZURE_ANTHROPIC_ENDPOINT`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Generates audio for"| base.cv::azure_tts["**Azure Text-to-Speech**<br>wrangler.jsonc `AZURE_OPENAI_TTS_ENDPOINT`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Uses for speech processing"| base.cv::azure_speech_sdk["**Azure Speech SDK**<br>wrangler.jsonc `AZURE_SPEECH_KEY`, package.json `microsoft-cognitiveservices-speech-sdk`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Performs scheduled archiving and cleanup"| base.cv::d1_db["**Cloudflare D1 Database**<br>wrangler.jsonc `d1_databases`, migrations/0001_initial_schema.sql"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Performs scheduled cleanup"| base.cv::kv_ratelimit["**Cloudflare KV: Ratelimit**<br>wrangler.jsonc `kv_namespaces` `RATELIMIT`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Performs scheduled archival"| base.cv::kv_feedback["**Cloudflare KV: Feedback**<br>wrangler.jsonc `kv_namespaces` `FEEDBACK_KV`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Performs scheduled archival"| base.cv::kv_metrics["**Cloudflare KV: Metrics**<br>wrangler.jsonc `kv_namespaces` `METRICS_DB`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Sends logs and metrics to"| base.cv::cloudflare_log_obs["**Cloudflare Logging & Observability**<br>wrangler.jsonc `logpush`, wrangler.jsonc `observability`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Sends alerts via"| base.cv::email_service["**Email Service**<br>wrangler.jsonc `ALERT_EMAIL_TO`"]
    base.cv::worker_runtime["**Cloudflare Worker Runtime**<br>wrangler.jsonc `main` `src/worker/index.js`, functions/api/"] -->|"Serves static assets and API responses"| base.cv::web_browser["**Web Browser**<br>src/main.jsx `ReactDOM.createRoot`, index.html"]

```

---
*Generated by [CodeViz.ai](https://codeviz.ai) on 1/14/2026, 3:19:18 PM*
