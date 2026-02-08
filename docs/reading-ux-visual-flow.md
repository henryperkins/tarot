# Reading Experience Visual Flow

## Component Hierarchy & Information Density

```
ReadingDisplay.jsx (Orchestrator)
├─ [HIGH DENSITY REGION]
│  ├─ Narrative Guidance Panel
│  │  ├─ Icon: Star
│  │  ├─ Heading: "Narrative style & guidance"
│  │  └─ 3 paragraphs (~120 words)
│  │
│  ├─ Moon Phase Indicator
│  │  └─ Icon + phase name
│  │
│  └─ Spread Info Header
│     ├─ Spread name (e.g., "Celtic Cross")
│     └─ Question display (if provided)
│
├─ DeckRitual.jsx [LOW-MEDIUM DENSITY]
│  ├─ Status Badges (2 pills)
│  │  ├─ Knock: "0/3" → "✓ Cleared" 
│  │  └─ Cut: "Uncut" → "#37"
│  │
│  ├─ Deck Visual (7 stacked cards)
│  │  └─ Top card: Tableu logo (no text)
│  │
│  ├─ Action Buttons (3 buttons)
│  │  ├─ "Knock (0/3)" / "✓"
│  │  ├─ "Cut" / "Cut (#37)"
│  │  └─ "Shuffle" / "Shuffling..."
│  │
│  └─ Quick Draw CTA (mobile only)
│     └─ "Draw: Present (10)"
│
├─ ReadingBoard.jsx [MEDIUM DENSITY]
│  ├─ Instructional Text (1 line, dynamic)
│  │  ├─ "Draw from deck to place first card. Next: Present."
│  │  ├─ "Tap positions to reveal. Next: Challenge."
│  │  └─ "All cards revealed. Tap a card to focus."
│  │
│  ├─ Celtic Map Toggle (Celtic Cross only)
│  │  └─ Button: "Map" (icon + label)
│  │
│  ├─ SpreadTable.jsx [MEDIUM-HIGH DENSITY]
│  │  ├─ Per-slot visuals:
│  │  │  ├─ Pulse ring (next card indicator)
│  │  │  ├─ Flash ring (just placed)
│  │  │  └─ Position label (embedded in layout)
│  │  │
│  │  └─ Spread layouts (text labels per position):
│  │     ├─ Three Card: "Past" "Present" "Future"
│  │     ├─ Five Card: "Core" "Challenge" "Hidden" "Support" "Direction"
│  │     ├─ Decision: "Heart" "Path A" "Path B" "Clarity" "Free Will"
│  │     ├─ Relationship: "You" "Them" "Connection" "Dynamics" "Outcome"
│  │     └─ Celtic Cross: 10 positions (see full list in main doc)
│  │
│  ├─ CardDetailPanel (desktop) [HIGH DENSITY when active]
│  │  └─ See Card.jsx revealed state below
│  │
│  └─ CardFocusOverlay (mobile) [HIGH DENSITY when active]
│     ├─ Header:
│     │  ├─ "Back to spread" button
│     │  └─ Navigation: "Prev" [Position] "Next"
│     └─ Content: CardDetailContent (see below)
│
├─ Card.jsx (per card, 1-10 instances) [★ HIGHEST DENSITY ★]
│  │
│  ├─ Header Section:
│  │  ├─ Position label: "Present" (serif, accent)
│  │  └─ Anchor badge: "Now" (floating pill)
│  │
│  ├─ UNREVEALED STATE [LOW DENSITY]:
│  │  ├─ Card back visual (mystical design)
│  │  ├─ Swipe hint arrows (animated, no text)
│  │  └─ Instruction badge: "Tap to uncover truth"
│  │  └─ ARIA: "[Position]. Tap to reveal."
│  │
│  └─ REVEALED STATE [★ VERY HIGH DENSITY ★]:
│     ├─ Zoom button (icon only: ArrowsOut)
│     │
│     ├─ Card Image:
│     │  ├─ Alt: "[Card Name] (Reversed)"
│     │  ├─ Border (suit-colored for Minors)
│     │  └─ Element flash on reveal (visual only)
│     │
│     ├─ Orientation Badge:
│     │  └─ "Upright" or "Reversed" (colored pill)
│     │
│     ├─ Position Synthesis: [~10-15 words]
│     │  └─ "The Hermit as your challenge..."
│     │
│     ├─ Card Symbol Insights (button)
│     │
│     ├─ Meaning Panel: [★ 100-300 WORDS ★]
│     │  └─ Full upright/reversed meaning paragraph
│     │
│     └─ Reflection Section: [EXPANDABLE]
│        ├─ Collapsed (mobile):
│        │  └─ "Add reflection" / "Edit reflection (47)"
│        │
│        └─ Expanded:
│           ├─ Label: "What resonates for you?"
│           ├─ Textarea: 
│           │  └─ Placeholder: "Your thoughts..."
│           └─ Counter: "347 / 500" (color-coded)
│
├─ NarrativeSkeleton.jsx (during generation) [MEDIUM-HIGH DENSITY]
│  ├─ Header skeleton (pulsing shapes, no text)
│  │
│  ├─ Ritual Stage Preview:
│  │  └─ 3-5 miniature card outlines
│  │
│  ├─ Generation Steps: [3 LABELS]
│  │  ├─ "Reading the spread" (active)
│  │  ├─ "Finding the connections"
│  │  └─ "Weaving the narrative"
│  │
│  ├─ Narrative Arc Preview (when available):
│  │  ├─ Badge: "NARRATIVE ARC"
│  │  ├─ Name: "Tension and Resolution"
│  │  └─ Description: [1-2 sentences]
│  │
│  ├─ Hint Text:
│  │  └─ "Let your attention rest on the card that feels loudest."
│  │
│  ├─ AI Reasoning Summary (extended prompt mode):
│  │  ├─ Badge: "CONSIDERING"
│  │  └─ Text: [~50-100 words, truncated to 280 chars]
│  │
│  ├─ Question Anchor Skeleton (if question provided)
│  │
│  ├─ Narrative Text Skeleton:
│  │  └─ 4-15 pulsing lines (varies by spread size)
│  │
│  └─ Weaving Indicator:
│     ├─ 3 bouncing dots (animated)
│     ├─ Status message (rotates every 3.5s):
│     │  ├─ "Weaving your personalized narrative..."
│     │  ├─ "Drawing connections between cards..."
│     │  └─ (5 more variants, see main doc)
│     └─ Extended wait reassurance (>12s):
│        └─ "Complex spreads take a moment to interpret thoughtfully."
│
├─ StreamingNarrative.jsx (after generation) [MEDIUM-LOW DENSITY]
│  ├─ Atmosphere Layer (visual gradient, no text)
│  │
│  ├─ Narrative Text: [★ 600-1200 WORDS ★]
│  │  ├─ Markdown rendered (headings, paragraphs, lists)
│  │  ├─ Phrase highlights (key cards/themes)
│  │  └─ TTS cursor (during narration)
│  │
│  └─ Voice Prompt (when TTS available):
│     ├─ "This reading can be narrated aloud."
│     └─ Buttons: "Enable voice" | "Maybe later"
│
└─ Post-Reading Actions [MEDIUM DENSITY]
   ├─ Save to Journal:
   │  └─ "Save to Journal" / "Saving..." / "Saved"
   │
   ├─ View Journal Link
   │
   ├─ Follow-Up Chat:
   │  ├─ Button: "Ask Follow-Up"
   │  └─ Description: "Open private chat to explore..."
   │
   ├─ Journal Nudge (first-timers):
   │  └─ [Contextual prompt, exact text in nudges/]
   │
   ├─ Cinematic Reveal Toggle:
   │  └─ "Cinematic reveal" (feature flag)
   │
   └─ New Reading Button:
      └─ "New reading" / "Shuffling..."
```

