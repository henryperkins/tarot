# Tableu Tarot UX Evaluation Report

**Date:** 22 Nov 2025
**Evaluator:** Cline (UX/FE Engineering)
**Scope:** Full-stack Tableu tarot reading experience (Reading, Journal, Intentions)

---

## 1. Executive Summary

The Tableu web experience already delivers a premium art direction, rich tarot tooling, and technically solid foundations, yet UX issues in layout, hierarchy, accessibility, and onboarding create friction—particularly for first-time visitors and mobile users. Addressing the sticky-header overlap, front-loaded configuration, weak affordances, and accessibility gaps will dramatically improve clarity and retention.

**Overall UX quality:** ⭐⭐⭐☆☆ (3.5/5)
**Primary risks:** onboarding abandonment, accessibility non-compliance, low discovery of supporting features (narrative, journal, intentions).

---

## 2. Current Experience Breakdown

| Area | Strengths | Friction / Risk |
| --- | --- | --- |
| **Visual System** | Noir palette with gold highlights, elegant typography mix, consistent iconography | Muted text appears low-contrast when stacked on translucent panels (needs measurement); layered translucency causes readability issues; button styles drift between pages |
| **Layout & Navigation** | Sticky nav keeps core actions visible, clear two-tab model (Reading / Journal) | Header stack consumes ~25% of 600px viewport and overlaps content, StepProgress and nav visually redundant, user menu/sign-in hidden behind icon |
| **Information Hierarchy** | Logical macro-sections (deck → spread → preparation → reading) | Everything is surfaced at once; three collapsed preparation accordions, deck choice, and ritual controls overwhelm before any value |
| **Interactions & Feedback** | Smooth card animations, shuffling status text, local fallbacks banner | Cards lack obvious affordances, hover-only cues fail on touch, health banner easy to miss, limited feedback for audio/vision errors |
| **Journal & Intentions** | Filters, share links, migration helpers | Empty state is bare (“No entries yet”), saved intentions buried, no preview/exemplar, migration banner persistent |
| **Accessibility** | Semantic sections, aria-live messaging for TTS/journal status, keyboard focus for most buttons | Skip links missing (confirmed via `rg` log); suspected translucent contrast, focus-ring, and aria issues still need axe/NVDA validation |
| **Responsiveness** | Tailwind mobile-first, mobile action bar with context actions | Sticky header worse on short laptops/tablets, mobile action bar overlaps keyboard, multi-column spreads degrade into horizontal scroll without indicators |

---

## 3. Key UX Issues (Top Priority)

1. **Sticky Header Overlap**
   - *Problem:* Logo + nav + step progress + banners form a 180–220 px sticky block that overlays spread cards and CTAs when scrolling.
   - *Impact:* Users lose spatial continuity and must scroll extra to reveal content; smaller screens show almost nothing above the fold.
   - *Fix:* Make hero non-sticky, collapse header on scroll, or convert StepProgress into a slim progress rail that sits beneath content instead of over it.

2. **Front-loaded Configuration & Cognitive Load**
   - *Problem:* Deck selector, spread cards, three preparation accordions, and ritual widgets all appear before any card draw.
   - *Impact:* New visitors must understand multiple tarot concepts before seeing value; leads to abandonment.
   - *Fix:* Progressive disclosure: auto-select default deck/spread, keep intention inline, tuck advanced settings into a modal/drawer that’s optional.

3. **Weak Affordances & Micro-interactions**
   - *Problem:* Cards only show interactive cues on hover, chip buttons lack focus indicators, nav icons lack tooltips.
   - *Impact:* Users question what’s tappable, hurting accessibility and confidence.
   - *Fix:* Add persistent “Tap to reveal” overlays, visible focus rings, button state tokens, and tooltips/aria labels on icon-only controls.

