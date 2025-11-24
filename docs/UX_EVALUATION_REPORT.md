# Tableu Tarot Reading Application - UX Evaluation Report

**Date:** November 22, 2025
**Evaluator:** UX Analysis Team
**Application:** Tableu - Tarot Reading Web Application

---

## Executive Summary

Tableu is a sophisticated tarot reading web application with a polished dark theme, elegant typography, and thoughtful interactions. The application demonstrates strong technical execution with smooth animations, responsive layouts, and accessibility considerations. However, several usability friction points, information hierarchy issues, and visual design inconsistencies present opportunities for significant UX improvements.

**Overall UX Score: 7.5/10**

### Key Strengths
- Elegant, cohesive dark mystic theme with warm gold accents
- Smooth, intentional animations that enhance the mystical experience
- Comprehensive responsive design with mobile-first approach
- Strong accessibility foundation (ARIA labels, keyboard navigation, focus states)
- Well-structured information architecture

### Key Opportunities
- Simplify cognitive load in preparation phase (too many collapsed sections)
- Improve visual hierarchy and contrast in critical UI elements
- Enhance onboarding and guidance for first-time users
- Reduce friction in mobile navigation patterns
- Clarify card interaction affordances

---

## 1. Visual Design Analysis

### 1.1 Color Palette & Theme

**Strengths:**
- **Cohesive Color System:** The elegant minimal palette with warm charcoal (`#0F0E13`), champagne gold (`#D4B896`), and muted accents creates a sophisticated mystical atmosphere
- **Semantic Color Tokens:** Well-organized CSS variables for backgrounds, text, and brand colors enable consistent theming
- **Suit-Specific Accents:** Thoughtful color coding for Minor Arcana suits (wands: gold, cups: silver-blue, swords: steel gray, pentacles: sage)

**Issues:**

1. **Potential Contrast Drift in Secondary Elements**
   - **Location:** [`src/styles/theme.css:52`](src/styles/theme.css:52)
   - **Fact Check:** The core token `--text-muted: #9B9388` on `--bg-surface: #1C1A22` actually yields **5.67:1** contrast (computed via the repo’s Node script), so the base palette satisfies WCAG AA.
   - **Problem:** When that token is combined with translucent backgrounds (`bg-surface-muted/60`, `bg-surface-muted/70`) or additional opacity, the rendered contrast can dip below AA.
   - **Affected Components:**
     * [`ReadingPreparation.jsx:102`](src/components/ReadingPreparation.jsx:102) - "Capture an intention..." helper text layered on `bg-surface-muted/60`
     * [`GlobalNav.jsx:17`](src/components/GlobalNav.jsx:17) - Inactive nav button text with `text-muted` over semi-transparent pills
     * [`SpreadSelector.jsx:158-159`](src/components/SpreadSelector.jsx:158-159) - Card count and description text on translucent cards
   - **Code Example:**
   ```css
   /* src/styles/theme.css:52 */
   --text-muted: #9B9388;  /* 5.67:1 vs --bg-surface before translucency is applied */
   ```

2. **Overuse of Opacity Creating Visual Uncertainty**
   - **Location:** Throughout components, particularly [`ReadingPreparation.jsx:104`](src/components/ReadingPreparation.jsx:104) and [`SpreadSelector.jsx:135`](src/components/SpreadSelector.jsx:135)
   - **Problem:** Layered transparencies compound readability issues
   - **Examples:**
   ```jsx
   /* ReadingPreparation.jsx:104 */
   className="...bg-surface-muted/60 border border-accent/20..."

   /* SpreadSelector.jsx:135 */
   className="...bg-surface-muted/70 border-secondary/30..."

   /* src/styles/tarot.css:47 */
   opacity: 0.98;  /* Mobile action bar - unnecessary precision */
   ```

3. **Inconsistent Accent Application**
   - **Location:** [`src/styles/theme.css:58-63`](src/styles/theme.css:58-63)
   - **Problem:** Three similar gold tokens reduce semantic clarity
   ```css
   /* src/styles/theme.css:58-63 */
   --brand-primary: #D4B896;    /* Champagne gold */
   --brand-secondary: #92887D;  /* Warm brown-gray */
   --brand-accent: #D4B896;     /* Same as primary! */
   ```
   - **Impact:** Interactive buttons in [`GlobalNav.jsx:25`](src/components/GlobalNav.jsx:25) use same color as decorative text in [`Header.jsx:15`](src/components/Header.jsx:15)

