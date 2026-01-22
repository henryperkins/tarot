# Narrative Builder Architecture Diagram

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
│  • Vision proof verification (verifyVisionProof)                            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼ ⚠️ SHOULD BE HERE            ▼ ❌ CURRENTLY HERE
        ┌───────────────────────┐      ┌───────────────────────┐
        │ CRISIS DETECTION      │      │ SPREAD ANALYSIS       │
        │ • Self-harm signals   │      │ • Themes detection    │
        │ • Medical emergencies │      │ • Reversal framework  │
        │ • Mental health       │      │ • GraphRAG retrieval  │
        └───────────┬───────────┘      │ • Elemental dignities │
                    │                  │ • Ephemeris context   │
        ┌───────────▼───────────┐      └───────────┬───────────┘
        │ SAFE FALLBACK         │                  │
        │ • Gentle response     │      ┌───────────▼───────────┐
        │ • Resource links      │      │ CRISIS DETECTION      │
        │ • Early return        │      │ (too late!)           │
        └───────────────────────┘      └───────────┬───────────┘
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
            │   functions/lib/narrative/prompts/ (2168 LOC)   │
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
            │   functions/lib/narrative/helpers.js (1680 LOC) │
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
| **Prompt Builder** | narrative/prompts/ (modules) | 2168 | ⚠️ Large (modular) |
| **Prompt Barrel** | narrative/prompts.js | 4 | ✅ Barrel |
| **Helpers** | narrative/helpers.js | 1680 | 🔴 Too large |
| **Reasoning** | narrative/reasoning.js | 1205 | ⚠️ Large |
| **Celtic Cross** | spreads/celticCross.js | 467 | ✅ Good |
| **Relationship** | spreads/relationship.js | 377 | ✅ Good |
| **Decision** | spreads/decision.js | 296 | ✅ Good |
| **Five Card** | spreads/fiveCard.js | 281 | ✅ Good |
| **Three Card** | spreads/threeCard.js | 252 | ✅ Good |
| **Style Helpers** | narrative/styleHelpers.js | 238 | ✅ Excellent |
| **Single Card** | spreads/singleCard.js | 125 | ✅ Excellent |

## Critical Issues in Flow

### ❌ Issue #1: Late Crisis Detection
```
Current Flow:
  Request → Validation → Spread Analysis (expensive!) → Crisis Check → ...

Should Be:
  Request → Validation → Crisis Check → Spread Analysis → ...
```
**Impact:** Wastes 50-100ms on inputs that will be rejected

### ❌ Issue #2: Token Budget Safety Gap
```
Current Behavior:
  if (criticalSections > 80% of budget) {
    console.error("Warning!");
    // Still proceeds with truncation ⚠️
  }

Should Be:
  if (criticalSections > 80% of budget) {
    throw new Error('PROMPT_SAFETY_BUDGET_EXCEEDED');
  }
```
**Impact:** Could truncate ethical guidelines

### ⚠️ Issue #3: Global State
```
// helpers.js
let PROSE_MODE = false; // ⚠️ Global state

export function setProseMode(enabled) {
  PROSE_MODE = !!enabled;
}
```
**Impact:** Vulnerable to cross-request bleed

## Data Flow Summary

1. **Request enters** → Validation + Auth (1-5ms)
2. **Vision proof** (if provided) verified (5-10ms)
3. **❌ Spread analysis** computed (50-100ms) ← Should move crisis detection before this
4. **Crisis check** performed (1-2ms)
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
| Early crisis detection | 50-100ms | Low |
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
- Move crisis detection earlier
- Fail-fast on safety budget
- Add template syntax filtering
- Add input guards

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
