# Knowledge Graph Program — Status & Next Steps

## Snapshot
- **Project:** Mystic Tarot Knowledge Graph
- **Goal:** Detect multi-card archetypal patterns so readings feel cohesive and resonant.
- **Current Status:** ✅ Deployed in production (v1.0)
- **Owners:** functions/lib/knowledgeGraph.js · src/data/knowledgeGraphData.js · src/components/SpreadPatterns.jsx

| Deliverable | Status | Evidence |
| --- | --- | --- |
| Fool’s Journey stage detection | ✅ | `detectFoolsJourneyStage` + unit tests (`functions/lib/__tests__/knowledgeGraph.test.js`) |
| Archetypal triads & dyads | ✅ | `ARCHETYPAL_TRIADS` / `ARCHETYPAL_DYADS` data + prioritised narratives |
| Suit progressions | ✅ | `detectSuitProgressions` powering Minor Arcana arcs |
| Narrative integration | ✅ | `functions/lib/spreadAnalysis.js` injects `themes.knowledgeGraph`, prompts consume highlights |
| Frontend surfacing | ✅ | `SpreadPatterns` panel + Markdown highlights |
| Performance budget (<100 ms) | ✅ | Pattern detection completes in ~6 ms for 10-card spreads (measured in staging) |

---

## Architecture Recap
1. **Data Layer** (`src/data/knowledgeGraphData.js`)
   - Encodes Fool’s Journey stages, triads, dyads, and suit progressions with narratives + significance scores.
2. **Detection Layer** (`functions/lib/knowledgeGraph.js`)
   - Pure functions (`detectAllPatterns`, `getPriorityPatternNarratives`) compute matches and return ranked highlights.
3. **Analysis Layer** (`functions/lib/spreadAnalysis.js`)
   - Calls the detection layer, merges results into `themes.knowledgeGraph`, and keeps runtime < 100 ms.
4. **Narrative Layer** (`functions/lib/narrative/prompts.js`, `functions/lib/narrative/helpers.js`)
   - Prompts include an “Archetypal Patterns Detected” section; local composers weave the highlights into Markdown.
5. **UI Layer** (`src/components/SpreadPatterns.jsx`)
   - Optional “Archetypal Patterns” card renders Markdown highlights with suit/triad icons.

---

## QA & Instrumentation
- **Unit Tests:** `functions/lib/__tests__/knowledgeGraph.test.js` covers Fool’s Journey, triads, dyads, suit progressions, and narrative prioritisation.
- **Integration Smoke Tests:** `tests/narrativeBuilder.promptCompliance.test.mjs` ensures prompts include pattern summaries when available.
- **Performance Checks:** Benchmark script (see `scripts/vision/runVisionPrototype.js` analog) not yet automated; manual profiling shows sub‑millisecond detection per pattern type.

---

## Open Enhancements
1. **Deck-Aware Patterns**
   - Adapt pattern definitions when using Thoth/Marseille terminology (Adjustment/Lust, pip-only minors). Requires extending `knowledgeGraphData.js` with deck-specific aliases.
2. **Court + Numerology Extensions**
   - Add optional COURT_PATTERNS and NUMERICAL_HARMONICS data (draft schemas exist but aren’t wired in).
3. **Telemetry & Analytics**
   - Log which patterns fire per reading to monitor coverage and guide future heuristics.
4. **Human Review Hooks**
   - Similar to the vision review queue, capture reader feedback on pattern accuracy to iteratively tune narratives.

---

## Next Steps
| Priority | Task | Owner Suggestion | Notes |
| --- | --- | --- | --- |
| P0 | Document current behaviour (this file, `docs/knowledge-graph/*.md`) | ✅ Done | Keep updated when data tables change |
| P1 | Add deck-style overrides | Backend | Needed once non-RWS decks ship |
| P1 | Emit telemetry for detected patterns | Backend | Facilitates analytics + future ML | 
| P2 | Implement court/numerology modules | Research | Already sketched in `knowledgeGraphData.js` comments |
| P2 | Build reviewer checklist for archetypal accuracy | Product | Mirrors CLIP review workflow |

The core project is complete. Remaining work focuses on adapting the knowledge graph to additional decks, capturing telemetry, and establishing a reviewer feedback loop so the pattern heuristics evolve alongside the broader AI training roadmap.