### 1.2 Typography

**Strengths:**
- **Hierarchy Established:** Clear distinction between serif (headings, card names) and sans-serif (body text)
- **Readable Base Sizes:** `clamp()` functions ensure responsive text scaling
- **Font Loading:** System fonts provide instant rendering

**Issues:**
1. **Inconsistent Size Scale**
   - Mix of `text-xs`, `text-xs-plus`, `text-sm`, `text-base` creates 7+ type sizes
   - The custom `text-xs-plus: 0.8125rem` adds unnecessary complexity
   - No clear typographic rhythm or modular scale

2. **Letter-Spacing Overuse**
   - `tracking-[0.18em]` on uppercase labels creates readability issues on mobile
   - Excessive letterspacing makes scanning harder, particularly in condensed mobile views

3. **Line Height Not Optimized**
   - Default Tailwind line heights don't account for the decorative font choices
   - Card descriptions could benefit from tighter leading

### 1.3 Spacing & Layout

**Strengths:**
- **Generous Whitespace:** Good breathing room between major sections
- **Responsive Padding:** Smart use of `px-4 sm:px-6` for mobile-first spacing
- **Safe Area Support:** Proper handling of notched devices with `env(safe-area-inset-bottom)`

**Issues:**
1. **Inconsistent Gap Patterns**
   - Mix of `gap-2`, `gap-3`, `gap-4`, `gap-6` without clear system
   - Some sections use `space-y-6`, others use explicit margins
   - Creates subtle visual rhythm breaks

2. **Mobile Padding Too Aggressive**
   - Some cards have excessive padding that reduces usable screen space
   - Celtic Cross cards become too small on narrow viewports despite 85vw allocation

3. **Z-Index Conflicts**
   - Multiple competing layers (`z-30`, `z-50`, `z-60`, `z-70`) suggest layering issues
   - Global nav at `z-30` can be obscured by modals at `z-60`

### 1.4 Iconography

**Strengths:**
- **Phosphor Icons:** Consistent, professional icon library
- **Semantic Sizing:** `ICON_SIZES` constant promotes size consistency
- **Decorative Icons:** Appropriate use of `decorative` prop for accessibility

**Issues:**
1. **Icon-Text Balance**
   - Some buttons have large icons with small text creating visual imbalance
   - Mobile action bar icons at 20px feel cramped against 13-14px text

2. **Missing Icon States**
   - No visual difference between enabled/disabled icon states beyond opacity
   - Hover states on icons not consistently implemented

---

## 2. Navigation & Information Hierarchy

### 2.1 Global Navigation

**Current Implementation:**
- Pill-style navigation with "Reading" and "Journal" tabs
- Persistent sticky header with UserMenu in top-right
- Step progress indicator below main nav

**Strengths:**
- Clear two-section structure
- Active state clearly indicated with `bg-primary` and shadow
- Keyboard accessible with proper ARIA labels

**Issues:**
1. **Navigation Prominence**
   - Navigation pills at `text-xs-plus` are too small for primary navigation
   - Only 2 items in nav—could be larger and more prominent
   - Surrounded by busy header creates visual competition

2. **UserMenu Placement**
   - Top-right corner is standard but creates awkward empty space on left
   - Sign In button not immediately discoverable for new users
   - No indication of authentication status until hover/click

3. **Back Button Pattern**
   - Journal page has "Back to Reading" in top-left while global nav exists
   - Creates confusion about navigation hierarchy
   - Redundant with global nav

### 2.2 Step Progress Component

**Strengths:**
- Visual indicator of reading flow progress
- Clickable steps allow non-linear navigation
- Responsive: shows numbers on mobile, labels on desktop
- Hover tooltips provide context

**Issues:**
1. **Cognitive Overhead**
   - 4 steps (Spread, Question, Ritual, Reading) require understanding upfront
   - "Ritual (optional)" label suggests skippable but takes up nav space
   - New users don't understand what each step entails

2. **Active State Confusion**
   - Active step uses `bg-secondary/15` which is visually subtle
   - Inactive steps at `bg-surface/70` are too similar
   - Hard to determine current location at a glance

3. **Mobile Horizontal Scroll**
   - On narrow viewports, 4 items create cramped horizontal scroll
   - `snap-x` helps but still feels constrained
   - Number-only labels on mobile lose semantic meaning

### 2.3 Information Hierarchy

**Page-Level Structure:**