---

## Information Density Heatmap

```
LEGEND:
█████ VERY HIGH (200+ words visible)
████  HIGH (50-200 words)
███   MEDIUM (20-50 words)
██    LOW (5-20 words)
█     MINIMAL (<5 words)

┌─────────────────────────────────────────────────┐
│ ReadingDisplay (Container)                      │
├─────────────────────────────────────────────────┤
│ [████ ] Narrative Guidance Panel                │
│ [█    ] Moon Phase Indicator                    │
│ [██   ] Spread Info Header                      │
├─────────────────────────────────────────────────┤
│ DeckRitual                                      │
├─────────────────────────────────────────────────┤
│ [██   ] Status Badges (Knock/Cut)               │
│ [█    ] Deck Visual (logo, no text)             │
│ [███  ] Action Buttons (3 buttons)              │
│ [██   ] Quick Draw CTA (mobile)                 │
├─────────────────────────────────────────────────┤
│ ReadingBoard                                    │
├─────────────────────────────────────────────────┤
│ [███  ] Instructional Text (dynamic)            │
│ [█    ] Celtic Map Toggle                       │
│ ├─ SpreadTable                                  │
│ │  [████ ] Position Labels (1-10 cards)         │
│ │  [█    ] Pulse/Flash Rings (visual)           │
│ ├─ CardDetailPanel (desktop)                    │
│ │  └─ [█████] Card content (see below)          │
│ └─ CardFocusOverlay (mobile)                    │
│    └─ [█████] Card content (see below)          │
├─────────────────────────────────────────────────┤
│ Card.jsx (per card × 1-10)                      │
├─────────────────────────────────────────────────┤
│ [███  ] Position Label + Anchor                 │
│                                                 │
│ UNREVEALED:                                     │
│ [█    ] Card Back (visual)                      │
│ [██   ] Instruction Badge                       │
│                                                 │
│ REVEALED: ★ HIGHEST DENSITY ZONE ★              │
│ [██   ] Card Name + Orientation Badge           │
│ [██   ] Position Synthesis                      │
│ [█████] Meaning Text (100-300 words)            │
│ [███  ] Reflection Section                      │
│   ├─ Label                                      │
│   ├─ Textarea (0-500 chars)                     │
│   └─ Character counter                          │
├─────────────────────────────────────────────────┤
│ NarrativeSkeleton (loading)                     │
├─────────────────────────────────────────────────┤
│ [█    ] Header Skeleton (visual)                │
│ [█    ] Card Preview (visual)                   │
│ [███  ] Generation Steps                        │
│ [███  ] Narrative Arc Preview                   │
│ [██   ] Hint Text                               │
│ [████ ] AI Reasoning Summary (optional)         │
│ [███  ] Status Message + Reassurance            │
├─────────────────────────────────────────────────┤
│ StreamingNarrative (generated)                  │
├─────────────────────────────────────────────────┤
│ [█████] Narrative Text (600-1200 words)         │
│ [███  ] Voice Prompt (when available)           │
├─────────────────────────────────────────────────┤
│ Post-Reading Actions                            │
├─────────────────────────────────────────────────┤
│ [███  ] Save/Journal Buttons                    │
│ [███  ] Follow-Up Chat Button + Description     │
│ [████ ] Journal Nudge (first-timers)            │
│ [██   ] Cinematic Toggle + New Reading          │
└─────────────────────────────────────────────────┘
```

