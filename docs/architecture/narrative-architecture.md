# Narrative Builder Architecture Diagram

Type: reference
Status: active reference
Last reviewed: 2026-09-25

## Source Precedence Contract

Spread understanding follows a strict precedence order so enrichment never overrides drawn-card truth:

`spread/cards > validated matched vision > question/reflections/focus areas > stored memory > GraphRAG > ephemeris`

Guardrail: Enrichment layers may add nuance, but they must not replace drawn card identity, card count, or position semantics. Stored memory is a lower-precedence context source than the current question, reflections, and focus areas.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TAROT READING REQUEST                                 │
│                    (question, spread, cards, reflections)                    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  VALIDATION & AUTHENTICATION LAYER                           │
│  • Schema validation (safeParseReadingRequest)                              │
│  • User authentication (getUserFromRequest)                                 │
│  • Rate limiting (enforceApiCallLimit)                                      │
│  • Vision proof verification (verifyVisionProof, optional)                  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CRISIS DETECTION                                 │
│  • Self-harm signals                                                        │
│  • Medical emergencies                                                      │
│  • Mental health                                                            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
                 ▼                                     ▼
┌─────────────────────────────┐      ┌───────────────────────────────────────┐
│ SAFE FALLBACK               │      │ SPREAD ANALYSIS                        │
│ • Gentle response           │      │ • Themes detection                     │
│ • Resource links            │      │ • Reversal framework                   │
│ • Early return              │      │ • Stored memory                        │
│ • Crisis resources          │      │ • GraphRAG retrieval                   │
└─────────────────────────────┘      │ • Elemental dignities                  │
                                     │ • Ephemeris context                    │
                                     └──────────────────┬────────────────────┘
                                                        │
                     ┌──────────────────────────────┴─────────────┐
                     │              BACKEND SELECTION              │
                     │  • availability and per-attempt A/B assignment      │
                     │  NARRATIVE_BACKEND_ORDER:                    │
                     │  modal-qwen → azure-gpt5 → claude-opus45 →   │
                     │  local-composer                               │
                     │  azure-gpt5 = native OpenAI Responses or      │
                     │  Azure OpenAI Responses                       │
                     └──────────────────┬──────────────────────────┘
                                        │
                                        ▼
             ┌─────────────────────────────────────────────────┐
             │           PROVIDER ATTEMPT LOOP                 │
             │  1. modal-qwen (Qwen via Modal)                │
             │  2. azure-gpt5 (native OpenAI or Azure)       │
             │  3. claude-opus45 (Azure AI Foundry)           │
             │  4. local-composer (deterministic fallback)   │
             └──────────────────┬──────────────────────────┘
                                        │
                                        ▼
            ┌─────────────────────────────────────────────────┐
            │         PROMPT CONSTRUCTION LAYER               │
             │   functions/lib/narrative/prompts/                │
             │   functions/lib/narrative/prompts.js (barrel)     │
            ├─────────────────────────────────────────────────┤
            │                                                 │
            │  ┌─────────────────────────────────────────┐   │
            │  │ buildEnhancedClaudePrompt               │   │
            │  │ • Token budgeting                       │   │
            │  │ • Section-aware truncation              │   │
            │  │ • GraphRAG passage injection            │   │
            │  │ • Deck-specific tips                    │   │
            │  │ • Astrological relevance                │   │
            │  └─────────────────────────────────────────┘   │
            │                     │                           │
            │                     ▼                           │
            │  ┌──────────────────────────────────────────┐  │
            │  │ SYSTEM PROMPT                            │  │
            │  │ • Role definition                        │  │
            │  │ • ETHICS section (critical)              │  │
            │  │ • CORE PRINCIPLES (critical)             │  │
            │  │ • MODEL DIRECTIVES (critical)            │  │
            │  │ • Deck style tips                        │  │
            │  │ • Position weights                       │  │
            │  │ • GraphRAG passages                      │  │
            │  │ • Ephemeris context                      │  │
            │  └──────────────────────────────────────────┘  │
            │                     │                           │
            │                     ▼                           │
             │  ┌──────────────────────────────────────────┐  │
             │  │ USER PROMPT                              │  │
             │  │ • User question                          │  │
             │  │ • Spread definition                      │  │
             │  │ • Cards with positions                   │  │
             │  │ • User reflections                       │  │
             │  │ • Context signals                        │  │
             │  │ • Stored memory (lower precedence)       │  │
             │  └──────────────────────────────────────────┘  │
             └─────────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────────┐
            │    NARRATIVE HELPERS & SPREAD BUILDERS          │
             │   functions/lib/narrative/helpers.js                │
             │   functions/lib/narrative/spreads/*.js             │
            ├─────────────────────────────────────────────────┤
            │                                                 │
            │  ┌─────────────────────────────────────────┐   │
            │  │ buildPositionCardText                   │   │
            │  │ • Card name formatting                  │   │
            │  │ • Position interpretation               │   │
            │  │ • Reversal lens application             │   │
            │  │ • Elemental imagery                     │   │
            │  └─────────────────────────────────────────┘   │
            │                     │                           │
            │                     ▼                           │
             │  ┌─────────────────────────────────────────┐   │
             │  │ Spread-Specific Builders                │   │
             │  │ • CelticCross (spread-specific)         │   │
             │  │ • FiveCard (spread-specific)            │   │
             │  │ • ThreeCard (spread-specific)           │   │
             │  │ • Decision (spread-specific)            │   │
             │  │ • Relationship (spread-specific)        │   │
             │  │ • SingleCard (spread-specific)          │   │
             │  └─────────────────────────────────────────┘   │
             │  Spread-specific builders share common helpers  │
             │  and preserve position semantics.              │
             └─────────────────────────────────────────────────┘
                                    │
                                    ▼
             ┌─────────────────────────────────────────────────┐
             │           NARRATIVE GENERATION                  │
             │  • LLM inference or deterministic composition  │
             │  • Token streaming (native OpenAI/Azure path)   │
             │  • Response formatting                         │
             └───────────────────────┬─────────────────────────┘
                                    │
                                    ▼
             ┌─────────────────────────────────────────────────┐
             │     STRUCTURAL QUALITY GATE (PER ATTEMPT)       │
             │ functions/api/tarot-reading.js                 │
             │ functions/lib/readingQuality.js                 │
             ├─────────────────────────────────────────────────┤
             │                                                 │
             │  ┌─────────────────────────────────────────┐   │
             │  │ Narrative Validation                    │   │
             │  │ • Card coverage check                   │   │
             │  │ • Hallucination allowance              │   │
             │  │ • Spine completeness                    │   │
             │  │ • Position weight validation            │   │
             │  └─────────────────────────────────────────┘   │
             │                     │                           │
             │      ┌──────────────┴──────────────┐            │
             │      │ PASS                  FAIL  │            │
             │      ▼                             ▼            │
             │  ┌─────────┐              ┌──────────────┐     │
             │  │ Accept  │              │ Try next     │     │
             │  │ reading │              │ backend      │     │
             │  └────┬────┘              └──────┬───────┘     │
             │       │                          │             │
             └───────┼──────────────────────────┼─────────────┘
                     │                          │
                     └──────────┬───────────────┘
                                │
                                ▼
             ┌─────────────────────────────────────────────────┐
             │       OPTIONAL SYNC EVAL GATE / ASYNC EVAL      │
             │ • EVAL_GATE_ENABLED or selective policy        │
             │ • Safe fallback only for a blocked sync gate    │
             │ • Async Workers AI scoring via waitUntil()      │
             │ • D1 eval_metrics and optional prompt persistence│
             └─────────────────────────────────────────────────┘
                               │
                               ▼
            ┌─────────────────────────────────────────────────┐
            │              RESPONSE FINALIZATION              │
            │  • Add metadata (provider, requestId)           │
            │  • Add themes & analysis                        │
            │  • Add ephemeris context                        │
            │  • Add GraphRAG stats                           │
            │  • Add quality metrics                          │
            └───────────────────────┬─────────────────────────┘
                                    │
                                    ▼
             ┌─────────────────────────────────────────────────┐
             │              CLIENT RESPONSE                    │
             │  {                                              │
             │    reading: "Narrative text...",                │
             │    provider: "modal-qwen | openai-native |      │
             │      azure-gpt5 | claude-opus45 | local-composer",│
             │    themes: {...},                               │
             │    context: "love",                             │
             │    spreadAnalysis: {...},                       │
             │    graphRAG: {...}                              │
             │  }                                              │
             └─────────────────────────────────────────────────┘
```

For `modal-qwen`, `azure-gpt5`, and `claude-opus45`, the prompt-construction layer
assembles system and user prompts. `local-composer` bypasses LLM prompt assembly and
uses the reasoning-aware spread builders directly.

## Production Reasoning Integration

`tarot-reading.js` calls `buildReadingReasoning()` after `performSpreadAnalysis()` and
returns the resulting `analysis.reasoning` metadata. The `local-composer` backend then
calls `buildReadingWithReasoning()` around the selected spread builder; supported
builders use the reasoning for intent-aware openings, connectors, emphasis, and
synthesis. LLM backends continue to use the same spread analysis and prompt path,
with the reasoning object available as metadata.

## Key Components

| Component | File | Status |
|-----------|------|--------|
| **Orchestrator** | `functions/api/tarot-reading.js` | Production request orchestration |
| **Backend registry** | `functions/lib/narrativeBackends.js` | Current provider order and dispatch |
| **Reasoning** | `functions/lib/narrative/reasoning.js` and `reasoningIntegration.js` | Integrated into analysis and local composition |
| **Prompt builder** | `functions/lib/narrative/prompts/` and `prompts.js` | Modular prompt assembly and budgeting |
| **Helpers** | `functions/lib/narrative/helpers.js` | Shared narrative helpers |
| **Spread builders** | `functions/lib/narrative/spreads/` | Position-aware spread construction |
| **GraphRAG** | `functions/lib/graphRAG.js` and `knowledgeBase.js` | Pattern retrieval and Tableu Tarot Canon passages |
| **Structural quality gate** | `functions/api/tarot-reading.js` and `functions/lib/readingQuality.js` | Coverage, hallucination, spine, and high-weight-position checks before acceptance |
| **Evaluation and metrics** | `functions/lib/evaluation.js` | Workers AI scoring, sync/async evaluation gates, and D1 `eval_metrics` |

## Critical Issues in Flow

### ✅ Issue #1: Late Crisis Detection (Resolved)
```
Current Flow:
  Request → Validation → Crisis Check → Spread Analysis → ...
```
**Impact:** Avoids wasted compute on blocked requests

### ✅ Issue #2: Token Budget Safety Gap (Resolved)
```
Current Behavior:
  if (criticalSections > 80% of budget) {
    throw new Error('PROMPT_SAFETY_BUDGET_EXCEEDED');
  }
```
**Impact:** Prevents safety guidance truncation

### ✅ Issue #3: Global State (Mitigated)
```
// helpers.js
let PROSE_MODE = false; // Legacy test helper

export function setProseMode(enabled) {
  PROSE_MODE = !!enabled;
}
```
**Status:** Mitigated via runtime guards in `isProseMode()`. Global state only honored
when `env.NODE_ENV === 'test'`. Production callers must pass `proseMode` explicitly.
No cross-request bleed in production.

## Data Flow Summary

1. **Request enters** → Validation + Auth (1-5ms)
2. **Vision proof** (if provided) verified; default mismatches remain telemetry-only
3. **Crisis check** performed (1-2ms)
4. **Spread analysis** computed (50-100ms)
5. **Reasoning chain** built from the actual spread and question
6. **Backend selected** in order: `modal-qwen` → `azure-gpt5` → `claude-opus45` → `local-composer`
7. **Prompt or local composition** constructed (10-20ms):
   - Token budgeting and GraphRAG retrieval for LLM paths
   - Spread-specific sections and reasoning-aware synthesis
8. **Narrative generated** (1000-3000ms depending on backend)
9. **Structural quality gate** validated by `tarot-reading.js` and `readingQuality.js` (5-10ms)
10. **Async evaluation** scheduled by `evaluation.js` (doesn't block response)
11. **Response sent** to client and metrics persisted to D1 `eval_metrics`

## Runtime Scheduling and Storage

The Worker has two cron entries: `*/10 * * * *` reconciles pending card-video usage in `METRICS_DB`, and `0 3 * * *` runs D1 quality analysis, ongoing legacy KV compatibility archival, and cleanup. Runtime reading metrics and evaluation payloads are written directly to D1 `eval_metrics`; `METRICS_DB` also stores current media telemetry, media-usage counters, and card-video job metadata. `R2_LOGS` stores generated media, user-media objects, journal-export caches, and archives/exports.

## Optimization Opportunities

| Optimization | Savings | Complexity |
|--------------|---------|------------|
| Early crisis detection (done) | 50-100ms | Low |
| Lazy-load ephemeris | 20-40ms | Medium |
| Cache GraphRAG matches | 5-20ms | Medium |
| Parallel backend checks | 10-20ms | High |

## Testing Strategy

```
Unit Tests (functions/lib/)
├── Token budgeting
│   ├── estimateTokenCount edge cases
│   ├── truncateSystemPromptSafely
│   └── Critical section preservation
├── Input validation
│   ├── sanitizePromptValue (with template injection)
│   ├── Card count validation
│   └── Property existence checks
└── Narrative builders
    ├── Empty cardsInfo handling
    ├── Reversal framework application
    └── Position text generation

Integration Tests (e2e/)
├── Full reading flow
├── Crisis detection early return
├── Quality gate blocking
└── Vision proof mismatch

Performance Tests
├── Token estimation accuracy
├── GraphRAG retrieval latency
└── End-to-end timing
```

## Architecture Evolution Roadmap

### Phase 1: Quick Wins (Week 1)
- Move crisis detection earlier (done)
- Fail-fast on safety budget (done)
- Add template syntax filtering (done)
- Add input guards (done)

### Phase 2: Refactoring (Month 1)
- Split prompts.js into modules ✅ (now `prompts/` + barrel)
- Remove global state
- Extract spread builder base class

### Phase 3: Plugin System (Quarter 1)
```
narrative/
├── core/
│   ├── builder.js
│   ├── pipeline.js
│   └── registry.js
├── plugins/
│   ├── reasoning/
│   ├── graphRAG/
│   ├── astrology/
│   └── vision/
└── spreads/
    └── [use plugins via registry]
```

### Phase 4: Optimization (Quarter 2)
- Implement GraphRAG caching
- Lazy-load non-critical enrichments
- Parallel backend health checks

---

Status labels describe module responsibility and current integration; they are not size thresholds.