Reading Page Flow:
```
1. Logo & Tagline
2. Global Nav + UserMenu
3. Step Progress
4. Step Indicator Label ("Choose your spread")
5. Deck Selector
6. Spread Selector
7. Preparation Sections (collapsed accordions)
8. Jump Link ("Ready? Jump to draw cards")
9. Reading Display Area
```

**Issues:**

1. **Header Consumes 180px+ on Mobile**
   - **Problem:** Stacked navigation layers push content below fold
   - **Breakdown:**
     * [`Header.jsx:6-16`](src/components/Header.jsx:6-16) - Logo + tagline: ~120px with margins
     * [`GlobalNav.jsx:20-41`](src/components/GlobalNav.jsx:20-41) - Navigation pills: ~44px
     * [`StepProgress.jsx:16-50`](src/components/StepProgress.jsx:16-50) - Step indicators: ~48px
     * Status messages: variable height
     * **Total:** ~180-220px (22-27% of 800px iPhone viewport)

2. **Three Collapsed Preparation Sections**
   - **Location:** [`ReadingPreparation.jsx:99-130`](src/components/ReadingPreparation.jsx:99-130)
   - **Problem:** Three accordion sections (Intention, Experience, Ritual) create decision paralysis
   - **Code:**
   ```jsx
   /* ReadingPreparation.jsx:112 */
   {(['intention', 'experience', 'ritual']).map(section => (
     <div key={section} className="rounded-xl border border-accent/20 bg-surface-muted/70 overflow-hidden">
       <button type="button" onClick={() => togglePrepareSection(section)} className="w-full flex items-center justify-between px-4 py-3 text-left" aria-expanded={prepareSectionsOpen[section]}>
   ```
   - **Evidence of friction:** [`ReadingDisplay.jsx:108-113`](src/components/ReadingDisplay.jsx:108-113) - "Draw cards" button is primary CTA but hidden until scroll

3. **Spread Selector Cards Too Uniform**
   - **Location:** [`SpreadSelector.jsx:120-179`](src/components/SpreadSelector.jsx:120-179)
   - **Problem:** All spread cards use identical styling except for selected state
   - **Code:**
   ```jsx
   /* SpreadSelector.jsx:133-136 */
   className={`relative flex flex-col justify-between rounded-2xl border-2 px-3 py-3 sm:px-4 cursor-pointer select-none transition basis-[78%] shrink-0 snap-center sm:basis-auto ${isActive
     ? 'bg-primary/15 border-primary shadow-lg shadow-primary/20'
     : 'bg-surface-muted/70 border-secondary/30 hover:border-primary/50 hover:bg-surface-muted/90'
   }`}
   ```
   - **Missing:** No visual hierarchy for complexity levels, no recommended/popular indicators, no layout thumbnails

4. **Empty Journal State**
   - **Location:** [`Journal.jsx`](src/components/Journal.jsx) (empty state section - approximate line 200-220)
   - **Code:**
   ```jsx
   <p className="text-muted">No entries yet. Save a reading to start your journal.</p>
   <button>Start a reading</button>
   ```
   - **Missing:** Benefits explanation, illustration, example entry, or tour link

---

## 3. User Flow Analysis

### 3.1 First-Time User Experience

**Current Flow:**
1. Land on page → see logo, nav, deck selector, spreads
2. Must choose deck style (3 options with descriptions)
3. Must choose spread (5+ options with position details)
4. Can set intention (optional, in collapsed section)
5. Can adjust preferences (optional, in collapsed section)
6. Can perform ritual (optional, in collapsed section)
7. Draw cards → reveal cards → view reading

**Issues:**
1. **No Onboarding**
   - No tutorial, tour, or first-run experience
   - Users must understand tarot terminology
   - No explanation of what "spread" means
   - Deck choice feels premature—why does it matter?

2. **Decision Fatigue**
   - 3 immediate decisions before any value delivery
   - Deck selector requires reading 3 descriptions
   - Spread selector requires understanding 5+ layouts
   - Optional sections create "should I?" anxiety

3. **Delayed Gratification**
   - Must make ~5 choices before seeing any cards
   - "Draw cards" button only appears after all setup
   - High drop-off risk for curious visitors

**Recommended Flow:**
1. **Land → Immediate Demo**
   - Show example reading or quick tutorial
   - "Try it now" button with sensible defaults
   - Progressive disclosure of options

2. **Guided Path for First Reading**
   - "Let's draw your first card" approach
   - Explain choices in context
   - Allow customization after initial success