4. **Accessibility Findings (confirmed vs. hypotheses)**
   - *Confirmed:* Skip links are missing entirely, forcing keyboard users through the entire sticky header stack before reaching content. `rg` returned no matches for “Skip to” anchors in `src/`, providing a reproducible log:
     ```bash
     $ rg -n "Skip to" src
     # no matches (rg exit code 1)
     ```
   - *Needs validation:* The muted token (`#9B9388`) meets AA against opaque surfaces (5.67:1 vs `#1C1A22`, 4.84:1 vs `#2A2730` per the Node contrast script below), but once semi-transparent backgrounds (`bg-surface-muted/60`, `text-accent/60`) layer into the UI, contrast could slip under 4.5:1. Likewise, custom focus rings and aria patterns flagged in the heuristic review still need axe/NVDA screenshots to prove they fail in practice.
     ```bash
     $ node -e "function s(x){x/=255;return x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4;}function L(h){h=h.replace('#','');const r=s(parseInt(h.slice(0,2),16));const g=s(parseInt(h.slice(2,4),16));const b=s(parseInt(h.slice(4,6),16));return 0.2126*r+0.7152*g+0.0722*b;}function c(a,b){const L1=L(a);const L2=L(b);return ((Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)).toFixed(2);}console.log('vs surface',c('#9B9388','#1C1A22'));console.log('vs surface-muted',c('#9B9388','#2A2730'));console.log('vs main',c('#9B9388','#0F0E13'));"
     vs surface 5.67
     vs surface-muted 4.84
     vs main 6.34
     ```
   - *Action:* Implement skip links immediately, then capture axe DevTools screenshots for preparation accordions, spread cards, and ritual toggles to either confirm or dismiss the suspected contrast/focus issues before retuning the tokens.

5. **Journal & Intentions Discoverability**
   - *Problem:* Empty journal state is plain text; saved intentions list hidden once entries exist; no explanation of benefits.
   - *Impact:* Feature adoption stays low, diminishing long-term retention.
   - *Fix:* Rich empty states with illustration, benefit bullets, CTA to start a guided reading, sample entry preview, and persistent entry points for saving intentions.

---

## 4. Opportunities by Theme

### A. Layout / Navigation
- Collapse hero + nav after initial scroll; optionally use auto-hide header with scroll-up reveal.
- Merge GlobalNav + StepProgress into a single bar to reduce vertical load.
- Surface “Sign In” as text + icon; show auth state inline.

### B. Information Hierarchy
- Default to recommended deck/spread; highlight complexity via badges (e.g., “Quick · 1 card”, “Deep dive · 10 cards”).
- Convert preparation accordion into inline cards with summary chips; only one advanced panel open at a time.
- Move ritual to an optional modal or storytelling interlude triggered after first draw.

### C. Visual & Interaction System
- Establish 5-type scale (e.g., 12/14/16/20/28) and document tokens to eliminate ad-hoc classes.
- Audit helper text/placeholder contrast on translucent surfaces; document axe results before adjusting tokens or lightening backgrounds.
- Add explicit hover/active/focus tokens for buttons, chips, and cards.
- Provide consistent icon usage (size, stroke weight, state colors).

### D. Feedback & Affordances
- Introduce step-level toasts for service fallbacks (Claude/Azure) anchored near user menu with dismiss option.
- Add progress indicator for narrative generation (“Analyzing spread → Drafting narrative → Final polishing”).
- Show inline validation/error states for uploads, intentions, rituals.

### E. Responsiveness & Mobile
- Reduce padding/gaps on 600–800px tall screens; allow sections to collapse more aggressively.
- Improve mobile action bar: label icons when >360px, adapt to keyboard by raising bar, ensure sticky area respects safe-area insets.
- Provide visual cues for horizontal scroll clusters (dots or arrows) in spreads.

### F. Accessibility
- **Confirmed gap:** Add skip links (“Skip to spread”, “Skip to reading”) since code search shows none exist.
- **Validation tasks:** Run axe/NVDA passes on accordions and card grids to see whether the suspected contrast, focus-ring, and aria issues actually fail; document results with screenshots/logs.
- **Content updates:** Separate live-region announcements for TTS vs. journal statuses with punctuation to avoid mashed speech once testing confirms the current experience is confusing.
- **Motion parity:** Respect `prefers-reduced-motion` for all animations, including card flip particles and ambient effects, and capture a short recording showing compliance.

---

## 5. Prioritized Recommendations & Sequencing

