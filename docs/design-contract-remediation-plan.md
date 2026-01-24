# Responsive + A11y Remediation Plan

Based on investigation of `design-contract-responsive-a11y.md` against the codebase.

## Priority Levels

- **P0**: Accessibility violations or broken functionality
- **P1**: Contract violations causing inconsistent UX
- **P2**: Technical debt / cleanup for maintainability

---

## Progress

- [x] Phase 1: Touch targets, safe-area tokens, and utilities landed.
- [x] Phase 2: MotionConfig + custom reduced-motion hook + docs landed.
- [ ] Phase 3 (partial): Breakpoint mapping documented in `tarot.css`; CSS-only rules labeled; migrations still open.
- [ ] Phase 4 (partial): `.touch-target` removed; short-viewport tweaks started; `text-sm-mobile` utility usage still open.
- [ ] Phase 5 (partial): `.safe-area-padding`/`.pb-safe` removed; remaining `env(safe-area-inset-*)` classes still to normalize.
- [ ] Phase 6: Validation not run yet.

---

## Phase 1: Foundation Tokens (P1)

Establish missing CSS variables and Tailwind utilities that other fixes depend on.

### 1.1 Add Touch Target Tokens

**File:** `src/styles/tarot.css` (in `:root`)

```css
:root {
  /* Touch targets - WCAG 2.2 SC 2.5.8 */
  --touch-target: 44px;
  --touch-target-cta: 52px;
}
```

**File:** `tailwind.config.js` (in `extend`)

```javascript
minHeight: {
  'touch': 'var(--touch-target, 44px)',
  'cta': 'var(--touch-target-cta, 52px)',
},
minWidth: {
  'touch': 'var(--touch-target, 44px)',
},
```

**Migration:** Search and replace `min-h-[44px]` → `min-h-touch`, `min-h-[48px]`/`min-h-[52px]` → `min-h-cta`

### 1.2 Add Safe-Area Shorthand Utilities

**File:** `tailwind.config.js` (in `extend.padding`)

```javascript
padding: {
  // Existing direction-specific...
  'safe-top': 'env(safe-area-inset-top, 0px)',
  'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
  'safe-left': 'env(safe-area-inset-left, 0px)',
  'safe-right': 'env(safe-area-inset-right, 0px)',
  // NEW: Shorthand aliases
  'safe-t': 'env(safe-area-inset-top, 0px)',
  'safe-b': 'env(safe-area-inset-bottom, 0px)',
  'safe-x': 'env(safe-area-inset-left, 0px)', // Note: x needs plugin for both sides
},
```

**Alternative:** Create a Tailwind plugin for `px-safe` that applies both left and right:

```javascript
// tailwind.config.js plugins array
plugin(function({ addUtilities }) {
  addUtilities({
    '.px-safe': {
      'padding-left': 'env(safe-area-inset-left, 0px)',
      'padding-right': 'env(safe-area-inset-right, 0px)',
    },
    '.py-safe': {
      'padding-top': 'env(safe-area-inset-top, 0px)',
      'padding-bottom': 'env(safe-area-inset-bottom, 0px)',
    },
    '.pt-safe': { 'padding-top': 'env(safe-area-inset-top, 0px)' },
    '.pb-safe': { 'padding-bottom': 'env(safe-area-inset-bottom, 0px)' },
  })
})
```

### 1.3 Add Safe-Area CSS Variables

**File:** `src/styles/tarot.css` (in `:root`)

```css
:root {
  /* Safe area - for calc() compositions */
  --safe-pad-top: env(safe-area-inset-top, 0px);
  --safe-pad-bottom: env(safe-area-inset-bottom, 0px);
  --safe-pad-x: env(safe-area-inset-left, 0px);
}
```

---

## Phase 2: Consolidate Motion Strategy (P1)

Single source of truth for reduced motion.

### 2.1 Add MotionConfig at App Root

**File:** `src/App.jsx` or `src/main.jsx`

```jsx
import { MotionConfig } from 'framer-motion';

function App() {
  return (
    <MotionConfig reducedMotion="user">
      {/* existing app content */}
    </MotionConfig>
  );
}
```