### 3.2 Reading Creation Flow

**Current Experience:**
- Choose spread → Set intention → Optional ritual → Draw → Reveal → Read → Generate narrative → Save

**Strengths:**
- Logical progression through reading stages
- Flexibility to skip ritual steps
- Can reveal cards in any order (good!)

**Issues:**
1. **Ritual Ceremony Friction**
   - Knock/cut ritual feels disconnected from digital experience
   - "Skip ritual" suggestion implies it's burdensome
   - No explanation of why ritual matters
   - Could be reimagined as digital experience or removed

2. **Card Reveal Pattern Unclear**
   - Face-down cards show logo but no position label until revealed
   - "Tap to cut the veil" poetry is beautiful but vague
   - No indication that reveals can be random vs. sequential
   - DeckPile component suggests sequential but reading allows random

3. **Narrative Generation Delay**
   - "Create Personal Narrative" button only appears after all cards revealed
   - Users don't know narrative exists until late in flow
   - "Weaving..." text appears but no progress indicator
   - Analyzing text changes but not structured as steps

4. **Reflection Input Timing**
   - Text areas appear immediately on card reveal
   - Interrupts flow of exploring spread
   - Could be moved to post-reveal reflection phase

### 3.3 Journal Experience

**Strengths:**
- Clean layout with filters
- Entry cards show key metadata
- Share functionality integrated

**Issues:**
1. **Empty State Weak**
   - "No entries yet. Save a reading to start your journal."
   - Doesn't explain benefits or use cases
   - "Start a reading" button sends back to main page (expected but abrupt)

2. **Filter Discoverability**
   - Filters collapsed by default
   - No indication of active filters
   - Can't tell if 0 results means empty or filtered out

3. **Entry Card Hierarchy**
   - All metadata shown at once (date, spread, deck, context)
   - Personal narrative not previewed
   - Reflection notes not highlighted

4. **Migration Banner Persistence**
   - Local storage migration message shown every time
   - Should dismiss permanently or show once

---

## 4. Responsive Design & Accessibility

### 4.1 Mobile Responsiveness

**Strengths:**
- Mobile-first Tailwind approach
- Breakpoints well-planned: `xs: 375px`, `sm: 640px`, `md: 768px`, etc.
- Celtic Cross grid adapts: carousel → 2-col → 3-col → 4-col
- Touch targets generally 44px+ (WCAG AAA)
- `touch-action: manipulation` on sliders prevents zoom issues

**Issues:**
1. **Mobile Action Bar Overlaps**
   - Fixed bottom bar at 60-80px height
   - Covers content when keyboard opens
   - `pb-28` padding sometimes insufficient with keyboard

2. **Horizontal Scrolling**
   - Celtic Cross carousel nice but hides content
   - No visual indicator of off-screen cards
   - Easy to miss cards without exploring

3. **Modal Sizing**
   - Card modal on mobile takes full screen (good)
   - But exit button in corner hard to reach
   - No swipe-to-dismiss gesture

4. **Text Input on Mobile**
   - Reflection textareas trigger zoom on focus (iOS)
   - Need `font-size: 16px` minimum to prevent zoom
   - Currently using `text-sm` which is ~14px

5. **Settings Drawer**
   - MobileSettingsDrawer appears on gear icon
   - Contains all preparation sections
   - No indication it exists (gear icon alone)
   - Could use "Settings" label on larger mobile

### 4.2 Accessibility Evaluation

**Strengths:**
1. **Semantic HTML**
   - Proper heading hierarchy (`h1`, `h2`, `h3`)
   - Landmarks: `<nav>`, `<main>`, `<section>`
   - Lists for spread options

2. **ARIA Implementation**
   - `aria-label` on icon-only buttons
   - `aria-current="page"` on active nav
   - `aria-live="polite"` for dynamic status messages
   - `aria-expanded` on collapsed sections (implied via framework)

3. **Keyboard Navigation**
   - Tab order logical
   - Focus visible with ring (`focus-visible:ring-2`)
   - Cards keyboard activatable
   - Modal trappable (can be tested)

4. **Screen Reader Considerations**
   - Icons marked decorative appropriately
   - Image alt text includes reversed state
   - SR-only text for visual-only elements

**Verified accessibility issues**