---

## Peak Text Load Scenarios

### Scenario 1: Celtic Cross (10 cards) - All Revealed, Pre-Narrative

**Visible Text:**
- Narrative Guidance Panel: ~120 words
- Instructional text: ~15 words
- Position labels (10 cards): ~20 words
- Card revealed states (10 × ~200 words each):
  - Card name + badge: ~3 words
  - Position synthesis: ~12 words
  - Meaning text: ~180 words
  - Reflection label + counter: ~5 words
  - **Subtotal per card: ~200 words**
  - **10 cards: ~2000 words**

**TOTAL: ~2150 words visible on screen**

---

### Scenario 2: Celtic Cross - Narrative Displayed

**Visible Text:**
- Narrative text: ~800 words (typical)
- Post-reading actions: ~30 words
- Scroll reveals cards above (partially visible)

**TOTAL: ~830 words in viewport** (more above fold)

---

### Scenario 3: Mobile Handset - Single Card Focus

**Visible Text:**
- Card Focus Overlay:
  - Navigation: ~3 words
  - Position labels: ~5 words
  - Card name + badge: ~3 words
  - Position synthesis: ~12 words
  - Meaning text: ~180 words
  - Reflection section: ~10 words
  - Character counter: ~3 words

**TOTAL: ~215 words in viewport**

*Much more manageable on mobile due to card-by-card focus pattern.*

---

## Component Interaction Map

```
User Flow: Tap Unrevealed Card → Revealed Card → Card Modal

┌──────────────────┐
│ Unrevealed Card  │
│ (Card.jsx)       │
├──────────────────┤
│ ▶ CardBack       │ ← Visual only
│ ▶ Tap Badge      │ ← "Tap to uncover truth"
│ ▶ Swipe Arrows   │ ← Animated visual hints
└────────┬─────────┘
         │ [TAP]
         ▼
┌──────────────────┐
│ Revealed Card    │
│ (Card.jsx)       │ ★ DENSITY JUMP ★
├──────────────────┤
│ ▶ Card Image     │
│ ▶ Orientation    │ ← Badge: "Upright" / "Reversed"
│ ▶ Synthesis      │ ← "The Hermit as your challenge..."
│ ▶ Meaning Panel  │ ← 100-300 WORDS
│ ▶ Reflection     │ ← Textarea + counter
└────────┬─────────┘
         │ [CLICK ZOOM]
         ▼
┌──────────────────┐
│ CardModal.jsx    │ ★ HIGHEST DENSITY ★
├──────────────────┤
│ ▶ Full Image     │
│ ▶ Extended Text  │ ← All meanings + symbolism
│ ▶ Archetype Info │ ← Additional 200-400 words
│ ▶ Navigation     │ ← Between cards
└──────────────────┘
```

---

## Text-to-Visual Ratio by Component