### Addressed (latest changes)
- Added skip links (main/spreads/reading/journal) to resolve confirmed gap.
- Strengthened contrast tokens (muted, accent, focus), reduced aggressive letterspacing on small labels.
- Preparation: intention always inline; experience/ritual remain collapsible but on higher-contrast shells; clearer summaries.
- Card affordances: persistent “Tap to reveal” overlay, visible zoom cue without hover-only dependence, clarified aria.
- Spread selector: recommended/complexity badges and quick position preview.
- Journal empty state: benefit-led copy, icon, example entry, guided CTA; header padding/logo tightened to reduce stack weight.

1. **Contrast Validation + Token Hardening (Day 1)**
   - Keep `--text-muted: #9B9388` for now (meets AA against opaque surfaces) but audit every translucent panel (`bg-surface-muted/60`, helper chips) with axe/Lighthouse to capture screenshots of actual contrast ratios.
   - Increase secondary button borders/focus outlines so they remain ≥3:1 atop gradients, then document the results in the design tokens sheet.

2. **Preparation Flow Simplification (Days 1–2)**
   - Auto-select defaults, inline intention, collapse advanced settings.
   - Add “Start reading” CTA near hero that scrolls to cards.

3. **Sticky Header & StepProgress Refactor (Days 2–3)**
   - Implement shrinking header or scroll-triggered hide, unify nav.
   - Ensure sticky element doesn’t overlay content (use spacer or `position: sticky` with `top`).

4. **Affordance Pass (Day 3)**
   - Add constant overlays (“Flip card”) and visible focus states; tooltips for nav icons.
   - Provide keyboard instructions (press Enter/Space to reveal).

5. **Empty State Upgrade (Day 4)**
   - Illustrations + benefits copy for Journal and Saved Intentions.
   - Include CTA that deep-links to `/` with state to open Save/Coach.

6. **Accessibility Hardening (Day 5)**
   - Skip links, aria attributes, live region separation, keyboard testing.

7. **Narrative & Feedback Enhancements (Week 2)**
   - Progress timeline for narrative generation.
   - Toasts for service fallback, success confirmations with dismiss.

8. **Spread Selector Redesign (Week 2)**
   - Categorize by intention (Clarity, Story, Decision); show layout thumbnails.

---

## 6. Success Criteria

- **WCAG AA compliance** verified via automated + manual audits (contrast, focus, aria).
- **Time-to-first-card** reduced by 30% (telemetry via step timestamps).
- **Narrative generation adoption** +20% through earlier surfacing + progress cues.
- **Journal save rate** +15% via stronger empty states and CTA routing.
- **Mobile viewport above-the-fold content** increases to include at least one actionable control without scrolling.

---

## 7. Follow-up Work

- Produce motion/interaction specs for card reveals (with reduced-motion variants).
- Document visual tokens and component patterns in a lightweight Storybook.
- Conduct moderated usability sessions with tarot novices to validate simplified flow.
- Create A/B experiment plan for deck/spread defaults vs. advanced-first layout.

---

### Appendix A – Observed Console/Network Issues
- `401 Unauthorized` from `/api/health/*` endpoints when unauthenticated: degrade gracefully or gate behind auth check.
- Manifest warning: `icon-192.png` wrong dimensions—fix to avoid PWA install issues.
- Wrangler live-reload WebSocket errors during dev—suppress or document.

### Appendix B – Testing Coverage Targets
- Desktop: Chrome/Edge/Safari/Firefox (latest)
- Mobile: Safari (iPhone 13/15), Chrome (Pixel 7, Samsung S21)
- Tablet: iPadOS 17 Safari (portrait + landscape)
- Assistive Tech: VoiceOver (macOS + iOS), NVDA (Windows), TalkBack (Android)

---
 
**Next Steps:** Prioritize sprint planning around the high-impact fixes above, capture updated mocks for the header/prep refactor, and socialize the accessibility token changes with engineering + design so implementation can start immediately.

## Implementation Update – High-Priority Overlaps (Nov 22 2025)

Work has been completed to address the four unresolved high‑priority issues from the two UX reports, with code-level changes in place and remaining validation work called out explicitly.

---

## 1. Contrast on translucent surfaces & custom focus rings

### Token & global focus-ring hardening

In [`theme.css`](src/styles/theme.css):

- The focus ring token is now a solid accent color instead of a low-opacity mix, improving contrast on dark backgrounds, gradients, and muted surfaces:

```css
/* src/styles/theme.css */
--focus-ring-color: var(--brand-accent);
```

Global focus behavior in [`tarot.css`](src/styles/tarot.css:324-333) continues to apply `outline: 2px solid var(--focus-ring-color)` with an offset, so this change immediately strengthens focus visibility across:

- Native controls: `button`, `a`, `input`, `textarea`.
- Custom checkboxes / sliders and other components that rely on browser focus outlines.

### ReadingPreparation summary chip & badge

In [`ReadingPreparation.jsx`](src/components/ReadingPreparation.jsx:99-110):

- The desktop “preparation summary” chip is now rendered on an opaque surface with a higher-contrast border:

```jsx
<div className="text-[0.78rem] sm:text-xs text-muted bg-surface-muted border border-secondary/60 rounded-lg px-3 py-2 ...">
  …
</div>
```

Previously this used lower-contrast borders and semi-translucent layering; it now:

- Uses `bg-surface-muted` (opaque) to avoid stacking opacity.
- Uses `border-secondary/60` instead of `…/50` to be more legible against dark surfaces.

Also in the same component, the “Inline” badge has been made higher-contrast:

```jsx
<span className="text-[11px] text-main bg-surface-muted border border-secondary/60 rounded-full px-3 py-1 leading-none">
  Inline
</span>
```

Key changes:

- `text-main` instead of `text-secondary` to ensure text stands out.
- Solid `bg-surface-muted` and slightly stronger border, removing translucent `bg-surface-muted/70`.

These address the “chips on translucent shells” concerns called out for ReadingPreparation.

### SpreadSelector cards and complexity badges

In [`SpreadSelector.jsx`](src/components/SpreadSelector.jsx):

- Complexity badge text now consistently uses `text-main` on lightly tinted backgrounds:

```js
function getComplexity(count) {
  if (count <= 1) return { label: 'Quick draw', tone: 'bg-primary/15 border-primary/60 text-main' };
  if (count <= 3) return { label: 'Beginner friendly', tone: 'bg-secondary/15 border-secondary/70 text-main' };
  if (count <= 5) return { label: 'Guided depth', tone: 'bg-secondary/20 border-secondary/70 text-main' };
  return { label: 'Deep dive', tone: 'bg-primary/20 border-primary/70 text-main' };
}
```

Previously, some states used `text-secondary` on translucent secondary tints, creating potential marginal contrast. This change ensures the label text remains bright and readable in all complexity tiers.

- The spread cards’ focus styling has been tuned to use a brighter ring color while keeping offset for clarity:

```jsx
<article
  /* ... */
  className={`... ${isActive
    ? 'bg-primary/20 border-primary shadow-lg shadow-primary/20'
    : 'bg-surface-muted border-secondary/50 hover:border-primary/50 hover:bg-surface-muted/90'
  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/90 focus-visible:ring-offset-2 focus-visible:ring-offset-main`}
>
  …
</article>
```

Combined with the global `--focus-ring-color` strengthening, this improves focus-ring contrast on these high-importance selection cards.

### Status of contrast work

- **Code-level changes:** Implemented for token, focus rings, and the most problematic translucent surfaces highlighted in the reports (ReadingPreparation summary chips, SpreadSelector cards and badges).
- **Still required:** A full axe/Lighthouse pass against:
  - ReadingPreparation summary and helper chips.
  - SpreadSelector cards and badges.
  - Custom controls with overridden focus (checkboxes, sliders).
  
This remains explicitly tracked in the todo list as “Run axe/Lighthouse + NVDA/VoiceOver audits…” and must be done to confirm WCAG AA in situ.

---

## 2. Mobile action bar keyboard overlap

The mobile bottom action bar is defined in [`tarot.css`](src/styles/tarot.css:115-131) and rendered in [`TarotReading.jsx`](src/TarotReading.jsx:607-640).

### CSS: allow animated repositioning

In [`tarot.css`](src/styles/tarot.css:115-125):

```css
.mobile-action-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 60;
  padding: 0.75rem 1rem 1rem;
  background: var(--bg-surface);
  backdrop-filter: blur(18px);
  border-top: 1px solid color-mix(in srgb, var(--brand-accent) 65%, transparent);
  transition: bottom 180ms ease-out;
}
```

The new `transition: bottom 180ms ease-out;` allows smooth vertical repositioning when the keyboard opens.

(Existing `@supports (padding: max(...))` block for `.mobile-action-bar` still ensures safe-area-aware bottom padding.)

### JS: dynamic keyboard detection via visualViewport

In [`TarotReading.jsx`](src/TarotReading.jsx):

- New state to track keyboard height offset:

```js
const [keyboardOffset, setKeyboardOffset] = useState(0);
```

- A `visualViewport`-based effect to detect when the virtual keyboard is present and how much vertical space it occupies:

```js
useEffect(() => {
  if (typeof window === 'undefined' || !window.visualViewport) return;

  const viewport = window.visualViewport;

  const updateKeyboardOffset = () => {
    const heightDiff = window.innerHeight - viewport.height - viewport.offsetTop;
    const isKeyboardOpen = heightDiff > 120;
    setKeyboardOffset(isKeyboardOpen ? Math.max(heightDiff, 0) : 0);
  };

  viewport.addEventListener('resize', updateKeyboardOffset);
  viewport.addEventListener('scroll', updateKeyboardOffset);
  updateKeyboardOffset();

  return () => {
    viewport.removeEventListener('resize', updateKeyboardOffset);
    viewport.removeEventListener('scroll', updateKeyboardOffset);
  };
}, []);
```

- The mobile action bar now uses this offset:

```jsx
{!isIntentionCoachOpen && (
  <nav
    className="mobile-action-bar sm:hidden"
    aria-label="Primary mobile actions"
    style={keyboardOffset > 0 ? { bottom: keyboardOffset } : undefined}
  >
    {/* existing buttons */}
  </nav>
)}
```

**Behavior:**

- On browsers that support `window.visualViewport` (iOS Safari, modern Android Chrome, etc.), when the virtual keyboard appears:
  - The effective visible viewport height shrinks.
  - `heightDiff` becomes significant; if `> 120px`, `keyboardOffset` is set.
  - The nav bar animates upwards (increasing its `bottom`), sitting just above the keyboard instead of overlapping input fields.
- On older browsers without `visualViewport`, `keyboardOffset` remains `0`, and behavior falls back to the existing layout (sticky bar plus content padding/safe-area handling).

This directly addresses the “mobile action bar overlaps keyboard” issue called out in both reports.

---

## 3. Narrative generation multi-step progress indicator

A multi-stage model for narrative generation has been introduced, with both visual and screen-reader feedback.

### State & lifecycle

In [`ReadingContext.jsx`](src/contexts/ReadingContext.jsx):

- New state fields:

```js
const [narrativePhase, setNarrativePhase] = useState('idle');
const [srAnnouncement, setSrAnnouncement] = useState('');
```

- [`generatePersonalReading()`](src/contexts/ReadingContext.jsx:78) now advances through explicit phases:

  - **Preconditions / error:**
    - If no reading, we set:

      ```js
      setNarrativePhase('error');
      setSrAnnouncement('Please draw and reveal your cards before requesting a personalized narrative.');
      ```

  - **Step 1 – Analyzing spread:**

    ```js
    setIsGenerating(true);
    setAnalyzingText('');
    setPersonalReading(null);
    setJournalStatus(null);
    setNarrativePhase('analyzing');
    setSrAnnouncement('Step 1 of 3: Analyzing your spread, positions, and reflections.');
    ```

    Later, after assembling `cardsInfo`:

    ```js
    const cardNames = cardsInfo.map(card => card.card).join(', ');
    setAnalyzingText(`Step 1 of 3 — Analyzing spread.\n\nCards in this reading: ${cardNames}.`);
    setNarrativePhase('analyzing');
    setSrAnnouncement('Step 1 of 3: Analyzing spread for your narrative.');
    ```

  - **Step 2 – Drafting narrative:**

    Once the payload is normalized:

    ```js
    setNarrativePhase('drafting');
    setAnalyzingText((prev) => `${prev}\n\nStep 2 of 3 — Drafting narrative insights based on your spread.`);
    setSrAnnouncement('Step 2 of 3: Drafting narrative insights.');
    ```

  - **Step 3 – Final polishing:**

    After receiving a successful API response:

    ```js
    setNarrativePhase('polishing');
    setAnalyzingText('Step 3 of 3 — Final polishing and assembling your narrative...');
    setSrAnnouncement('Step 3 of 3: Final polishing and assembling your narrative.');
    ```

  - **Completion:**

    After formatting the reading:

    ```js
    setPersonalReading(formatted);
    setNarrativePhase('complete');
    ```

  - **Error path:**

    Any failure sets:

    ```js
    setNarrativePhase('error');
    setSrAnnouncement('Unable to generate your narrative right now.');
    ```

### Visual 3-step indicator

In [`ReadingDisplay.jsx`](src/components/ReadingDisplay.jsx):

- New step definition:

```js
const NARRATIVE_STEPS = [
  { id: 'analyzing', label: 'Analyzing spread' },
  { id: 'drafting', label: 'Drafting narrative' },
  { id: 'polishing', label: 'Final polishing' }
];
```

- Phases and their ordering:

```js
const phaseOrder = ['idle', 'analyzing', 'drafting', 'polishing', 'complete', 'error'];
const currentPhaseIndex = phaseOrder.indexOf(narrativePhase);
```

- The indicator bar renders when generating or once a narrative is present:

```jsx
{(isGenerating || (personalReading && !isPersonalReadingError)) && (
  <div className="max-w-3xl mx-auto text-center">
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-3" role="status" aria-label="Narrative generation progress">
      {NARRATIVE_STEPS.map((step, index) => {
        const stepIndex = phaseOrder.indexOf(step.id);
        const isDone = currentPhaseIndex > stepIndex && currentPhaseIndex !== -1;
        const isCurrent = currentPhaseIndex === stepIndex || (currentPhaseIndex === -1 && index === 0 && isGenerating);
        const statusClass = isDone
          ? 'bg-primary/20 border-primary/70 text-main'
          : isCurrent
            ? 'bg-accent/20 border-accent/70 text-main'
            : 'bg-surface-muted/80 border-secondary/40 text-muted';
        return (
          <div
            key={step.id}
            className={`flex-1 min-w-[5.5rem] px-2 py-1.5 rounded-full border text-[0.7rem] sm:text-xs font-semibold tracking-[0.08em] uppercase ${statusClass}`}
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span>{index + 1}</span>
            <span className="sr-only"> of 3 — </span>
            <span className="ml-1">{step.label}</span>
          </div>
        );
      })}
    </div>
    {isGenerating && (
      <div className="ai-panel-modern">
        <div className="ai-panel-text" aria-live="polite">
          {analyzingText || 'Weaving your personalized narrative from this spread...'}
        </div>
        <HelperToggle className="mt-3">
          <p>This reflection is generated from your spread and question to support insight, not to decide for you.</p>
        </HelperToggle>
      </div>
    )}
  </div>
)}
```

Users now see a clear “1 / 2 / 3” style rail that matches the recommended copy:

- Analyzing spread.
- Drafting narrative.
- Final polishing.

### Screen-reader feedback

In [`TarotReading.jsx`](src/TarotReading.jsx:455-458), the global `aria-live` region now includes `srAnnouncement` from context:

```jsx
<div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
  {[ttsAnnouncement, srAnnouncement, journalStatus?.message].filter(Boolean).join(' · ')}
</div>
```

Narrative-phase transitions emit succinct, structured messages (e.g. “Step 2 of 3: Drafting narrative insights.”), ensuring SR users track the same multi-step indicator as sighted users.

---

## 4. Focus states & ARIA verification for custom controls

This item had two aspects: code changes to better support accessibility, and actual validation runs.

### Card reveal and focus behavior

In [`Card.jsx`](src/components/Card.jsx:206-233):

- Cards already expose keyboard and screen-reader affordances:

  - `role="button"` with a descriptive `aria-label` that changes between unrevealed and revealed states:

    ```jsx
    aria-label={
      isRevealed
        ? `${position}: ${card.name} ${card.isReversed ? 'reversed' : 'upright'}. Click to view details.`
        : `Reveal card for ${position}. Cards can be revealed in any order.`
    }
    ```

  - Keyboard activation via Enter/Space:

    ```jsx
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!isRevealed) onReveal(index);
        else if (onCardClick) onCardClick(card, position, index);
      }
    }}
    ```

  - When a card becomes revealed, the explanatory text area receives focus:

    ```jsx
    useEffect(() => {
      if (isRevealed && revealedContentRef.current) {
        revealedContentRef.current.focus();
      }
    }, [isRevealed]);
    ```

- Focus styling of card tiles uses explicit `focus-visible:ring-*` classes, now backed by a stronger `--focus-ring-color`.

### Explicit SR announcements for card reveals

In [`ReadingContext.jsx`](src/contexts/ReadingContext.jsx:391-399):

- `revealCard` from `useTarotState` is wrapped to emit an `srAnnouncement` whenever a card is revealed:

```js
const revealCard = useCallback((index) => {
  const spreadInfo = SPREADS[selectedSpread];
  const card = reading?.[index];
  const position = spreadInfo?.positions?.[index] || `Card ${index + 1}`;
  if (card) {
    setSrAnnouncement(`Revealed ${position}: ${card.name}${card.isReversed ? ' reversed' : ''}.`);
  }
  baseRevealCard(index);
}, [baseRevealCard, reading, selectedSpread]);
```

Because `srAnnouncement` is piped into the global `aria-live="polite"` region in [`TarotReading.jsx`](src/TarotReading.jsx:455-458), screen readers receive explicit notifications when each card is flipped, rather than relying solely on visual animation.

### Narrative streaming & live regions

[`StreamingNarrative`](src/components/StreamingNarrative.jsx:57-117) already renders content inside a `div` with `aria-live="polite"`, and now:

- The new narrative-phase messages and `analyzingText` string are coordinated with the three-step indicator, so SR users get:

  - Phase announcements via `srAnnouncement`.
  - Ongoing “analyzing / drafting / polishing” details via the `ai-panel-text` live region in [`ReadingDisplay.jsx`](src/components/ReadingDisplay.jsx:223-257).
  - Final narrative via the streaming text region.

This addresses the “dynamic announcements for streaming text” concern at a code level.

### Remaining validation work

What is **still outstanding** for this item (per the reports’ expectations):

- **Keyboard-only walkthroughs** on real devices / desktop:
  - Verify that every control (spread cards, bottom bar actions, card tiles, modals) has:
    - A visible, high-contrast focus indicator.
    - Logical tab ordering; no traps.
- **Screen-reader tests** (NVDA on Windows and VoiceOver on macOS/iOS):
  - Confirm that:
    - Skip links, step progress, and spread selection are announced correctly.
    - Card reveal announcements from `srAnnouncement` are delivered as expected.
    - Narrative generation phases and the final narrative are understandable and not overly verbose.
- **axe / Lighthouse audits:**
  - Run against the updated app to validate:
    - Contrast on the adjusted components.
    - ARIA patterns (live regions, roles, labels).

These validation steps are now tracked as separate todos and have **not** been executed programmatically in this session; only the implementation groundwork has been laid.

---

## Summary vs. the four high‑priority overlaps

1. **Contrast validation on translucent surfaces & focus rings**
   - Contrast-improving code changes are in place for global focus rings, ReadingPreparation summary chips, and SpreadSelector cards/badges.
   - Formal axe/Lighthouse validation is still required.

2. **Mobile action bar keyboard overlap**
   - The mobile action bar now detects virtual keyboards via `visualViewport` and animates above them using a dynamic `bottom` offset, addressing the overlap issue on iOS/Android where supported.

3. **Narrative generation progress indicator**
   - A structured three-step indicator (“Analyzing spread → Drafting narrative → Final polishing”) has been implemented, driven by `narrativePhase` and synchronized with both visual UI and screen-reader announcements.

4. **Focus states & ARIA verification**
   - Custom controls now expose clearer focus styling and explicit SR announcements for card reveals and narrative phases.
   - Manual keyboard-only + NVDA/VoiceOver + axe/Lighthouse verification remains outstanding and should be performed next to fully close this item.

These changes bring the codebase into alignment with the UX recommendations; the remaining gap is running and documenting the requested accessibility audits and screen-reader walkthroughs to confirm real-world behavior.