1. **Skip links missing**
   - No skip navigation is rendered ahead of the stacked header, so keyboard users must tab through the logo, nav pills, and progress chips before reaching content.
   - **Proof:** `rg` returned no matches for common “Skip to…” anchors anywhere in `src/`.
   ```bash
   $ rg -n "Skip to" src
   # no results (rg exited 1)
   ```
   - **Action:** Add an always-present skip link before the header container that targets `#main-content`, plus a secondary link that jumps directly to the spread grid when cards are available.

**Hypotheses / needs validation**

- **Muted text contrast on translucent panels**
  - Base tokens meet AA (`5.67:1` vs `--bg-surface`, `4.84:1` vs `--bg-surface-muted`), but Tailwind classes such as `bg-surface-muted/60` and `text-accent/60` introduce transparency that could degrade contrast once rendered.
  - **Next step:** Use axe or APCA tooling against helper chips (`ReadingPreparation`) and spread descriptions to capture whether the layered surfaces actually fall below AA.

- **Focus indicator parity on custom controls**
  - Custom checkboxes and card tiles override native focus styling (`src/styles/tarot.css:596-638`). We have not yet confirmed that the resulting rings hit 3:1 contrast against gradients.
  - **Next step:** Record a keyboard-only walkthrough or axe screenshot showing whether the outline remains perceivable.

- **Dynamic announcements for card reveals / streaming text**
  - `StreamingNarrative` uses `aria-live="polite"`, but card reveals rely solely on animation (`Card.jsx:148-193`). Screen-reader output has not been tested.
  - **Next step:** Capture an NVDA/VoiceOver log to confirm whether users get notified when `onReveal` fires; add an explicit live region if not.

- **Form label clarity & toggle associations**
  - Some toggles rely on proximity rather than explicit `for`/`id` pairs. This is inferred from code review only.
  - **Next step:** Validate with browser devtools or axe to identify the exact controls missing programmatic labels.

- **Prefers-reduced-motion coverage**
  - Card flips gate on the media query, but other effects (particle bursts, modal transitions) may not.
  - **Next step:** Test with system-level reduced-motion enabled and document any components that keep animating so they can be wrapped in the same guard.

---

## 5. Usability Issues & Friction Points

### 5.1 Critical Issues (High Priority)

#### Issue 1: Preparation Phase Overwhelming
**Problem:** Three collapsed accordion sections create decision paralysis.

**User Impact:**
- New users unsure what's required vs. optional
- Cognitive load high before any value delivery
- Summary text when collapsed still clutters view

**Evidence:**
- "Jump to draw cards" link exists—suggests users want to skip
- All three sections marked "optional" in code but feel required
- Code comment: "Keeping internal logic simple for now"

**Recommendation:**
- **Phase 1:** Reduce to single preparation section with tabs or steps
- **Phase 2:** Make intention input inline, not collapsed
- **Phase 3:** Move deck/reversal preferences to settings, not main flow
- **Phase 4:** Remove or reimagine ritual steps (very niche)

#### Issue 2: Card Interaction Unclear
**Problem:** Cards don't clearly indicate they're interactive or what interaction does.

**User Impact:**
- Users may not realize cards can be clicked
- Revealed cards have zoom icon but only on hover (desktop)
- "Tap to cut the veil" is poetic but vague
- No indication random reveal is possible

**Evidence:**
```jsx
// Hover-only zoom indicator
<div className="absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100">
```

**Recommendation:**
- Show click affordance always, not just on hover
- Add tap target outline or button styling to unrevealed cards
- Clarify that cards can be revealed in any order (if intended)
- Consider click-to-flip animation that shows interactivity

#### Issue 3: Navigation Header Too Heavy
**Problem:** Sticky header consumes 180px+ on mobile, pushing content below fold.

**User Impact:**
- Less visible content per screen
- Must scroll to see primary actions
- Feels cramped, especially during reading

**Evidence:**
- Logo: 120px + margin
- Global Nav: 44px
- Step Progress: 48px
- Status messages: variable
- Total: ~180-220px (22-27% of iPhone viewport)

**Recommendation:**
- **Option A:** Make header collapse on scroll (show only on scroll-up)
- **Option B:** Reduce logo size on scroll
- **Option C:** Combine global nav and step progress into one component
- **Option D:** Make step progress non-sticky (only nav sticky)

### 5.2 Moderate Issues (Medium Priority)

#### Issue 4: Empty States Uninspiring
**Problem:** Empty journal doesn't explain value or encourage action.

