# Reading UX Quick Reference

**Quick lookup for developers working on reading experience components.**

---

## Component Text Inventory (By File)

### Card.jsx - **HIGHEST DENSITY** ⚠️
**Lines: 1-789 | Density: Very High (200+ words per revealed card)**

#### Unrevealed State (Face Down):
- **Line 609:** `MICROCOPY.tapToReveal` → `"Tap to uncover truth"`
- **Line 581:** ARIA label: `"[Position]. Tap to reveal."`
- **Lines 594-601:** Swipe hint arrows (visual, no text)

#### Revealed State (Face Up):
- **Line 550:** Anchor badge: `getPositionAnchor(position)` (e.g., `"Now"`, `"Obstacle"`)
- **Lines 682-690:** Orientation badge: `"Upright"` or `"Reversed"`
- **Line 695:** Position synthesis: `getSynthesisText(...)` (e.g., `"The Hermit as your challenge..."`)
- **Lines 703-708:** **Card meaning panel** (100-300 words) ⚠️
- **Line 757:** Reflection label: `"What resonates for you?"`
- **Line 770:** Reflection placeholder: `MICROCOPY.reflectionPlaceholder` → `"Your thoughts and feelings... (optional)"`
- **Line 777:** Character counter: `"[count] / 500"` (color-coded)

**Reduction Targets:**
- Collapse meaning panel by default (lines 703-708)
- Lazy-load reflection section (lines 711-782)
- Remove position synthesis (line 695)
- Hide character counter until >400 chars (line 777)

---

### ReadingBoard.jsx - **MEDIUM DENSITY**
**Lines: 1-545 | Density: Medium (50-100 words)**

#### Instructional Text:
- **Lines 482-487:** Dynamic instruction text
  - Deck mode: `"Draw from the deck to place your first card. Next: [position]."`
  - Spread mode: `"Tap positions to reveal. Next: [position]. Tap a revealed card to focus."`
  - All revealed: `"All cards revealed."`

#### Celtic Cross Map:
- **Line 496:** Map button: `"Map"` + icon
- **Lines 394:** Position labels: `"Present"`, `"Challenge"`, etc. (10 labels)
- **Line 403:** Dismiss text: `"Tap anywhere to close"`

#### Card Detail Panel (Desktop):
- **Line 180:** Empty state: `"Select a revealed card to see details here."`
- **Lines 129-131:** Reflection label: `"What resonates for you?"`
- **Line 142:** Reflection placeholder: `"What resonates? (optional)"`

**Reduction Targets:**
- Hide instructional text after first reveal (lines 482-487)
- Map labels sufficient, no additional text needed

---

### DeckRitual.jsx - **LOW-MEDIUM DENSITY**
**Lines: 1-979 | Density: Low (15-30 words)**

#### Status Badges:
- **Line 602:** Knock: `"Knock (0/3)"` → `"✓ Cleared"`
- **Line 611:** Cut: `"Uncut"` → `"#37"`

#### Action Buttons:
- **Line 789:** Knock button: `"Knock (0/3)"` or `"✓"`
- **Line 809:** Cut button: `"Cut"` or `"Cut (#37)"`
- **Line 829:** Shuffle button: `"Shuffle"` or `"Shuffling..."`

#### Quick Draw CTA (Mobile):
- **Line 765:** `"Draw: [nextPosition] ([cardsRemaining])"`
  - Example: `"Draw: Present (10)"`

#### Cut Slider:
- **Line 725:** Label: `"Cut position"`
- **Line 726:** Value: `"#[localCutIndex]"`
- **Line 742:** Cancel button: `"Cancel"`
- **Line 747:** Confirm button: `"Confirm Cut"`

#### ARIA Labels (Complex):
- **Lines 560-566:** Dynamic label based on state:
  - Knocking: `"Tap to knock (0/3). 3 quick taps within 2s. Hold to cut. Double-tap to shuffle."`
  - Dealing: `"Tap to draw card for Present. Hold to adjust. Double-tap to shuffle."`
  - Spread mode: `"Tap Present on the board to reveal."`
  - Complete: `"All cards dealt"`

**Reduction Targets:**
- Status badges: icon-only for desktop (keep text on mobile)
- Action buttons: icon + tooltip for desktop

---

### StreamingNarrative.jsx - **VERY HIGH DENSITY**
**Lines: 1-370 | Density: Very High (600-1200 words)**

