# Reading Experience UX Audit Summary

**Date:** 2025-01-24  
**Scope:** Complete user-facing reading flow from deck ritual through narrative display  
**Key Finding:** Peak information density of **~2150 words** on screen during Celtic Cross reveal phase

---

## Executive Summary

The Tableu reading experience is currently **text-heavy**, with the highest density in **revealed card states** (100-300 words per card × 10 cards = 2000 words). Combined with instructional text, guidance panels, and reflection prompts, users face **significant reading load** before even reaching the AI-generated narrative.

**Primary opportunity:** Reduce inline text by **~75%** through collapsible meanings, lazy-loaded reflections, and visual-first status indicators.

---

## Documentation Created

1. **[READING_UX_MAP.md](/home/azureuser/tarot/READING_UX_MAP.md)**  
   Comprehensive inventory of every text string, label, badge, and instructional element across all reading components. Organized by component with exact line references.

2. **[reading-ux-visual-flow.md](/home/azureuser/tarot/docs/reading-ux-visual-flow.md)**  
   Visual hierarchy diagram, density heatmap, and prioritized reduction opportunities with impact estimates.

---

## Component Breakdown

### High-Density Components (>100 words visible)

| Component | Words | Primary Content |
|-----------|-------|-----------------|
| **Card.jsx (revealed)** | ~200 | Card name, meaning (100-300 words), reflection prompt, synthesis text |
| **StreamingNarrative** | ~800 | AI-generated reading text |
| **NarrativeSkeleton** | ~80 | Generation steps, status messages, AI reasoning |
| **Narrative Guidance Panel** | ~120 | Style description, reading instructions, disclaimer |

### Medium-Density Components (20-100 words)

| Component | Words | Primary Content |
|-----------|-------|-----------------|
| **ReadingBoard instructional text** | ~15 | Dynamic reveal instructions, position hints |
| **SpreadTable position labels** | ~20 | Position names (varies by spread) |
| **Post-reading actions** | ~30 | Save buttons, follow-up descriptions |
| **CardDetailPanel** | ~30 | Reflection label, expand buttons |

### Low-Density Components (<20 words)

| Component | Words | Primary Content |
|-----------|-------|-----------------|
| **DeckRitual status badges** | ~5 | Knock count, cut index |
| **DeckRitual action buttons** | ~10 | Button labels (Knock, Cut, Shuffle) |
| **Card (unrevealed)** | ~5 | Tap instruction badge |
| **Celtic Map** | ~15 | Position numbers + labels |

---

## Peak Text Load Scenarios

### Scenario 1: Celtic Cross, All Cards Revealed (Worst Case)

```
Component                          Words
─────────────────────────────────────────
Narrative Guidance Panel           120
ReadingBoard instructions          15
Position labels (10 cards)         20
Card meanings (10 × 180 words)     1800
Card names/badges (10 × 3 words)   30
Position synthesis (10 × 12 words) 120
Reflection labels (10 × 5 words)   50
Character counters (10 × 3 words)  30
─────────────────────────────────────────
TOTAL                              2185 words
```

**Reading time:** ~8-10 minutes to read all card meanings before narrative

---

### Scenario 2: Narrative Phase (Post-Reveal)

```
Component                          Words
─────────────────────────────────────────
Narrative text                     800
Post-reading actions               30
Partially visible cards (above)    ~200
─────────────────────────────────────────
TOTAL                              1030 words
```

**Reading time:** ~4-5 minutes for narrative

---

### Scenario 3: Mobile Focus View (Single Card)

```
Component                          Words
─────────────────────────────────────────
Card Focus Overlay header          8
Card name + badge                  3
Position synthesis                 12
Meaning text                       180
Reflection section                 13
─────────────────────────────────────────
TOTAL                              216 words
```

**Reading time:** ~1 minute per card

**Note:** Mobile UX is significantly better due to card-by-card focus pattern.

---

## Critical Findings

### 1. Card Meanings Dominate Screen Real Estate

**Current state:**
- Every revealed card shows full 100-300 word meaning inline
- 10-card Celtic Cross = **1800 words** of card definitions
- Users must scroll past all meanings to reach narrative

**Impact:**
- Narrative feels buried beneath reference text
- Users may skip reading meanings due to overwhelming volume
- Mobile users face excessive scrolling

**Recommendation:**
- Collapse meanings by default (show first 2 lines)
- "Expand" button per card
- Full meanings available in CardModal on demand