```
Component              Text      Visual     Ratio
─────────────────────────────────────────────────
DeckRitual             15%       85%        Low text
SpreadTable            40%       60%        Moderate
Card (unrevealed)      10%       90%        Very low text
Card (revealed)        70%       30%        ★ Very high text ★
NarrativeSkeleton      50%       50%        Balanced
StreamingNarrative     90%       10%        ★ Very high text ★
ReadingBoard (guide)   80%       20%        High text
CardModal              75%       25%        High text
```

---

## Reduction Opportunities (Priority Order)

### 🔴 Critical (Highest Impact)

1. **Card Meaning Panels** (100-300 words × 10 cards = 2000 words)
   - **Current:** Always visible inline
   - **Proposed:** Collapse by default, expand on demand
   - **Impact:** -1500 words from screen

2. **Reflection Textareas** (every card)
   - **Current:** Always expanded with label + counter
   - **Proposed:** Single reading-level reflection, or lazy-load per card
   - **Impact:** -100 words, cleaner visual

3. **Narrative Guidance Panel** (~120 words)
   - **Current:** Collapsible but prominent
   - **Proposed:** Remove from reading view, move to onboarding only
   - **Impact:** -120 words, less clutter

---

### 🟡 High Priority (Significant Impact)

4. **Position Synthesis Text** (~12 words × 10 = 120 words)
   - **Current:** "The Hermit as your challenge..."
   - **Proposed:** Remove (meaning text already provides context)
   - **Impact:** -120 words

5. **Instructional Text** (~15 words, repeated)
   - **Current:** "Tap positions to reveal. Next: Challenge."
   - **Proposed:** Show once, then hide after first reveal
   - **Impact:** -10 words after initial reveal

6. **Character Counters** (every reflection textarea)
   - **Current:** Always visible
   - **Proposed:** Only show when >400 chars (approaching limit)
   - **Impact:** Reduced visual noise

---

### 🟢 Medium Priority (Moderate Impact)

7. **Orientation Badges** ("Upright" / "Reversed")
   - **Current:** Text badge
   - **Proposed:** Icon only (↑/↓ arrows) or remove (rotation is sufficient)
   - **Impact:** -20 words

8. **Action Button Labels**
   - **Current:** "Knock (0/3)", "Cut", "Shuffle"
   - **Proposed:** Icon + tooltip on hover (desktop), keep labels on mobile
   - **Impact:** Cleaner desktop UI

9. **"Back to spread" / "Open full card" text**
   - **Current:** Text buttons
   - **Proposed:** Icon-only with ARIA labels
   - **Impact:** -10 words

---

### 🔵 Low Priority (Polish)

10. **Status Messages** (during generation)
    - **Current:** 6 different rotating messages
    - **Proposed:** Single message + animated loader
    - **Impact:** Simplified, less reading during wait

11. **Navigation Labels** ("Prev" / "Next")
    - **Current:** Text + icons
    - **Proposed:** Icons only
    - **Impact:** Minimal, but cleaner

12. **Spread Progress Text** ("3 of 10 revealed")
    - **Current:** Text label
    - **Proposed:** Visual progress ring only
    - **Impact:** Minimap already provides this info

---

## Recommended Visual-First Redesign

### Phase 1: Collapse the Noise
- **Collapse card meanings by default** (show first 2 lines + "Read more")
- **Remove narrative guidance panel** from reading view
- **Hide character counters** until >400 chars
- **Lazy-load reflections** (button to expand per card)

**Expected reduction:** ~1700 words removed from peak load

---

### Phase 2: Icons Over Words
- **Orientation badges** → icon or remove
- **Action buttons** → icon + tooltip (desktop)
- **Navigation labels** → icon only
- **Progress indicators** → visual-only (rings/minimap)

**Expected reduction:** ~50 words, cleaner visual hierarchy

---

### Phase 3: Contextual Display
- **Instructional text** → show once, auto-hide after first interaction
- **Position synthesis** → remove (redundant with meaning)
- **AI reasoning summaries** → move to debug/advanced mode only

**Expected reduction:** ~150 words, less repeated instructions

---

## Final Density Goals

| Component | Current | Target | Reduction |
|-----------|---------|--------|-----------|
| Card (revealed) | ~200 words | ~50 words | -75% |
| Spread (10 cards) | ~2000 words | ~500 words | -75% |
| Narrative guidance | ~120 words | 0 words | -100% |
| Instructions | ~15 words | ~5 words | -67% |
| **Total Peak** | **~2150 words** | **~540 words** | **-75%** |

This would bring the reading experience from **"reference manual"** density to **"guided experience"** density, letting the visuals and AI narrative do the heavy lifting instead of inline card meanings.
