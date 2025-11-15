# Knowledge Graph Implementation - Project Plan

## Executive Summary

**Project:** Mystic Tarot Knowledge Graph
**Goal:** Implement multi-card pattern recognition to elevate readings from card-by-card interpretation to archetypal narrative storytelling
**Timeline:** 4 weeks (28 days)
**Status:** Planning Complete, Ready for Implementation

### Success Criteria
- ✅ Detect 4 core pattern types (Fool's Journey, Triads, Dyads, Suit Progressions)
- ✅ Integrate seamlessly with existing narrative architecture
- ✅ Maintain backward compatibility (existing readings unchanged)
- ✅ Performance budget: <100ms total analysis time
- ✅ Pattern detection accuracy: >90% on test cases
- ✅ User-facing improvements: Readings feel more cohesive and profound

---

## Project Context

### Current State (Baseline)

**Existing Architecture:**
```
functions/
├── lib/
│   ├── spreadAnalysis.js       # Elemental dignities, themes, reversal frameworks
│   ├── positionWeights.js      # ✅ Position attention weights (DONE)
│   ├── narrative/
│   │   ├── helpers.js          # Shared narrative utilities
│   │   ├── prompts.js          # ✅ Reversal enforcement (DONE)
│   │   └── spreads/            # Modular spread builders
│   └── [other libs]
```

**What's Already Done:**
- ✅ Position weighting system (Priority 2 from review)
- ✅ Reversal framework enforcement (Priority 1 from review)
- ✅ Modular narrative architecture
- ✅ Spread-specific builders
- ✅ Elemental dignity analysis
- ✅ Theme detection (suits, elements, Majors, reversals)

**What's Missing:**
- ❌ Multi-card archetypal pattern detection
- ❌ Fool's Journey stage recognition
- ❌ Triad/dyad narrative synthesis
- ❌ Suit progression analysis
- ❌ Pattern priority ranking
- ❌ Frontend pattern display

### Why This Matters

**Research Alignment:**
From "Techniques for Teaching AI to Understand Tarot Deck Subtleties":
> "Knowledge graphs capturing multidimensional card information, relationships between cards, and archetypal connections... Graph Neural Networks (GNNs) reason over these structures to generate coherent, insightful interpretations."

**User Impact:**
- **Before:** "Death in your past, The Star in your future. Transformation leads to hope."
- **After:** "**The Healing Arc:** Death, Temperance, and The Star form a complete transformation triad. This is the classic healing journey—necessary ending followed by alchemical integration, emerging into renewed hope. You're moving through authentic transformation, not bypassing the grief."

**Professional Reading Practice:**
Experienced readers naturally recognize these patterns. The Knowledge Graph codifies this expertise into the system.

---

## Project Scope

### In Scope

**Phase 1: Core Knowledge Graph (Week 1)**
- FOOLS_JOURNEY data structure (3 stages, 22 cards)
- ARCHETYPAL_TRIADS (5 core triads)
- Detection functions:
  - `detectFoolsJourneyStage()`
  - `detectArchetypalTriads()`
  - `detectAllPatterns()`
  - `getPriorityPatternNarratives()`
- Unit tests (80%+ coverage)
- Integration into `spreadAnalysis.js`

**Phase 2: Narrative Integration (Week 2)**
- SUIT_PROGRESSIONS (all 4 suits × 3 stages)
- Detection function: `detectSuitProgressions()`
- Prompt enhancement (`narrative/prompts.js`)
- Helper function: `buildPatternSynthesis()`
- Update all spread builders
- Local composer integration

**Phase 3: Extension & Polish (Week 3)**
- ARCHETYPAL_DYADS extension (5 → 15)
- COURT_PATTERNS (optional)
- NUMERICAL_HARMONICS (optional)
- Frontend component: `SpreadPatterns.jsx`
- Settings toggle for pattern display
- Performance optimization

**Phase 4: Testing & Deployment (Week 4)**
- Comprehensive testing (unit + integration)
- Manual testing with 50+ spreads
- Performance profiling
- Staging deployment
- Quality validation
- Production deployment

### Out of Scope

**Not Included in This Project:**
- Quality validation system (Priority 5) - Future work
- Temporal arc synthesis (Priority 4) - May be partially covered by Fool's Journey
- Image generation or visual card art
- Additional deck types (Marseille, Thoth) - Future work
- Machine learning / neural networks (using deterministic rules instead)
- User feedback collection system (analytics separate)

**Explicitly Deferred:**
- Multi-language support
- Alternative interpretation frameworks beyond RWS
- Historical spread types beyond the 6 currently supported
- Integration with external tarot APIs

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Tarot Reading Flow                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Spread Analysis (spreadAnalysis.js)                 │
│  ─────────────────────────────────────────────────────       │
│  • Elemental dignities                                       │
│  • Theme analysis (suits, elements, reversals)               │
│  • Spread-specific structural analysis                       │
│  • ► NEW: Knowledge Graph pattern detection ◄                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Narrative Generation (narrativeBuilder.js)          │
│  ─────────────────────────────────────────────────────       │
│  • Build prompts (narrative/prompts.js)                      │
│    ► NEW: Include pattern context in prompts ◄               │
│  • Spread-specific builders (narrative/spreads/*.js)         │
│    ► NEW: Add pattern synthesis section ◄                    │
│  • Azure GPT-5 OR Local composer                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Response Assembly (tarot-reading.js)                │
│  ─────────────────────────────────────────────────────       │
│  • Return reading text                                       │
│  • Return themes (includes knowledgeGraph)                   │
│  • Return spreadAnalysis                                     │
│  • ► NEW: knowledgeGraph.narrativeHighlights ◄               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Frontend Display (React components)                 │
│  ─────────────────────────────────────────────────────       │
│  • Reading text                                              │
│  • Card grid                                                 │
│  • ► NEW: SpreadPatterns component (optional) ◄              │
└─────────────────────────────────────────────────────────────┘
```

### New Components

**1. Data Module: `src/data/knowledgeGraphData.js` (new file)**
```javascript
// Data structures for the Knowledge Graph
export const FOOLS_JOURNEY = { /* 3 stages */ };
export const ARCHETYPAL_TRIADS = [ /* 5+ triads */ ];
export const ARCHETYPAL_DYADS = [ /* 15 dyads */ ];
export const SUIT_PROGRESSIONS = { /* 4 suits */ };
export const COURT_PATTERNS = { /* optional */ };
export const NUMERICAL_HARMONICS = { /* optional */ };
```

**2. Core Logic Module: `functions/lib/knowledgeGraph.js` (new file)**
```javascript
// Import knowledge graph data
import {
  FOOLS_JOURNEY,
  ARCHETYPAL_TRIADS,
  ARCHETYPAL_DYADS,
  SUIT_PROGRESSIONS,
  COURT_PATTERNS,
  NUMERICAL_HARMONICS
} from '../../src/data/knowledgeGraphData.js';

// Detection functions
export function detectFoolsJourneyStage(cards);
export function detectArchetypalTriads(cards);
export function detectArchetypalDyads(cards);
export function detectSuitProgressions(cards);
export function detectCourtClusters(cards);
export function detectNumericalHarmonics(cards);
export function detectAllPatterns(cards);

// Priority ranking
export function getPriorityPatternNarratives(patterns);
```

**3. Integration Points**

**`functions/lib/spreadAnalysis.js`** (modify existing):
```javascript
import { detectAllPatterns, getPriorityPatternNarratives } from './knowledgeGraph.js';

export async function analyzeSpreadThemes(cardsInfo, options = {}) {
  // ... existing theme analysis ...

  // ADD: Knowledge graph pattern detection
  try {
    const patterns = detectAllPatterns(cardsInfo);
    if (patterns) {
      themes.knowledgeGraph = {
        patterns,
        narrativeHighlights: getPriorityPatternNarratives(patterns)
      };
    }
  } catch (err) {
    console.error('Knowledge graph detection failed:', err);
    // Graceful degradation: continue without patterns
  }

  return themes;
}
```

**`functions/lib/narrative/prompts.js`** (modify existing):
```javascript
function buildSystemPrompt(spreadKey, themes, context) {
  // ... existing prompt building ...

  // ADD: Pattern context (after reversal section, ~line 147)
  if (themes.knowledgeGraph?.narrativeHighlights?.length > 0) {
    lines.push(
      '',
      '## ARCHETYPAL PATTERNS DETECTED',
      '',
      'Multi-card patterns identified:',
      ...themes.knowledgeGraph.narrativeHighlights.map(h => `- ${h.text}`),
      '',
      'INTEGRATION: Weave these naturally into narrative, not mechanically.'
    );
  }

  return lines.join('\n');
}
```

**`functions/lib/narrative/helpers.js`** (add new function):
```javascript
export function buildPatternSynthesis(themes) {
  if (!themes?.knowledgeGraph?.narrativeHighlights?.length) return '';

  const highlights = themes.knowledgeGraph.narrativeHighlights.slice(0, 3);
  let section = `### Deeper Patterns\n\n`;
  section += `Beyond the individual positions, your cards reveal larger archetypal movements:\n\n`;

  highlights.forEach(highlight => {
    section += `${highlight.text}\n\n`;
  });

  return section;
}
```

**`functions/lib/narrative/spreads/celticCross.js`** (modify existing):
```javascript
import { buildPatternSynthesis } from '../helpers.js';

export function buildCelticCrossReading({ ... }) {
  // ... existing sections ...

  // ADD: Pattern synthesis (before final closing)
  const patternSection = buildPatternSynthesis(themes);
  if (patternSection) {
    sections.push(patternSection);
  }

  // ... final synthesis ...
}
```

**3. Frontend Component: `src/components/SpreadPatterns.jsx`** (new file)
```jsx
export function SpreadPatterns({ themes }) {
  if (!themes?.knowledgeGraph?.narrativeHighlights) return null;

  const highlights = themes.knowledgeGraph.narrativeHighlights;

  return (
    <div className="spread-patterns">
      <h3>Archetypal Patterns</h3>
      <ul className="pattern-list">
        {highlights.map((highlight, index) => (
          <li key={index} className={`pattern pattern-${highlight.type}`}>
            <span className="pattern-icon">{getPatternIcon(highlight.type)}</span>
            <div dangerouslySetInnerHTML={{ __html: formatMarkdown(highlight.text) }} />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Implementation Plan

### Week 1: Foundation (Days 1-7)

**Goal:** Create core knowledge graph module with basic pattern detection

**Day 1-2: FOOLS_JOURNEY Implementation**
- [ ] Create `src/data/knowledgeGraphData.js` for static data
- [ ] Implement FOOLS_JOURNEY data structure in `knowledgeGraphData.js`
- [ ] Create `functions/lib/knowledgeGraph.js` for detection logic
- [ ] Implement `detectFoolsJourneyStage()` function, importing data from `knowledgeGraphData.js`
- [ ] Write unit tests (10+ test cases)
- [ ] Validate against documentation examples

**Day 3-4: ARCHETYPAL_TRIADS Implementation**
- [ ] Implement ARCHETYPAL_TRIADS data structure (5 core triads)
- [ ] Implement `detectArchetypalTriads()` function
- [ ] Handle complete triads (all 3 cards)
- [ ] Handle partial triads (2 of 3 cards)
- [ ] Write unit tests (15+ test cases covering complete/partial)

**Day 5-6: Master Functions & Integration**
- [ ] Implement `detectAllPatterns()` master function
- [ ] Implement `getPriorityPatternNarratives()` ranking
- [ ] Integrate into `spreadAnalysis.js:analyzeSpreadThemes()`
- [ ] Add graceful error handling (try/catch with fallback)
- [ ] Integration tests with real spread data

**Day 7: Testing & Validation**
- [ ] Run full test suite (unit + integration)
- [ ] Test with Celtic Cross spread (Death-Temperance-Star triad)
- [ ] Test with Three-Card spread (Fool's Journey stages)
- [ ] Verify themes.knowledgeGraph structure correct
- [ ] Performance check (<50ms for pattern detection)

**Deliverables:**
- ✅ `src/data/knowledgeGraphData.js` (containing FOOLS_JOURNEY + TRIADS data)
- ✅ `functions/lib/knowledgeGraph.js` (containing detection logic)
- ✅ Detection functions working
- ✅ Unit tests passing (80%+ coverage)
- ✅ Integration with spreadAnalysis.js complete
- ✅ No breaking changes to existing readings

---

### Week 2: Narrative Integration (Days 8-14)

**Goal:** Integrate patterns into narrative generation pipeline

**Day 8-9: SUIT_PROGRESSIONS Implementation**
- [ ] Implement SUIT_PROGRESSIONS data structure (4 suits × 3 stages)
- [ ] Implement `detectSuitProgressions()` function
- [ ] Detect strong progressions (3+ cards from one stage)
- [ ] Detect emerging progressions (2 cards from one stage)
- [ ] Write unit tests (20+ test cases, 4 suits × 5 scenarios)

**Day 10-11: Prompt Enhancement**
- [ ] Update `narrative/prompts.js:buildSystemPrompt()`
- [ ] Add pattern context section after reversal enforcement
- [ ] Format narrative highlights for LLM consumption
- [ ] Test Azure GPT-5 prompts include patterns
- [ ] Verify prompts don't exceed token limits

**Day 12-13: Spread Builder Updates**
- [ ] Add `buildPatternSynthesis()` to `narrative/helpers.js`
- [ ] Update `narrative/spreads/celticCross.js`
- [ ] Update `narrative/spreads/threeCard.js`
- [ ] Update `narrative/spreads/fiveCard.js`
- [ ] Update `narrative/spreads/relationship.js`
- [ ] Update `narrative/spreads/decision.js`
- [ ] Update `narrative/spreads/singleCard.js` (skip if only 1 card)

**Day 14: End-to-End Testing**
- [ ] Generate 10 test readings (Azure GPT-5 path)
- [ ] Generate 10 test readings (local composer path)
- [ ] Verify pattern sections appear naturally
- [ ] Check pattern language isn't mechanical/forced
- [ ] Compare quality: with patterns vs without

**Deliverables:**
- ✅ SUIT_PROGRESSIONS detection working
- ✅ Prompts enhanced with pattern context
- ✅ All 6 spread builders include pattern synthesis
- ✅ End-to-end flow tested
- ✅ Readings feel more cohesive (qualitative check)

---

### Week 3: Extension & Frontend (Days 15-21)

**Goal:** Extend pattern library and create frontend display

**Day 15-16: ARCHETYPAL_DYADS Extension**
- [ ] Implement extended ARCHETYPAL_DYADS (15 total)
- [ ] Implement `detectArchetypalDyads()` function
- [ ] Categorize by type (transformation, wisdom, shadow, etc.)
- [ ] Significance ranking (high/medium)
- [ ] Unit tests (20+ test cases)

**Day 17-18: Optional Patterns**
- [ ] Implement COURT_PATTERNS (if time permits)
- [ ] Implement `detectCourtClusters()` function
- [ ] Implement NUMERICAL_HARMONICS (if time permits)
- [ ] Implement `detectNumericalHarmonics()` function
- [ ] Update `getPriorityPatternNarratives()` to include new patterns

**Day 19-20: Frontend Component**
- [ ] Create `src/components/SpreadPatterns.jsx`
- [ ] Pattern icon mapping (⚡ for triads, 🌙 for Journey, etc.)
- [ ] Markdown rendering for pattern text
- [ ] CSS styling (match existing theme)
- [ ] Add to reading display layout (after spread grid, before narrative)
- [ ] Optional: Settings toggle "Show Archetypal Patterns"

**Day 21: Performance & Polish**
- [ ] Profile `detectAllPatterns()` execution time
- [ ] Optimize if >100ms on 10-card spread
- [ ] Check for memory leaks
- [ ] Refine narrative templates (readability)
- [ ] Code cleanup, documentation updates

**Deliverables:**
- ✅ Extended dyad library (15 dyads)
- ✅ Optional: Court patterns + numerical harmonics
- ✅ Frontend SpreadPatterns component
- ✅ Performance optimized (<100ms total)
- ✅ Code polished and documented

---

### Week 4: Testing & Deployment (Days 22-28)

**Goal:** Comprehensive testing, staging deployment, production release

**Day 22-23: Comprehensive Testing**
- [ ] Run full test suite (unit + integration + e2e)
- [ ] Manual testing: 50+ spreads across all 6 spread types
- [ ] Test with Majors-only deck
- [ ] Test with Majors + Minors deck
- [ ] Test edge cases:
  - [ ] No patterns detected (scattered cards)
  - [ ] 10+ patterns detected (overwhelming)
  - [ ] All cards reversed
  - [ ] Empty spread (error handling)
- [ ] Backward compatibility check (existing readings unchanged)

**Day 24: Staging Deployment**
- [ ] Deploy to staging environment
- [ ] Run smoke tests (10+ readings)
- [ ] Check CloudFlare logs for errors
- [ ] Verify Azure GPT-5 API calls include patterns
- [ ] Frontend pattern display works
- [ ] Performance monitoring (<100ms analysis)

**Day 25-26: Quality Validation**
- [ ] Expert review: 20 random readings
- [ ] Check pattern relevance (90%+ meaningful)
- [ ] Check narrative coherence (patterns enhance vs distract)
- [ ] User acceptance testing (if available)
- [ ] Compare staging vs production quality
- [ ] Decision: Deploy or iterate?

**Day 27: Production Deployment**
- [ ] Create deployment checklist
- [ ] Deploy to production (if quality ≥ current)
- [ ] Monitor error rates for 2 hours
- [ ] Check first 100 readings for issues
- [ ] CloudFlare analytics review
- [ ] Rollback plan ready (feature flag)

**Day 28: Documentation & Handoff**
- [ ] Update CLAUDE.md with Knowledge Graph architecture
- [ ] JSDoc comments on all exported functions
- [ ] Create visual diagram of pattern hierarchy
- [ ] Write deployment notes
- [ ] Update README with new features
- [ ] Create user-facing help text (if needed)

**Deliverables:**
- ✅ All tests passing
- ✅ Deployed to staging
- ✅ Quality validated (expert review)
- ✅ Deployed to production
- ✅ Documentation complete
- ✅ Project retrospective

---

## Testing Strategy

### Unit Tests

**Location:** `functions/lib/__tests__/knowledgeGraph.test.js`

**Coverage Goals:** 80%+ code coverage

**Test Categories:**

**1. FOOLS_JOURNEY Detection**
```javascript
describe('detectFoolsJourneyStage', () => {
  it('detects initiation stage (3+ cards from 0-7)', () => {
    const cards = [
      { number: 0, name: 'The Fool' },
      { number: 1, name: 'The Magician' },
      { number: 7, name: 'The Chariot' },
      { number: 5, name: 'The Hierophant' }
    ];
    const result = detectFoolsJourneyStage(cards);
    expect(result.stage).toBe('initiation');
    expect(result.cardCount).toBe(4);
  });

  it('detects integration stage', () => { /* ... */ });
  it('detects culmination stage', () => { /* ... */ });
  it('returns null when <2 Major Arcana', () => { /* ... */ });
  it('handles mixed stages (returns dominant)', () => { /* ... */ });
});
```

**2. ARCHETYPAL_TRIADS Detection**
```javascript
describe('detectArchetypalTriads', () => {
  it('detects complete Death-Temperance-Star triad', () => {
    const cards = [
      { number: 13, name: 'Death', orientation: 'Upright' },
      { number: 14, name: 'Temperance', orientation: 'Upright' },
      { number: 17, name: 'The Star', orientation: 'Upright' }
    ];
    const result = detectArchetypalTriads(cards);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('death-temperance-star');
    expect(result[0].isComplete).toBe(true);
    expect(result[0].theme).toBe('Healing Arc');
  });

  it('detects partial triads (2 of 3 cards)', () => { /* ... */ });
  it('returns empty array when no triads', () => { /* ... */ });
  it('detects multiple triads in same spread', () => { /* ... */ });
  it('sorts complete triads before partial', () => { /* ... */ });
});
```

**3. SUIT_PROGRESSIONS Detection**
```javascript
describe('detectSuitProgressions', () => {
  it('detects Cups beginning stage (Ace-2-3)', () => {
    const cards = [
      { suit: 'Cups', rankValue: 1, rank: 'Ace' },
      { suit: 'Cups', rankValue: 2, rank: '2' },
      { suit: 'Cups', rankValue: 3, rank: '3' }
    ];
    const result = detectSuitProgressions(cards);
    expect(result[0].suit).toBe('Cups');
    expect(result[0].stage).toBe('beginning');
    expect(result[0].significance).toBe('strong-progression');
  });

  it('detects emerging progressions (2 cards)', () => { /* ... */ });
  it('returns null when no clear progression', () => { /* ... */ });
  it('handles multiple suits in spread', () => { /* ... */ });
});
```

**4. Priority Ranking**
```javascript
describe('getPriorityPatternNarratives', () => {
  it('prioritizes complete triads over partial', () => { /* ... */ });
  it('limits to top 5 patterns', () => { /* ... */ });
  it('includes significance levels', () => { /* ... */ });
  it('handles empty patterns gracefully', () => { /* ... */ });
});
```

### Integration Tests

**Test Fixtures:** Create realistic spread scenarios

**Fixture 1: Celtic Cross with Healing Arc**
```javascript
const healingArcCelticCross = {
  spreadKey: 'celtic',
  cards: [
    { number: 13, card: 'Death', position: 'Present', orientation: 'Upright' },
    { number: 16, card: 'The Tower', position: 'Challenge', orientation: 'Reversed' },
    // ... 8 more cards including Temperance (14) and Star (17)
  ],
  expectedPatterns: {
    triads: ['death-temperance-star'],
    foolsJourney: 'culmination',
    dyads: []
  }
};
```

**Integration Test Flow:**
```javascript
describe('Knowledge Graph Integration', () => {
  it('integrates with spreadAnalysis.js', async () => {
    const analysis = await performSpreadAnalysis(
      healingArcCelticCross.spreadInfo,
      healingArcCelticCross.cards
    );

    expect(analysis.themes.knowledgeGraph).toBeDefined();
    expect(analysis.themes.knowledgeGraph.patterns.triads).toHaveLength(1);
    expect(analysis.themes.knowledgeGraph.narrativeHighlights).toHaveLength(2); // triad + journey
  });

  it('appears in narrative prompts', () => { /* ... */ });
  it('appears in local composer readings', () => { /* ... */ });
  it('does not break when patterns are absent', () => { /* ... */ });
});
```

### Manual Testing Checklist

**Test Spreads (Minimum 50 total):**
- [ ] 10 Celtic Cross spreads
  - [ ] With complete triad
  - [ ] With partial triad
  - [ ] With strong Journey stage
  - [ ] With multiple patterns
  - [ ] With no patterns
- [ ] 10 Three-Card spreads
  - [ ] Past-Present-Future with Journey arc
  - [ ] Suit progression
  - [ ] No patterns (scattered)
- [ ] 10 Five-Card spreads
- [ ] 5 Relationship spreads
- [ ] 5 Decision spreads
- [ ] 5 Single-Card spreads (patterns should be minimal/absent)
- [ ] 5 Edge cases (all reversed, all same suit, etc.)

**Quality Checks:**
- [ ] Patterns feel meaningful, not forced
- [ ] Narrative language is natural, not mechanical
- [ ] No overwhelming pattern lists (max 5)
- [ ] Relevant to user's question
- [ ] Enhances vs distracts from position meanings

---

## Risk Management

### Technical Risks

**Risk 1: Performance Degradation**
- **Probability:** Medium
- **Impact:** High
- **Mitigation:**
  - Budget: <100ms for detectAllPatterns()
  - Profile early and often
  - Optimize hot paths (memoization, early returns)
  - Fall back gracefully if detection times out

**Risk 2: Breaking Changes to Existing Readings**
- **Probability:** Low
- **Impact:** Critical
- **Mitigation:**
  - Comprehensive regression testing
  - Feature flag for easy rollback
  - Try/catch around pattern detection (graceful degradation)
  - Keep knowledgeGraph as optional property

**Risk 3: Pattern Overload (Too Many Patterns)**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Hard limit: Maximum 5 pattern mentions per reading
  - Priority ranking ensures most relevant patterns surface
  - Tune thresholds based on testing feedback

**Risk 4: LLM Prompt Token Limits**
- **Probability:** Low
- **Impact:** Medium
- **Mitigation:**
  - Keep pattern context concise (200-300 tokens max)
  - Summarize instead of full pattern descriptions
  - Test with longest possible spreads (Celtic Cross)

### Quality Risks

**Risk 5: Patterns Feel Mechanical/Forced**
- **Probability:** Medium
- **Impact:** High
- **Mitigation:**
  - Expert review of 20+ readings
  - Natural language templates
  - Integration guidance in prompts: "Weave naturally, not mechanically"
  - Iterate on templates based on feedback

**Risk 6: Low Pattern Detection Accuracy**
- **Probability:** Low
- **Impact:** High
- **Mitigation:**
  - Based on traditional tarot wisdom (not invented)
  - Unit tests verify detection logic
  - Manual validation with test cases
  - Tune detection thresholds if needed

**Risk 7: Patterns Contradict Position Meanings**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Patterns complement positions, don't override
  - Prompt instructions: "Position meanings are primary"
  - Expert review catches contradictions
  - Adjust narrative templates if issues arise

### Project Risks

**Risk 8: Timeline Slippage**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Buffer days built into each week
  - Core features (Weeks 1-2) prioritized
  - Optional features (Week 3) can be deferred
  - Daily standup/progress tracking

**Risk 9: Scope Creep**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Clear scope definition (in/out scope sections)
  - Defer nice-to-haves to future iterations
  - Focus on 4 core pattern types first
  - Court patterns + harmonics marked optional

---

## Success Metrics

### Technical Metrics

**Performance:**
- ✅ Pattern detection: <100ms (measured on 10-card Celtic Cross)
- ✅ Total analysis time increase: <50ms
- ✅ API response time: No degradation from baseline
- ✅ Memory usage: No leaks detected over 1000 readings

**Quality:**
- ✅ Test coverage: >80%
- ✅ All unit tests passing
- ✅ Integration tests passing
- ✅ Zero breaking changes to existing readings
- ✅ Error rate: <0.1% increase from baseline

**Detection Accuracy:**
- ✅ Complete triads: 100% detection on known test cases
- ✅ Fool's Journey stages: 95%+ accuracy
- ✅ Suit progressions: 90%+ accuracy
- ✅ No false positives in edge cases

### User-Facing Metrics

**Reading Quality (Expert Review):**
- ✅ >90% of detected patterns are meaningful (not forced)
- ✅ >80% of readings feel more cohesive with patterns
- ✅ <5% of readings feel cluttered or overwhelming
- ✅ Narrative language feels natural, not mechanical

**User Experience:**
- ✅ Pattern display (frontend) renders correctly
- ✅ Reading completion rate: No decrease from baseline
- ✅ Bounce rate: No increase from baseline
- ✅ Positive feedback on "deeper insights" (qualitative)

### Business Metrics

**Adoption:**
- ✅ Patterns appear in >70% of readings (with 2+ Majors)
- ✅ Azure GPT-5 prompts include pattern context
- ✅ Local composer includes pattern synthesis
- ✅ Frontend component displays patterns when available

**Stability:**
- ✅ Zero critical bugs in first 48 hours post-deployment
- ✅ <3 minor bugs in first week
- ✅ No rollbacks required
- ✅ CloudFlare error rate remains stable

---

## Deployment Strategy

### Feature Flag Approach

**Environment Variable:** `KNOWLEDGE_GRAPH_ENABLED`

**Implementation:**
```javascript
// In spreadAnalysis.js
export async function analyzeSpreadThemes(cardsInfo, options = {}) {
  const themes = { /* existing analysis */ };

  const KG_ENABLED = options.enableKnowledgeGraph !== false
    && process.env.KNOWLEDGE_GRAPH_ENABLED !== 'false';

  if (KG_ENABLED) {
    try {
      const patterns = detectAllPatterns(cardsInfo);
      if (patterns) {
        themes.knowledgeGraph = { patterns, narrativeHighlights: getPriorityPatternNarratives(patterns) };
      }
    } catch (err) {
      console.error('Knowledge graph detection failed:', err);
      // Graceful degradation: continue without patterns
    }
  }

  return themes;
}
```

**Deployment Sequence:**
1. Deploy to staging with `KNOWLEDGE_GRAPH_ENABLED=true`
2. Test for 1-2 days
3. Deploy to production with `KNOWLEDGE_GRAPH_ENABLED=true`
4. Monitor for 48 hours
5. If issues: Set `KNOWLEDGE_GRAPH_ENABLED=false` (instant rollback)
6. Fix issues, redeploy

### Rollback Plan

**Immediate Rollback (Environment Variable):**
```bash
# Disable knowledge graph without code deployment
wrangler secret put KNOWLEDGE_GRAPH_ENABLED
# Enter: "false"
```

**Full Rollback (Git):**
```bash
# Revert to commit before Knowledge Graph merge
git revert <knowledge-graph-merge-commit>
git push origin main
# Trigger redeployment
```

**Validation After Rollback:**
- [ ] Readings generate without errors
- [ ] No knowledge graph properties in responses
- [ ] Performance returns to baseline
- [ ] Error rates normalize

---

## Project Milestones

### Week 1 Milestone: Foundation Complete
**Exit Criteria:**
- [ ] `src/data/knowledgeGraphData.js` created with FOOLS_JOURNEY + TRIADS data
- [ ] `functions/lib/knowledgeGraph.js` created with detection logic
- [ ] Detection functions working and tested
- [ ] Integrated into spreadAnalysis.js
- [ ] Unit tests passing (80%+ coverage)
- [ ] No breaking changes

**Review:** Code review + demo with test spreads

---

### Week 2 Milestone: Narrative Integration Complete
**Exit Criteria:**
- [ ] SUIT_PROGRESSIONS implemented
- [ ] Prompts enhanced with pattern context
- [ ] All 6 spread builders updated
- [ ] End-to-end flow tested (Azure + local)
- [ ] Pattern sections appear naturally in readings

**Review:** Quality review of 10 generated readings

---

### Week 3 Milestone: Extension & Frontend Complete
**Exit Criteria:**
- [ ] Extended dyad library (15 dyads)
- [ ] Frontend SpreadPatterns component working
- [ ] Performance optimized (<100ms)
- [ ] Optional patterns implemented or deferred
- [ ] Code polished and documented

**Review:** Frontend demo + performance validation

---

### Week 4 Milestone: Production Deployment
**Exit Criteria:**
- [ ] All tests passing
- [ ] Staging deployment successful
- [ ] Quality validation complete (expert review)
- [ ] Production deployment successful
- [ ] 48-hour monitoring shows stability
- [ ] Documentation complete

**Review:** Project retrospective + success metrics analysis

---

## Documentation

### Code Documentation

**Required for All Exported Functions:**
```javascript
/**
 * Detect which stage of the Fool's Journey dominates this spread
 *
 * Analyzes Major Arcana cards (0-21) and determines which of the three
 * journey stages (initiation/integration/culmination) is most represented.
 *
 * @param {Array<Object>} cards - Array of card objects with number property
 * @returns {Object|null} Dominant journey stage with metadata, or null if <2 Majors
 * @example
 * const cards = [
 *   { number: 0, name: 'The Fool' },
 *   { number: 1, name: 'The Magician' },
 *   { number: 7, name: 'The Chariot' }
 * ];
 * const stage = detectFoolsJourneyStage(cards);
 * // Returns: { stage: 'initiation', cardCount: 3, theme: '...', ... }
 */
export function detectFoolsJourneyStage(cards) { /* ... */ }
```

### User-Facing Documentation

**Update CLAUDE.md:**
```markdown
## Knowledge Graph Patterns

The app now detects archetypal patterns across multiple cards:

- **Fool's Journey Stages:** Developmental arcs (initiation/integration/culmination)
- **Archetypal Triads:** Complete 3-card transformation narratives
- **Archetypal Dyads:** Powerful 2-card synergies
- **Suit Progressions:** Minor Arcana narrative arcs

These patterns appear in the "Deeper Patterns" section of readings when detected.
```

**Create Help Text (Optional):**
For frontend toggle/info icon explaining what patterns are and why they matter.

---

## Appendices

### Appendix A: Data Structure Sizes

**Storage Estimates:**
- FOOLS_JOURNEY: ~2 KB
- ARCHETYPAL_TRIADS: ~5 KB (5 triads)
- ARCHETYPAL_DYADS: ~8 KB (15 dyads)
- SUIT_PROGRESSIONS: ~12 KB (4 suits)
- Total: ~27 KB (negligible)

### Appendix B: Performance Benchmarks

**Target Performance (10-card Celtic Cross):**
- detectFoolsJourneyStage: <10ms
- detectArchetypalTriads: <20ms
- detectSuitProgressions: <30ms
- detectArchetypalDyads: <15ms
- getPriorityPatternNarratives: <5ms
- **Total: <80ms** (well under 100ms budget)

### Appendix C: References

**Technical Foundation:**
- Current codebase architecture (modular narrative system)
- Research doc: "Techniques for Teaching AI to Understand Tarot Deck Subtleties"
- Position weighting system (positionWeights.js)
- Reversal enforcement (narrative/prompts.js)

**Tarot Foundation:**
- Rachel Pollack: *Seventy-Eight Degrees of Wisdom*
- Mary K. Greer: *Tarot for Your Self*, *Tarot Constellations*
- Robert Place: *The Tarot: History, Symbolism, and Divination*
- Golden Dawn esoteric correspondences

### Appendix D: Team Roles (If Applicable)

**Solo Implementation:**
- All development, testing, and deployment handled by Claude Code

**If Team-Based:**
- **Lead Developer:** Core implementation (knowledgeGraph.js)
- **Integration Engineer:** Spread builder updates, prompt enhancement
- **Frontend Developer:** SpreadPatterns component
- **QA Engineer:** Testing strategy execution
- **Tarot Expert:** Quality validation, narrative review

---

## Project Approval

**Status:** ✅ Planning Complete - Ready for Implementation

**Approval Checklist:**
- [x] Documentation complete (4 data structures + README)
- [x] Project plan created (this document)
- [x] Scope clearly defined (in/out of scope)
- [x] Timeline realistic (4 weeks)
- [x] Risks identified and mitigated
- [x] Success metrics defined
- [x] Integration points mapped
- [x] Testing strategy comprehensive
- [x] Rollback plan in place

**Next Step:** Begin Week 1 implementation (create knowledgeGraph.js)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-15
**Author:** Claude Code
**Status:** Ready for Implementation