**Expected improvement:** -75% text (-1500 words)

---

### 2. Reflection Textareas Add Visual Clutter

**Current state:**
- Every card has expandable reflection section
- Labels, textareas, character counters multiply visual noise
- On desktop, all 10 textareas visible simultaneously

**Impact:**
- Screen feels "busy" even with minimal user input
- Character counters create anxiety/distraction
- Unclear if reflections are meant to be filled before or after narrative

**Recommendation:**
- **Option A:** Single reading-level reflection (not per-card)
- **Option B:** Lazy-load reflections (button to expand per card)
- Hide character counters until >400 chars (approaching limit)

**Expected improvement:** -100 words, cleaner visual hierarchy

---

### 3. Guidance Text Repeats Across UI

**Current state:**
- Narrative guidance panel: ~120 words (always visible on first reveal)
- Instructional text in ReadingBoard: ~15 words (changes with state)
- Card tap instructions: "Tap to uncover truth" (repeated 10 times)
- Reflection prompts: "What resonates for you?" (repeated 10 times)

**Impact:**
- First-time users benefit from guidance
- Return users see redundant instructions every reading
- Text competes with ritual/mystical atmosphere

**Recommendation:**
- Move narrative guidance to onboarding flow only
- Hide instructional text after first interaction (per session)
- Use single reflection prompt at reading level
- Replace "Tap to uncover truth" with icon-only pulse after first card

**Expected improvement:** -150 words, less repetition

---

### 4. Position Synthesis is Redundant

**Current state:**
- Every card shows synthesis text: "The Hermit as your challenge..."
- Meaning text already provides position-aware interpretation
- 12 words × 10 cards = 120 words total

**Impact:**
- Minimal value (meaning text covers same ground)
- Adds visual density without clear benefit
- Users may read twice (synthesis + meaning)

**Recommendation:**
- Remove position synthesis text
- Rely on position label + meaning text
- Keep synthesis concept for narrative generation only

**Expected improvement:** -120 words

---

### 5. Orientation Badges Have Low Information Density

**Current state:**
- "Upright" / "Reversed" text badges on every card
- Visual rotation already signals orientation
- Badge adds ~15px height per card

**Impact:**
- Redundant with visual rotation
- Adds clutter for uncertain benefit
- Users familiar with tarot don't need label

**Recommendation:**
- **Option A:** Remove badge (rotation is sufficient)
- **Option B:** Icon-only (↑/↓ arrows)
- **Option C:** Keep for accessibility (screen reader users)

**Expected improvement:** -20 words, cleaner card layout

---

## Reduction Roadmap

### Phase 1: Collapse Inline Content (Quick Win)

**Changes:**
1. Collapse card meanings by default
2. Remove narrative guidance panel from reading view
3. Hide character counters until near limit
4. Remove position synthesis text

**Impact:**
- Peak text: 2150 → 540 words (**-75%**)
- Implementation: ~4 hours (add collapse/expand state)
- Risk: Low (all content still accessible via expand)

---

### Phase 2: Visual-First Indicators (Polish)

**Changes:**
1. Orientation badges → icon or remove
2. Progress indicators → visual-only (minimap)
3. Navigation labels → icon-only
4. Status badges → icon + tooltip

**Impact:**
- Additional -50 words
- Implementation: ~6 hours (icon design + accessibility)
- Risk: Medium (ensure ARIA labels for screen readers)

---

### Phase 3: Contextual Intelligence (Refinement)

**Changes:**
1. Hide instructions after first interaction
2. Lazy-load reflections per card
3. Single reading-level reflection option
4. AI reasoning summaries → debug mode only

**Impact:**
- Additional -100 words
- Implementation: ~8 hours (state management + UX testing)
- Risk: Medium (need user testing to validate)

---

## Recommended Priorities

### ✅ Do First (High Impact, Low Risk)

1. **Collapse card meanings by default**
   - Biggest text reduction (1500 words)
   - Low implementation complexity
   - Preserves all functionality

2. **Hide character counters until >400 chars**
   - Reduces visual noise significantly
   - No functionality loss
   - Simple conditional render

3. **Remove narrative guidance panel from reading view**
   - Move to onboarding/settings page
   - 120 words removed
   - Return users don't need repeated instructions

---

### 🔄 Do Next (Medium Impact, Medium Risk)

4. **Remove position synthesis text**
   - Redundant with meaning text
   - 120 words removed
   - Test with users to confirm no value loss