**Location:** [`Journal.jsx`](src/components/Journal.jsx) (empty state section, approximate lines 200-230)

**User Impact:**
- Missed opportunity to explain journaling benefits
- No visual interest to draw attention
- Return visitors see same empty state if they haven't saved readings
- Doesn't communicate the value proposition of journal feature

**Evidence:**
```jsx
/* Journal.jsx - Current empty state (simplified) */
<div className="text-center py-16 px-4">
  <p className="text-muted text-lg">No entries yet. Save a reading to start your journal.</p>
  <button onClick={() => navigate('/')} className="mt-4...">
    Start a reading
  </button>
</div>
```

**Missing Elements:**
- No illustration or icon
- No explanation of benefits (pattern tracking, growth over time, deeper reflection)
- No example entry preview
- No tour or demo link
- Generic copy doesn't inspire action

**Recommendation:**
- **Phase 1:** Add illustration (consider Phosphor `BookOpen`, `Notebook`, or `ChartLine` icon at large size)
- **Phase 2:** Rewrite copy to emphasize benefits:
  ```jsx
  <h2>Your Tarot Journal</h2>
  <p>Track patterns across readings, revisit past insights, and watch your understanding deepen over time.</p>
  <ul>
    <li>📊 Discover recurring cards and themes</li>
    <li>📝 Add personal reflections and notes</li>
    <li>🔍 Search and filter your reading history</li>
  </ul>
  ```
- **Phase 3:** Add "See example entry" button that shows demo journal entry
- **Phase 4:** Include testimonial or quote about journaling value

#### Issue 5: Voice/Audio Controls Confusing
**Problem:** Multiple audio-related controls with unclear relationships.

**User Impact:**
- "Voice: On/Off" toggle vs. "Read this aloud" button
- Ambience vs. Voice separate but related
- "Enable voice & play" prompt appears unexpectedly

**Recommendation:**
- Consolidate audio settings into one control panel
- Clarify that Voice enables TTS, Ambience is background sound
- Show audio player controls inline when active
- Persist audio preferences more clearly

#### Issue 6: Spread Selection Uniform
**Problem:** All spread cards look identical except icon—hard to differentiate quickly.

**User Impact:**
- Users must read each card fully to understand
- Can't scan quickly to find desired spread
- Visual hierarchy doesn't guide to popular/beginner options

**Recommendation:**
- Add visual differentiation (color accent per spread complexity?)
- Mark recommended/popular spreads
- Show thumbnail of spread layout pattern
- Group by complexity or purpose (Quick, Deep, Relationship, etc.)

### 5.3 Minor Issues (Low Priority)

#### Issue 7: Button Text Truncation
**Problem:** Responsive text using `<span className="hidden xs:inline">` creates many variants.

**Evidence:**
```jsx
<span className="hidden xs:inline">Save this narrative to your journal</span>
<span className="xs:hidden">Save to journal</span>
```

**Recommendation:**
- Use CSS `text-overflow: ellipsis` where appropriate
- Reduce number of text variants per button
- Consider icon-only buttons with tooltips for tight spaces

#### Issue 8: Success Messages Disappear
**Problem:** Status messages auto-dismiss after 5 seconds.

**Impact:**
- Users may miss confirmation
- No way to verify action completed if interrupted

**Recommendation:**
- Add dismiss button so users control timing
- Keep success state visible until next action
- Log to notification center for later reference

#### Issue 9: Inconsistent "Card" Terminology
**Problem:** "Cards" refers to both tarot cards and UI cards (containers).

**Impact:**
- Mild confusion in documentation and labels
- Code comments sometimes ambiguous

**Recommendation:**
- Use "Tarot Cards" vs. "Card Components" in code
- Consider renaming UI pattern to "Panel" or "Surface"

---

## 6. Recommendations Summary

### 6.1 High-Impact Quick Wins (1-2 days)

1. **Validate Text Contrast in Context**
   - Keep the current `--text-muted: #9B9388` token (5.67:1 vs `--bg-surface`) but audit every surface that layers additional opacity (`bg-surface-muted/60`, `text-accent/60`) to ensure AA remains >4.5:1.
   - Increase secondary button border opacity from 20% to 60% so focus rings and outlines clear the 3:1 contrast threshold even when placed over gradients.
   - Capture axe or Lighthouse screenshots for helper chips, spread cards, and preparation summaries to document pass/fail status.

2. **Simplify Preparation Sections**
   - Make intention input always visible (not collapsed)
   - Move experience preferences to settings/modal
   - Add "Skip preparation" button if optional