#### Main Content:
- **Props:** `text` - The AI-generated narrative (600-1200 words)
- **Lines 17-51:** Atmosphere layer (visual only, no text)
- **Lines 148-151:** Highlight phrases (visual emphasis, no additional text)

#### Voice Prompt (when TTS available):
- Not in this file - rendered by parent `ReadingDisplay.jsx`

**Reduction Targets:**
- No changes needed (narrative is core value)
- Ensure skip streaming option is prominent

---

### NarrativeSkeleton.jsx - **MEDIUM-HIGH DENSITY**
**Lines: 1-376 | Density: Medium-High (80-150 words)**

#### Generation Steps:
- **Lines 74-78:** Step labels (constant):
  1. `"Reading the spread"`
  2. `"Finding the connections"`
  3. `"Weaving the narrative"`

#### Status Messages (Rotating):
- **Lines 9-20:** Initial messages (0-12s):
  - `"Weaving your personalized narrative..."`
  - `"Drawing connections between the cards..."`
  - `"Interpreting the spread positions..."`
- **Lines 15-20:** Extended messages (>12s):
  - `"Taking a bit longer than usual..."`
  - `"Crafting a thoughtful interpretation..."`
  - `"Almost there, adding final touches..."`

#### Contextual Text:
- **Line 277:** Hint: `"Let your attention rest on the card that feels loudest."`
- **Line 365:** Extended wait: `"Complex spreads take a moment to interpret thoughtfully."`
- **Line 288:** Reasoning badge: `"CONSIDERING"`
- **Line 261:** Arc badge: `"NARRATIVE ARC"`

**Reduction Targets:**
- Reduce status message variants (6 → 2-3)
- Move AI reasoning to debug mode only

---

### ReadingDisplay.jsx - **HIGH DENSITY**
**Lines: 1-1394 | Density: High (100-200 words)**

#### Narrative Guidance Panel:
- **Lines 164-171:** Three paragraphs (~120 words total):
  1. Braiding explanation
  2. Style description
  3. Disclaimer

#### Pre-Narrative Instructions:
- **Line 934:** `"Reveal in order for a narrative flow, or follow your intuition and reveal randomly."`

#### Reveal Controls:
- **Line 949:** `"Reveal all cards"`
- **Line 960:** `"Reset reveals"`

#### Voice Prompt:
- **Line 1203:** `"This reading can be narrated aloud. Enable voice to hear it."`
- **Line 1205:** Buttons: `"Enable voice"` / `"Maybe later"`

#### Post-Narrative Actions:
- **Line 1173:** `"Save to Journal"` / `"Saving..."`
- **Line 1181:** `"View Journal"`
- **Line 1251:** `"Cinematic reveal"`
- **Line 1316:** `"Open a private chat window to explore this reading."`
- **Line 1341:** `"New reading"` / `"Shuffling..."`

**Reduction Targets:**
- Remove narrative guidance panel (lines 161-210)
- Simplify pre-narrative instructions (line 934)

---

### SpreadTable.jsx - **MEDIUM DENSITY**
**Lines: 1-800+ | Density: Medium (20-50 words)**

#### Position Labels (Embedded in Layout):
- **Lines 21-63:** `SPREAD_LAYOUTS` object defines labels per spread
  - Three Card: `"Past"`, `"Present"`, `"Future"`
  - Five Card: `"Core"`, `"Challenge"`, `"Hidden"`, `"Support"`, `"Direction"`
  - Decision: `"Heart"`, `"Path A"`, `"Path B"`, `"Clarity"`, `"Free Will"`
  - Relationship: `"You"`, `"Them"`, `"Connection"`, `"Dynamics"`, `"Outcome"`
  - Celtic Cross: 10 positions (see `READING_UX_MAP.md`)

#### Visual Indicators:
- **Lines 135-166:** Pulse ring (next card) - visual only
- **Lines 202-228:** Flash ring (just placed) - visual only

**Reduction Targets:**
- Position labels are essential, keep as-is
- Visual indicators are non-verbal, no changes needed

---

## Microcopy Constants

**File:** `src/lib/microcopy.js`

```javascript
export const MICROCOPY = {
  // Card reveal
  tapToReveal: 'Tap to uncover truth',
  
  // Reflection
  reflectionPlaceholder: 'Your thoughts and feelings... (optional)',
  whatResonates: 'What resonates for you?',
  
  // Progress
  progressLabel: (revealed, total) => `${revealed} of ${total} revealed`,
  
  // Actions
  readFullMeaning: 'Read full meaning',
  
  // Tactile lens
  holdToViewMeanings: 'Hold to view meanings',
  
  // Screen reader
  srRevealed: (cardName, position) => `Revealed ${cardName} in ${position}.`
};
```

