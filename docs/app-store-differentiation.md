# Tableu Feature Differentiation Document
## For App Store Appeal — Guideline 4.3(b) Response

Type: strategy
Status: active background document
Last reviewed: 2026-09-25

---

## Executive Summary

Tableu is **not** a generic tarot card randomizer. It is a **structured self-reflection system** built on ritual-seeded mechanics, curated internal knowledge, and knowledge graph technology. This document is a positioning draft: the Tableu capability descriptions should be verified against the release build, while competitor and exclusivity claims require current App Store evidence.

---

## Competitive Landscape Analysis

### Top Competitors (iOS App Store 2025-2026; verify current listings)

The table below is a draft snapshot, not independently verified current market research.

| App | Primary Focus | AI/Analysis | Physical Deck | Learning |
|-----|--------------|-------------|---------------|----------|
| **Labyrinthos** | Learning/quizzes | None | Yes | Extensive |
| **Golden Thread** | Journaling | None | Yes | Limited |
| **Mystic Mondays** | Daily affirmations | None | Yes | Minimal |
| **Galaxy Tarot** | Multiple spreads | None | Yes | Minimal |
| **Coto** | Human readers | Human only | No | None |

### Commonly observed competitor capabilities (verify before submission)

The following is a working comparison hypothesis, not independently verified market research:

- Random card draws
- Static card meanings
- Basic journaling
- One or more deck styles
- Varying levels of relationship or pattern analysis

Validate each claim against current store listings before using it in an appeal.

---

## Tableu's Capability Differentiators

### 1. **Ritual-Seeded Draw System** ⭐ DIFFERENTIATOR
**A Tableu differentiator to substantiate with current product evidence.**

| Feature | Tableu | Comparison hypothesis |
|---------|---------|-----------------------|
| **Draw mechanism** | Seeded shuffle from ritual input plus shuffle timestamp | Often random or tap-to-shuffle |
| **User agency** | Knocks + cut position + question + shuffle timestamp = seed | Varies by product |
| **Reproducibility** | Same complete seed/session and draw settings = same cards | May not be reproducible |

**How it works:**
```
computeSeed({ cutIndex, knockTimes, userQuestion, timestamp })
→ Hash combines: question text + knock timing patterns + cut position + timestamp
→ Deterministic deck shuffle via xorshift32 PRNG
→ A fixed complete seed/session and the same draw settings yield the same draw;
   current seeds include Date.now(), so repeating the ritual later can differ
```

**Why this matters for self-reflection:**
- Users develop personal ritual practice
- Encourages mindful engagement before reading
- Creates sense of meaningful participation (not slot machine randomness)
- Aligns with traditional physical card practices

---

### 2. **GraphRAG Knowledge System** ⭐ DIFFERENTIATOR
**A Tableu differentiator to substantiate with current product evidence.**

Tableu uses **Graph-Enhanced Retrieval-Augmented Generation** to retrieve internally
authored, tradition-aligned passages from the **Tableu Tarot Canon** when eligible
pattern context is available. The implementation does not include copyrighted book
text, and retrieval does not guarantee a passage in every reading.

| Tableu | Comparison hypothesis |
|---------|-----------------------|
| Retrieves passages from an internal knowledge base | Generic LLM prompts |
| Pattern-based retrieval (triads, dyads, journey stages) | Static card meanings |
| Context-aware deduplication and relevance scoring | Varies by product |

**Knowledge source:** `functions/lib/knowledgeBase.js`, whose passage source is
`Tableu Tarot Canon`. Do not describe named books or authors as sources unless the
release includes a separately verified license or citation.

---

### 3. **Archetypal Pattern Detection** ⭐ DIFFERENTIATOR
**A Tableu differentiator to substantiate with current product evidence.**

Tableu automatically detects meaningful multi-card patterns:

#### Fool's Journey Mapping (internal stages)
| Stage | Cards | Theme |
|-------|-------|-------|
| Initiation (0-7) | Fool → Chariot | Building ego, identity, societal roles |
| Integration (8-14) | Strength → Temperance | Shadow work, surrender, balance |
| Culmination (15-21) | Devil → World | Shadow confrontation, transcendence |

When multiple cards from the same stage appear, the reading addresses developmental themes.

#### Archetypal Triads
- **Death + Temperance + Star** → Healing Arc (ending → integration → hope)
- **Devil + Tower + Sun** → Liberation Arc (bondage → rupture → freedom)
- **Hermit + Hanged Man + Moon** → Inner Work Arc (solitude → surrender → mystery)
- **Magician + Chariot + World** → Mastery Arc (skill → action → achievement)

#### Archetypal Dyads
High-significance 2-card combinations automatically detected and interpreted:
- Death + Star → Transformation clearing into hope
- Tower + Sun → Upheaval revealing clarity
- Devil + Lovers → Attachment patterns affecting choice

---

### 4. **Elemental Dignity Analysis** ⭐ DIFFERENTIATOR
**A Tableu differentiator to substantiate with current product evidence.**

Tableu's internal elemental-dignity rules describe relationships between the selected cards:

| Relationship | Elements | Meaning |
|--------------|----------|---------|
| **Supportive** | Fire-Air, Water-Earth | Energies work together |
| **Tension** | Fire-Water, Air-Earth | Friction requiring attention |
| **Amplified** | Same element | Theme intensified |
| **Neutral** | Fire-Earth, Air-Water | Neither aligned nor opposed |

Applied to **adjacent card positions** to reveal narrative dynamics between cards.

---

### 5. **Optional Multi-Deck Recognition** ⭐ DIFFERENTIATOR
**A Tableu capability to substantiate with current product evidence.**