3. **Improve Card Affordances**
   - Add persistent "Tap to reveal" button/overlay on cards
   - Show zoom icon without hover requirement
   - Clarify reveal order flexibility

4. **Enhance Empty States**
   - Add illustration to empty journal
   - Write compelling benefit-focused copy
   - Include example or tour link

5. **Add Skip Links**
   - Implement "Skip to reading" link
   - Add "Skip to cards" after navigation

### 6.2 Medium-Impact Improvements (3-5 days)

6. **Consolidate Header**
   - Implement collapsing header on scroll
   - Reduce logo size when scrolled
   - Combine nav elements to reduce height

7. **Redesign Spread Selector**
   - Add visual differentiation between spreads
   - Group by complexity or category
   - Show layout thumbnails

8. **Improve Mobile Action Bar**
   - Add labels to icon-only buttons on wider mobile
   - Implement smarter keyboard avoidance
   - Add context-aware button states

9. **Enhance Card Modal**
   - Add swipe-to-dismiss gesture
   - Improve close button accessibility
   - Consider split-view on tablets

10. **Refine Typography Scale**
    - Establish 5-6 size scale (not 8+)
    - Remove custom `text-xs-plus`
    - Document type system in design tokens

### 6.3 Strategic Initiatives (1-2 weeks)

11. **Build Onboarding Flow**
    - Create first-run tutorial (optional)
    - Offer "Try it now" with defaults
    - Progressive feature disclosure

12. **Reimagine Ritual Experience**
    - Either make digital and meaningful
    - Or remove and simplify flow
    - Don't half-commit to skippable ceremony

13. **Improve Narrative Experience**
    - Show progress during generation
    - Preview capability earlier in flow
    - Add save prompts during reading

14. **Enhance Journal Features**
    - Add search within entries
    - Show pattern insights over time
    - Implement tagging/categorization

15. **Accessibility Audit**
    - Run axe DevTools on all pages
    - Test with screen readers (NVDA, VoiceOver)
    - Fix all WCAG AA violations
    - Document keyboard shortcuts

### 6.4 Long-Term Enhancements

16. **Design System Documentation**
    - Document color system with contrast ratios
    - Create component library with variants
    - Establish spacing/sizing tokens
    - Build Storybook or pattern library

17. **Performance Optimization**
    - Lazy load images with proper placeholders
    - Reduce animation complexity on low-end devices
    - Implement service worker for offline experience

18. **Advanced Features**
    - Comparison view for multiple readings
    - Guided interpretation assistant
    - Community features (if desired)
    - Reading reminders/scheduling

---

## 7. Prioritized Action Plan

### Addressed (latest changes)
- Added skip links to main, spreads, and reading sections for keyboard users.
- Strengthened contrast tokens (`--text-muted`, accent/focus) and focus rings; reduced letterspacing on small labels.
- Inline intention field (no accordion) with clearer prep summaries; higher-contrast prep shells.
- Card affordances: persistent “Tap to reveal” overlay, clearer aria copy, always-visible zoom cue, 16px reflections textarea.
- Spread selector: recommended/complexity badges and small layout position preview.
- Journal empty state: benefit-focused copy, icon, example entry, and guided-reading CTA.
- Header density trimmed (smaller logo/tagline, tighter sticky bar padding/shadow); skip links added above.