---

## Reduction Priority Matrix

| Component | Current Words | Target Words | Priority | Effort | Risk |
|-----------|---------------|--------------|----------|--------|------|
| **Card meanings** | 1800 (10×180) | 0 (collapsed) | 🔴 Critical | Low | Low |
| **Narrative guidance** | 120 | 0 (moved) | 🔴 Critical | Low | Low |
| **Position synthesis** | 120 | 0 (removed) | 🟡 High | Low | Medium |
| **Reflection labels** | 50 | 10 (lazy) | 🟡 High | Medium | Medium |
| **Character counters** | 30 | 5 (conditional) | 🟡 High | Low | Low |
| **Orientation badges** | 20 | 0 (icon/remove) | 🟢 Medium | Low | Medium |
| **Status messages** | 30 | 15 (simplified) | 🟢 Medium | Low | Low |
| **Instructional text** | 15 | 5 (contextual) | 🟢 Medium | Medium | Medium |

---

## Quick Action Checklist

### To Reduce Text by 75%:

- [ ] **Card.jsx (lines 703-708):** Add collapse/expand state to meaning panel
- [ ] **Card.jsx (line 777):** Hide character counter until >400 chars
- [ ] **Card.jsx (line 695):** Comment out position synthesis line
- [ ] **ReadingDisplay.jsx (lines 161-210):** Move guidance panel to onboarding
- [ ] **Card.jsx (lines 711-782):** Add lazy-load state to reflection section
- [ ] **ReadingBoard.jsx (lines 482-487):** Add session state to hide after first reveal
- [ ] **NarrativeSkeleton.jsx (lines 280-297):** Add debug mode toggle for AI reasoning

### To Add Visual-First Indicators:

- [ ] **Card.jsx (lines 682-690):** Replace badge text with ↑/↓ icons
- [ ] **DeckRitual.jsx (line 602, 611):** Icon-only badges for desktop
- [ ] **ReadingBoard.jsx (lines 318-341):** Icon-only navigation labels
- [ ] Add progress ring component (replace text counters)

### Accessibility Checklist:

- [ ] Add ARIA labels to all icon-only buttons
- [ ] Test collapsed/expanded states with screen reader
- [ ] Verify keyboard navigation through collapsed content
- [ ] Ensure focus indicators visible on all interactive elements
- [ ] Add live region announcements for expand/collapse actions

---

## Testing Scenarios

1. **Desktop Celtic Cross (10 cards):**
   - Verify collapsed meanings save scroll height
   - Test "Expand all" functionality
   - Check that expanded state persists during navigation

2. **Mobile Single Card Focus:**
   - Verify reflection lazy-load UX
   - Test swipe navigation with collapsed meanings
   - Check character counter appears near limit

3. **Return User (2nd+ reading):**
   - Verify instructional text hidden
   - Check that guidance panel removed
   - Test that ritual instructions still accessible via tooltip/modal

4. **Screen Reader:**
   - Verify ARIA labels on collapsed elements
   - Test expand/collapse announcements
   - Check navigation order logical

5. **Reduced Motion:**
   - Verify collapse/expand uses instant transition
   - Check no flash/pulse animations
   - Test that all content accessible without animation

---

## File Locations

| Component | Path | Lines |
|-----------|------|-------|
| Card | `src/components/Card.jsx` | 789 |
| ReadingBoard | `src/components/ReadingBoard.jsx` | 545 |
| DeckRitual | `src/components/DeckRitual.jsx` | 979 |
| StreamingNarrative | `src/components/StreamingNarrative.jsx` | 370 |
| NarrativeSkeleton | `src/components/NarrativeSkeleton.jsx` | 376 |
| ReadingDisplay | `src/components/ReadingDisplay.jsx` | 1394 |
| SpreadTable | `src/components/SpreadTable.jsx` | 800+ |
| Microcopy | `src/lib/microcopy.js` | 57 |

---

## Related Documentation

- **Complete Inventory:** `/home/azureuser/tarot/READING_UX_MAP.md`
- **Visual Flow:** `/home/azureuser/tarot/docs/reading-ux-visual-flow.md`
- **Audit Summary:** `/home/azureuser/tarot/docs/READING_UX_AUDIT.md`