When `VITE_ENABLE_VISION_RESEARCH=true`, authenticated research participants can
submit photos for supported deck profiles. The feature is opt-in, is not on by
default, and is not required to complete a normal reading.

| Deck Style | Research support |
|------------|------------------|
| Rider-Waite-Smith (1909) | CLIP-based vision pipeline |
| Thoth (Crowley-Harris) | Deck-specific aliases and deck profile |
| Marseille (Classic) | Deck-specific aliases and deck profile |

**Vision Pipeline Features:**
- CLIP default backend, with optional server-side Llama/hybrid backends
- Deck-specific card name mappings
- Symbol verification layer
- Optional orientation detection when a server-side Llama/hybrid backend supplies it
- Confidence scoring with fallback strategies

---

### 6. **Reversal Framework Selection** ⭐ DIFFERENTIATOR
**A per-reading reversal-model differentiator to substantiate.**

Tableu defines 7 reversal frameworks plus the `none` all-upright case (8 framework keys total), based on:
- Reversal ratio in spread
- Question keywords
- Spread size

| Framework | When Selected | Interpretation |
|-----------|---------------|----------------|
| Blocked | 6+ cards at ≥60% reversed; small spreads at 3+ reversals | Energy meeting resistance |
| Delayed | 6+ cards below the internalized threshold; small spreads with 2+ reversals below the 50% ratio | Timing not ripe |
| Internalized | 6+ cards at ≥40% reversed; small spreads with 2+ reversals at ≥50% | Private, inward work |
| Contextual | Default | Position-specific |
| Shadow | Question mentions fear/hidden | Disowned emotions surfacing |
| Mirror | Question mentions pattern/repeat | Projection/unconscious behavior |
| `potentialBlocked` | Two or more reversed Majors, or question mentions talent/gift | Latent strengths awaiting activation or external resistance |

---

### 7. **Long-Term Archetype Journey Tracking** ⭐ DIFFERENTIATOR
**A long-term journey capability to substantiate with current product evidence.**

| Feature | Tableu | Comparison status |
|---------|---------|------------------|
| Card frequency analysis | ✓ Monthly tracking | Not verified |
| Pattern recurrence alerts | ✓ Rolling 90-day pattern-alert window (month-bucketed) | Not verified |
| Badge/milestone system | ✓ Gamified growth | Not verified |
| Streak tracking | ✓ Reading-day and repeated-card streaks derived from saved entries when enabled | Not verified |

---

### 8. **Spread-Specific Narrative Intelligence**

Tableu doesn't just "explain cards" — it generates position-aware narratives:

| Spread | Cards | Position-aware analysis |
|--------|-------|-----------------|
| Celtic Cross | 10 | Cross/staff structure with conscious/unconscious axis |
| Decision/Two-Path | 5 | Path comparison with free will reminder |
| Relationship | 3–5 | Core You/Them/Connection positions plus optional Dynamics/Guidance and Outcome clarifiers |
| Five-Card Clarity | 5 | Core/Challenge/Hidden/Support/Direction |

Each position has semantic `roleKeys` that inform AI interpretation:
```javascript
celtic: {
  roleKeys: ['present', 'challenge', 'past', 'near_future', 
             'conscious', 'subconscious', 'self_advice', 
             'external', 'hopes_fears', 'outcome']
}
```

---

### 9. **Ethical Framework Built Into System**

Hardcoded into AI prompting:
- **No absolute predictions** — "likely path if unchanged" language
- **Agency-preserving** — emphasizes user choice
- **Trauma-informed** — empowering, not fear-based
- **Professional boundaries** — disclaimers for medical/legal/financial
- **Card validation** — structural quality gates measure card coverage and out-of-set references, rejecting readings that exceed spread-aware allowances; this is bounded detection, not a guarantee of zero hallucinations

---

## Feature Comparison Matrix

| Feature | Tableu | Comparison set status |
|---------|---------|-----------------------|
| Ritual-seeded draws with fixed-seed replay | ✓ | Verify each competitor's current draw model |
| GraphRAG knowledge retrieval | ✓ | Compare current product descriptions |
| Archetypal pattern detection | ✓ | Compare current product descriptions |
| Elemental dignity analysis | ✓ | Compare current product descriptions |
| Optional multi-deck vision research | ✓ (opt-in) | Compare current product descriptions |
| Adaptive reversal frameworks | ✓ | Compare current product descriptions |
| Long-term journey tracking | ✓ | Compare current product descriptions |
| AI narrative generation | ✓ | Compare current product descriptions |
| Multiple spread types | ✓ | Verify current offerings |
| Learning/quizzes | ✗ in the web product | Verify current offerings |
| Journal/theme tracking | ✓ | Verify current offerings |

---

## Technical Architecture Differentiators

1. **Cloudflare Workers** — single Worker runtime with D1, KV, R2, and the configured `READING_JOBS` Durable Object (`ReadingJob`)
2. **D1 Database** — user journey data and current `eval_metrics` records
3. **Quality Evaluation System** — automated scoring of AI readings (personalization, coherence, tone, safety)
4. **Narrative provider order** — `modal-qwen` → `azure-gpt5` (native OpenAI or Azure Responses) → `claude-opus45` → `local-composer`

---

## Conclusion

Tableu is positioned as a structured, pattern-aware tarot reflection system. The
current product supports ritual-seeded draws, position-aware narratives, internal
GraphRAG context, optional vision research, and long-term journey views. Claims of
exclusivity should be made only after current competitor evidence is collected.

---

## Recommended Appeal Language

> "Tableu combines ritual-seeded draws with fixed-seed replay, position-aware narrative analysis, internally authored Tableu Tarot Canon retrieval, archetypal pattern detection, elemental dignity analysis, and optional vision research for a structured self-reflection practice."