### 2.2 Migrate Framer-Motion Hook Usage

**File:** `src/components/journal/entry-card/EntrySections/CardsDrawnSection/CardsDrawnSection.jsx`

```diff
- import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
+ import { AnimatePresence, motion } from 'framer-motion';
+ import { useReducedMotion } from '../../../../../hooks/useReducedMotion';
```

### 2.3 Document Motion Strategy

Add to `CLAUDE.md` or create `docs/motion-strategy.md`:

- Custom `useReducedMotion` hook is canonical for React components
- `MotionConfig reducedMotion="user"` handles framer-motion animations
- CSS uses `prefers-reduced-motion` media queries
- Tailwind uses `motion-safe:` / `motion-reduce:` utilities

---

## Phase 3: Breakpoint Alignment (P1)

Resolve drift between Tailwind screens and tarot.css max-width rules.

### 3.1 Audit Custom Max-Width Rules

Current tarot.css breakpoints that don't align with Tailwind:

| CSS Value | Count | Tailwind Equivalent | Action |
|-----------|-------|---------------------|--------|
| `max-width: 330px` | 2 | Below `xxs` (320px) | Keep for ultra-compact |
| `max-width: 360px` | 4 | Between xxs-xs | Keep in CSS; label as `mobile-sm` |
| `max-width: 400px` | 4 | Between xs-sm | Keep in CSS; label as `mobile-md` |
| `max-width: 440px` | 3 | Between xs-sm | Keep in CSS; label as `mobile-lg` |
| `max-width: 479px` | 1 | Just below sm (640) | Keep in CSS; label as `sub-sm` |
| `max-width: 520px` | 2 | Below sm | Keep in CSS; label as `mid-mobile` |
| `max-width: 639px` | 20+ | Aligns with sm | Keep or use `max-sm:` |

### 3.2 Strategy Options

**Option A: Add Custom Tailwind Screens (Recommended)**

```javascript
// tailwind.config.js
screens: {
  'xxs': '320px',
  'xs': '375px',
  'mobile-sm': '360px',  // iPhone SE
  'mobile-md': '400px',  // iPhone standard
  'mobile-lg': '440px',  // iPhone Plus/Max
  ...defaultTheme.screens,
},
```

**Option B: Use Tailwind Arbitrary Values**

Replace CSS rules with Tailwind classes like `max-[360px]:text-sm`.

**Option C: Keep CSS for Fine-Grained Mobile Control (Chosen)**

Document that tarot.css handles sub-640px fine-tuning while Tailwind handles responsive layout.

### 3.3 Implementation

1. Document breakpoint mapping and intent (done in `tarot.css` reference + comments)
2. Decide per-rule: migrate to Tailwind or keep in CSS (in progress)
3. For kept CSS rules, add comments explaining why non-standard breakpoint needed (in progress)
4. Remove duplicate/redundant rules (pending)

---

## Phase 4: Activate Unused Tokens (P2)

### 4.1 Use `text-sm-mobile` Token

**Current:** Defined in tailwind.config.js; now used via `--text-sm-mobile` in `tarot.css`, but utility class usage remains open.

**Action:** Replace ad-hoc `text-[15px]` or `text-[0.9375rem]` with `text-sm-mobile`.

Search patterns:
- `text-[15px]`
- `text-[0.9375rem]`
- `font-size: 15px`
- `font-size: 0.9375rem`

### 4.2 Use `.touch-target` Class

**Current:** Defined at tarot.css:2817 but unused.

**Options:**
1. Delete the class (prefer Tailwind `min-h-touch min-w-touch`)
2. Use the class for non-Tailwind contexts

**Recommendation:** Delete `.touch-target` class, use Tailwind utilities exclusively. (done)

### 4.3 Use `short` Screen

**Current:** Defined but only one combined rule uses max-height:600px.

**Action:** Audit components that should adapt for short viewports:
- Modals with tall content
- Full-page layouts
- Card reveal animations

