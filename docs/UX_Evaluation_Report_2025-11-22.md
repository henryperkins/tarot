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