5. **Lazy-load reflection textareas**
   - Cleaner initial card view
   - Reduces visual clutter
   - Requires UX pattern design

6. **Icon-only orientation badges** (or remove)
   - Small impact per card, multiplies across spread
   - Needs accessibility review
   - A/B test to measure comprehension

---

### 🤔 Consider Later (Low Impact or High Risk)

7. **Single reading-level reflection**
   - Major UX change from current per-card pattern
   - Needs user research to validate
   - May lose valuable per-card context

8. **Hide instructions after first interaction**
   - Context-dependent (needs session state)
   - Risk of confusing returning users after break
   - Better solved by onboarding flow

9. **Remove AI reasoning summaries**
   - Only visible in extended prompt mode
   - Some users may value transparency
   - Move to advanced/debug toggle instead

---

## Mobile vs. Desktop Considerations

### Mobile (Card Focus Pattern)

**Current state:** Much better UX due to card-by-card focus overlay
- Peak text: ~216 words per card
- Manageable reading load
- Swipe navigation feels natural

**Recommendations:**
- Keep focus pattern (it works!)
- Still collapse meanings for consistency
- Consider swipe gestures for expand/collapse

---

### Desktop (All Cards Visible)

**Current state:** Overwhelming with all 10 cards revealed
- Peak text: 2150 words simultaneously visible
- Requires extensive scrolling
- Difficult to maintain reading flow

**Recommendations:**
- **Critical:** Collapse meanings by default
- Add "Expand all" / "Collapse all" controls
- Consider progressive disclosure (expand on hover)

---

## Accessibility Considerations

When reducing text, ensure:

1. **ARIA labels** replace removed visible text
   - Orientation badges → `aria-label="Reversed"`
   - Action buttons → `aria-label="Knock on deck"`
   - Navigation → `aria-label="Previous card"`

2. **Screen reader announcements** for state changes
   - Collapsed/expanded meanings
   - Reflection section visibility
   - Progress updates

3. **Keyboard navigation** remains intact
   - Tab order logical
   - Enter/Space to expand collapsed content
   - Escape to collapse

4. **Focus indicators** clearly visible
   - Especially for icon-only buttons
   - High contrast for collapsed state

---

## Success Metrics

Track after implementation:

1. **Time to first narrative scroll**
   - Current: ~8-10 minutes (read all meanings)
   - Target: ~2-3 minutes (scan cards, reach narrative faster)

2. **Meaning expansion rate**
   - What % of users expand card meanings?
   - Which cards get expanded most?

3. **Reflection completion rate**
   - Does lazy-loading reduce or increase reflection usage?

4. **User feedback sentiment**
   - "Too much text" mentions
   - "Couldn't find X" confusion

5. **Mobile vs. Desktop behavior**
   - Do patterns differ between platforms?
   - Should UX diverge further?

---

## Next Steps

1. **Review findings** with product/design team
2. **Prioritize Phase 1** changes for next sprint
3. **Design expand/collapse patterns** (collapsed state design)
4. **Implement card meaning collapse** (highest impact)
5. **User testing** with prototype
6. **Iterate based on feedback**

---

## Related Files

- **Detailed Inventory:** `READING_UX_MAP.md`
- **Visual Flow Diagram:** `docs/reading-ux-visual-flow.md`
- **Component Files:**
  - `src/components/Card.jsx` (highest density)
  - `src/components/ReadingDisplay.jsx` (orchestrator)
  - `src/components/ReadingBoard.jsx` (spread container)
  - `src/components/DeckRitual.jsx` (ritual UI)
  - `src/components/StreamingNarrative.jsx` (narrative display)
  - `src/components/NarrativeSkeleton.jsx` (loading state)
  - `src/components/SpreadTable.jsx` (layout engine)

---

## Conclusion

The Tableu reading experience is **functionally complete** but **visually dense**. The core issue is not architecture or code quality—it's **information hierarchy**. Card meanings, while valuable, should not dominate the screen before users reach the personalized narrative.

**Key insight:** The AI narrative is the primary value—card meanings are reference material. Current UX treats them as equal, resulting in "reference manual" feel instead of "guided journey" feel.

**Recommended approach:** Progressive disclosure. Show just enough to orient the user, provide easy access to full details on demand. Let the AI narrative and visual card imagery do the heavy lifting.

**Expected outcome:** More users reach and engage with the narrative, less cognitive overload, faster reading flow, better retention of key insights.