Add `short:` variants where height constraints matter (started in journey sheet, streaming narrative, and auth flows):
```jsx
<div className="min-h-[400px] short:min-h-[300px]">
```

---

## Phase 5: Safe-Area Cleanup (P2)

### 5.1 Consolidate `.safe-area-padding` Class

**Current:** Removed in favor of safe-area utilities and CSS vars. (done)

**Action:** Either:
- Delete class (use Tailwind utilities)
- Or fix and use:

```css
.safe-area-padding {
  padding-top: env(safe-area-inset-top, 0);
  padding-bottom: env(safe-area-inset-bottom, 0);
  padding-left: env(safe-area-inset-left, 0);
  padding-right: env(safe-area-inset-right, 0);
}
```

### 5.2 Migrate Inline Safe-Area Styles

**Files with inline `env(safe-area-inset-*)` styles:**
- `ReadingBoard.jsx:305-306`
- `CardModal.jsx:199-202`
- `Journal.jsx:747-749`
- `MobileBottomNav.jsx:47-49`
- ~25 more locations

**Action:** Replace inline styles with Tailwind utilities:

```diff
- style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
+ className="pb-safe-bottom"
```

### 5.3 Fix `.pb-safe` Static Value

**Current:** Removed from `tarot.css`; use Tailwind `.pb-safe` utility instead. (done)

**Action:** Align with Tailwind utility or delete:

```css
.pb-safe {
  padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
}
```

Or delete and use `pb-safe-bottom` utility with additional `pb-4` for the 1rem minimum.

---

## Phase 6: Validation (P0)

### 6.1 Regression Checklist

After each phase, verify:

- [ ] Layouts at 320 / 375 / 640 / 768 / 1024 widths
- [ ] Landscape compact at max-height 500px
- [ ] Short viewport at max-height 600px
- [ ] Safe-area on iOS notch devices (headers, footers, modals)
- [ ] Base type sizes on mobile (16px body, 15px long-form)
- [ ] All interactive elements >= 44px
- [ ] `prefers-reduced-motion: reduce` disables animations
- [ ] Motion toggles work for JS-driven animations

### 6.2 Automated Checks

```bash
# A11y tests
npm run test:a11y

# Visual regression (if configured)
npm run test:e2e -- --update-snapshots

# Contrast check
npm run test:contrast
```

---

## Implementation Order

| Order | Phase | Effort | Risk | Dependencies |
|-------|-------|--------|------|--------------|
| 1 | 1.1 Touch tokens | Low | Low | None |
| 2 | 1.2-1.3 Safe-area tokens | Low | Low | None |
| 3 | 2.1-2.3 Motion consolidation | Medium | Low | None |
| 4 | 4.2 Delete `.touch-target` | Low | Low | After 1.1 |
| 5 | 5.1-5.3 Safe-area cleanup | Medium | Medium | After 1.2-1.3 |
| 6 | 4.1 `text-sm-mobile` usage | Low | Low | None |
| 7 | 4.3 `short` screen usage | Medium | Low | None |
| 8 | 3.1-3.3 Breakpoint alignment | High | Medium | After 4.1 |
| 9 | 6.1-6.2 Full validation | Medium | N/A | After all |

---

## Files to Modify

| File | Phases |
|------|--------|
| `src/styles/tarot.css` | 1.1, 1.3, 3.3, 4.2, 5.1, 5.3 |
| `tailwind.config.js` | 1.1, 1.2, 3.2 |
| `src/App.jsx` or `src/main.jsx` | 2.1 |
| `src/components/journal/.../CardsDrawnSection.jsx` | 2.2 |
| ~30 components with inline safe-area styles | 5.2 |
| Components using ad-hoc 15px text | 4.1 |
| Components needing short viewport handling | 4.3 |

---

## Success Criteria

1. All 8 inconsistencies from design contract resolved
2. All 6 missing tokens/utilities added
3. Single motion strategy documented and enforced
4. Zero inline `env(safe-area-inset-*)` styles
5. Zero ad-hoc `min-h-[44px]` (use `min-h-touch`)
6. Regression checklist passes on all viewport sizes
