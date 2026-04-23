# Narrative Builder Architecture Diagram

Type: reference
Status: active reference
Last reviewed: 2026-04-23

## Source Precedence Contract

Spread understanding follows a strict precedence order so enrichment never overrides drawn-card truth:

`spread/cards > validated matched vision > question/reflections/focus areas > GraphRAG > ephemeris`

Guardrail: Enrichment layers may add nuance, but they must not replace drawn card identity, card count, or position semantics.

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
│ • Early return              │      │ • GraphRAG retrieval                   │
└─────────────────────────────┘      │ • Elemental dignities                  │
                                     │ • Ephemeris context                    │
                                     └──────────────────┬────────────────────┘
                                                        │
                    ┌──────────────────────────────┴─────────────┐
                    │              BACKEND SELECTION              │
                    │  • Check available backends                 │
                    │  • A/B experiment assignment                │
                    │  • Provider preference order                │
                    └──────────────────┬──────────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
            ▼                          ▼                          ▼
    ┌───────────────┐        ┌──────────────┐        ┌──────────────────┐
    │ AZURE GPT-5   │        │ CLAUDE 4.5   │        │ LOCAL COMPOSER   │
    │ Primary       │   or   │ Fallback     │   or   │ Last Resort      │
    └───────┬───────┘        └──────┬───────┘        └──────┬───────────┘
            │                       │                       │
            └───────────────────────┼───────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────────┐
            │         PROMPT CONSTRUCTION LAYER               │
            │   functions/lib/narrative/prompts/ (2429 LOC)   │
            │   functions/lib/narrative/prompts.js (barrel)   │
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
            │  └──────────────────────────────────────────┘  │
            └─────────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────────┐
            │    NARRATIVE HELPERS & SPREAD BUILDERS          │
            │   functions/lib/narrative/helpers.js (1682 LOC) │
            │   functions/lib/narrative/spreads/*.js          │
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
            │  │ • CelticCross (467 LOC)                 │   │
            │  │ • FiveCard (281 LOC)                    │   │
            │  │ • ThreeCard (252 LOC)                   │   │
            │  │ • Decision (296 LOC)                    │   │
            │  │ • Relationship (377 LOC)                │   │
            │  │ • SingleCard (125 LOC)                  │   │
            │  └─────────────────────────────────────────┘   │
            │         ⚠️ Code duplication: 30-40%             │
            └─────────────────────────────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────────┐
            │           NARRATIVE GENERATION                  │
            │  • LLM inference (Azure/Claude/Local)           │
            │  • Token streaming (optional)                   │
            │  • Response formatting                          │
            └───────────────────────┬─────────────────────────┘
                                    │
                                    ▼
            ┌─────────────────────────────────────────────────┐
            │              QUALITY GATES LAYER                │
            │   functions/lib/evaluation.js                   │
            ├─────────────────────────────────────────────────┤
            │                                                 │
            │  ┌─────────────────────────────────────────┐   │
            │  │ Narrative Validation                    │   │
            │  │ • Card coverage check                   │   │
            │  │ • Hallucination detection               │   │
            │  │ • Spine completeness                    │   │
            │  │ • Position weight validation            │   │
            │  └─────────────────────────────────────────┘   │
            │                     │                           │
            │      ┌──────────────┴──────────────┐            │
            │      │ PASS                  FAIL  │            │
            │      ▼                             ▼            │
            │  ┌─────────┐              ┌──────────────┐     │
            │  │ Accept  │              │ Safe         │     │
            │  │ Reading │              │ Fallback     │     │
            │  └────┬────┘              └──────┬───────┘     │
            │       │                          │             │
            └───────┼──────────────────────────┼─────────────┘
                    │                          │
                    └──────────┬───────────────┘
                               │
                               ▼
            ┌─────────────────────────────────────────────────┐
            │         ASYNC EVALUATION (waitUntil)            │
            │  • Quality scoring (Workers AI)                 │
            │  • Metrics storage (KV)                         │
            │  • Prompt persistence (optional)                │
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
            │    provider: "azure-gpt5",                      │
            │    themes: {...},                               │
            │    context: "love",                             │
            │    spreadAnalysis: {...},                       │
            │    graphRAG: {...}                              │
            │  }                                              │
            └─────────────────────────────────────────────────┘
```

## Key Components & File Sizes

| Component | File | LOC | Status |
|-----------|------|-----|--------|
| **Orchestrator** | tarot-reading.js | 1200+ | ✅ Acceptable |
| **Prompt Builder** | narrative/prompts/ (modules) | 2429 | ⚠️ Large (modular) |
| **Prompt Barrel** | narrative/prompts.js | 4 | ✅ Barrel |
| **Helpers** | narrative/helpers.js | 1682 | 🔴 Too large |
| **Reasoning** | narrative/reasoning.js | 1205 | ⚠️ Large |
| **Celtic Cross** | spreads/celticCross.js | 467 | ✅ Good |
| **Relationship** | spreads/relationship.js | 377 | ✅ Good |
| **Decision** | spreads/decision.js | 296 | ✅ Good |
| **Five Card** | spreads/fiveCard.js | 281 | ✅ Good |
| **Three Card** | spreads/threeCard.js | 252 | ✅ Good |
| **Style Helpers** | narrative/styleHelpers.js | 238 | ✅ Excellent |
| **Single Card** | spreads/singleCard.js | 125 | ✅ Excellent |

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
2. **Vision proof** (if provided) verified (5-10ms)
3. **Crisis check** performed (1-2ms)
4. **Spread analysis** computed (50-100ms)
5. **Backend selected** (A/B assignment, provider check)
6. **Prompt constructed** (10-20ms):
   - Token budgeting
   - GraphRAG retrieval (sync, 10-50ms)
   - Spread-specific sections
   - System + user prompts
7. **Narrative generated** (1000-3000ms depending on backend)
8. **Quality gates** validated (5-10ms)
9. **Async evaluation** scheduled (doesn't block response)
10. **Response sent** to client

**Total:** ~1100-3200ms end-to-end

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

**Legend:**
- ✅ Good: < 500 LOC, clear purpose
- ⚠️ Acceptable: 500-1000 LOC, some concerns
- 🔴 Needs refactoring: > 1000 LOC
- ❌ Critical issue: Immediate attention required