### Sprint 1: Critical UX Fixes (Week 1)
- [ ] Increase text contrast (Issue #1)
- [ ] Simplify preparation UI (Issue #1)
- [ ] Improve card interaction clarity (Issue #2)
- [ ] Add skip navigation links
- [ ] Enhance empty states (Issue #4)

**Expected Impact:** Immediate improvement in usability, accessibility, and first-time user success.

### Sprint 2: Navigation & Layout (Week 2)
- [ ] Implement collapsing header
- [ ] Consolidate audio controls (Issue #5)
- [ ] Redesign spread selector (Issue #6)
- [ ] Improve mobile action bar
- [ ] Fix form accessibility issues

**Expected Impact:** Reduced cognitive load, more usable screen space, clearer interactions.

### Sprint 3: Polish & Refinement (Week 3)
- [ ] Build basic onboarding flow (Issue #11)
- [ ] Refine typography system
- [ ] Add loading states and progress indicators
- [ ] Improve success/error messaging
- [ ] Enhanced card modal experience

**Expected Impact:** Professional polish, reduced confusion, better user guidance.

### Sprint 4: Strategic Improvements (Week 4)
- [ ] Ritual experience decision (remove or reimagine)
- [ ] Enhance narrative generation UX
- [ ] Journal feature expansion
- [ ] Complete accessibility audit
- [ ] Performance optimization

**Expected Impact:** Cohesive experience, accessibility compliance, improved retention.

---

## 8. Metrics to Track

### Usability Metrics
- **Task Completion Rate:** % of users who complete first reading
- **Time to First Card:** How long until user draws first card
- **Preparation Abandonment:** % who abandon during setup phase
- **Card Interaction Rate:** % who click cards for details
- **Narrative Generation Rate:** % who create personal narrative

### Accessibility Metrics
- **Contrast Violations:** Count of WCAG failures
- **Keyboard Navigation Issues:** Bugs found in keyboard-only testing
- **Screen Reader Compatibility:** Issues found with NVDA/VoiceOver

### Engagement Metrics
- **Journal Save Rate:** % of readings saved
- **Return Visit Rate:** % who return within 7 days
- **Mobile vs. Desktop Completion:** Compare completion rates
- **Feature Discovery:** % who find optional features

### Technical Metrics
- **Lighthouse Accessibility Score:** Target 95+
- **Mobile Performance Score:** Target 90+
- **Largest Contentful Paint:** Target <2.5s
- **First Input Delay:** Target <100ms

---

## 9. Conclusion

Tableu demonstrates strong technical foundation and design sensibility, but several usability friction points prevent it from reaching its full potential. The most critical issues center around:

1. **Overwhelming preparation phase** that creates decision fatigue
2. **Unclear card interactions** that hide core functionality
3. **Header bloat** that reduces usable screen space
4. **Accessibility gaps**—confirmed lack of skip navigation plus suspected contrast/dynamic-announcement issues that still need tooling proof

By addressing the high-impact quick wins first, then systematically working through medium and strategic improvements, the application can transform from a functional tarot tool into a delightful, accessible, and intuitive experience that serves both newcomers and experienced practitioners.

The recommendations prioritize:
- **Removing friction** from the primary user journey
- **Clarifying interactions** through better affordances
- **Improving accessibility** to WCAG AA standards
- **Enhancing visual hierarchy** for faster scanning
- **Optimizing mobile experience** where most users likely engage

With these improvements, Tableu can become a best-in-class digital tarot experience that balances mystical aesthetics with modern UX best practices.

---

## Appendix A: Testing Devices & Browsers

### Recommended Testing Matrix
- **Desktop:** Chrome, Firefox, Safari, Edge (latest)
- **Mobile iOS:** Safari on iPhone 12, 13, 14 (various sizes)
- **Mobile Android:** Chrome on Pixel, Samsung Galaxy (various sizes)
- **Tablet:** iPad Pro, iPad Mini, Samsung Galaxy Tab
- **Screen Readers:** NVDA (Windows), VoiceOver (macOS/iOS), TalkBack (Android)

### Breakpoint Testing
- 375px (iPhone SE)
- 390px (iPhone 13)
- 428px (iPhone 13 Pro Max)
- 768px (iPad Mini portrait)
- 1024px (iPad Pro portrait)
- 1280px (laptop)
- 1920px (desktop)

---

## Appendix B: Color Contrast Reference

### Current Issues
| Element | Foreground | Background | Ratio | Status |
|---------|-----------|------------|-------|--------|
| Muted text | #9B9388 | #1C1A22 | 5.67:1 | ✅ Pass AA (opaque) |
| Secondary button | #D4B896/20 | #1C1A22 | 1.55:1 | ❌ Fail non-text |
| Accent text | #D4B896 | #1C1A22 | 9.09:1 | ✅ Pass AAA |
| Main text | #E8E6E3 | #0F0E13 | 15.43:1 | ✅ Pass AAA |

Ratios above are calculated on opaque surfaces; translucent overlays (e.g., `bg-surface-muted/60`) still need axe validation, though current combinations remain above 5:1 in spot checks.

### Recommended Fixes
| Element | New Foreground | Background | Ratio | Status |
|---------|---------------|------------|-------|--------|
| Muted text | #B5AFA4 | #1C1A22 | 7.89:1 | ✅ Pass AAA |
| Secondary button | #D4B896/60 | #1C1A22 | 4.11:1 | ✅ Pass non-text |

---
 
**End of Report**

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
