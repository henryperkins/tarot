**2) Inconsistencies (Findings)**
- High — Mobile input/select font sizes can drop below the 16px safeguard, risking iOS zoom and inconsistent type scale; standardize inputs/selects to 16px under `sm` (e.g., `text-base` on form controls or a shared input class) so utilities don’t override the global rule. Refs: `src/styles/tarot.css:322`, `src/pages/CardGalleryPage.jsx:510`, `src/pages/CardGalleryPage.jsx:561`
- High — Keyboard avoidance is implemented in three separate places with different thresholds and outputs, so offsets can diverge or double-apply; consolidate into a shared `useKeyboardOffset` hook that sets one CSS var (e.g., `--keyboard-offset`) and consume it everywhere. Refs: `src/TarotReading.jsx:417`, `src/components/MobileActionBar.jsx:479`, `src/components/MobileSettingsDrawer.jsx:9`, `src/components/FollowUpDrawer.jsx:11`
- Medium — Bottom-fixed UI doesn’t consistently account for action-bar height/keyboard offset; some screens use only safe-area padding while others include action-bar vars, risking overlap. Standardize on a single bottom formula (safe-pad + action-bar height + action-bar offset) and reuse it in all fixed footers. Refs: `src/styles/tarot.css:360`, `src/components/StreamingNarrative.jsx:283`, `src/pages/ShareReading.jsx:494`
- Medium — Safe-area padding mixes direct `env()` utilities, CSS vars, and ad hoc `max()` inline rules, so base spacing differs (e.g., `pb-safe-bottom` can be 0 on non-notched devices while `pb-safe` enforces 1rem). Pick one rule: map safe utilities to `--safe-pad-*` and use a consistent base inset. Refs: `tailwind.config.js:103`, `tailwind.config.js:134`, `src/styles/tarot.css:203`, `src/components/AuthModal.jsx:191`
- Medium — Breakpoints are documented in CSS-only cutoffs (330/360/400/440/479/520/1366) but not codified in Tailwind, which invites drift across components; either add these to `screens` or collapse CSS-only rules to `xxs/xs/sm`. Refs: `src/styles/tarot.css:95`, `tailwind.config.js:26`
- Medium/Low — `short` is `max-height: 600px` in Tailwind but CSS landscape tweaks only apply when `orientation: landscape`; this creates mismatched density behavior on short portrait devices. Align `short` with landscape or introduce `short-landscape` and update usages. Refs: `tailwind.config.js:33`, `src/styles/tarot.css:662`, `src/components/StreamingNarrative.jsx:281`
- Low — Type scale drifts via many custom `text-[0.xxrem]` sizes while `text-sm-mobile` is effectively unused outside CSS; enforce a small scale (`text-xs`, `text-xs-plus`, `text-sm-mobile`, `text-sm`, `text-base`) and migrate custom sizes. Refs: `tailwind.config.js:84`, `src/components/DeckRitual.jsx:826`, `src/components/ExperienceSettings.jsx:67`
- Low — `.reduced-effects` exists but isn’t wired to any preference, leaving an unused motion toggle alongside the `prefers-reduced-motion` system. Either remove it or wire it to a user setting and align behavior. Refs: `src/styles/tarot.css:2745`, `src/styles/tarot.css:2820`

**Open Questions / Assumptions**
- Is `short` intended to apply in portrait as well, or should it be landscape-only?
- Should “reduced effects” be a user-facing setting, or can `.reduced-effects` be removed?
- Should all bottom-fixed bars (even outside the reading flow) account for the mobile action bar offset?

**1) Design Contract**
- **Mobile widths (xxs ≥320, xs ≥375, sm ≥640)**: xxs density tight, `body 16`, `prose 16` (`text-sm-mobile`), `secondary 14` (`text-xs-plus`), micro 12 (`text-xs`), badge 11 (`text-2xs`), touch `min-h-touch 44`/`min-h-cta 52`; xs density compact with the same scale but allow `text-sm` for UI; sm density standard with `body 16`, `prose 16` (`text-base`), `secondary 14`, touch unchanged.
- **Tablet/Desktop widths (md ≥768, lg ≥1024, xl ≥1280, 2xl ≥1536)**: density comfortable; `body 16`, `prose 16–18` (`text-base`/`text-lg`), `secondary 14`; touch targets remain 44/52.
- **Height/orientation (short max-height 600, landscape max-height 500)**: density tight; reduce vertical padding and non-critical labels; do not reduce touch targets; minimum readable size stays ≥14px.
- **Safe-area + keyboard**: use `--safe-pad-*` and `--mobile-action-bar-*` as the source of truth; bottom UI uses `safe-pad-bottom + action-bar-height + keyboard offset`; drawers/modals use `pt-safe/pb-safe` with a consistent base inset.
- **Motion**: all CSS motion via `motion-safe:`; JS motion must check `useReducedMotion`; durations/easing from `--duration-*`/`--ease-out`; `prefers-reduced-motion: reduce` collapses animations to near-zero.

**3) Minimal Token/Util Set to Standardize**
- Spacing: keep to Tailwind scale (`p-3/p-4`, `gap-2/3/4`, `space-y-3/4`), avoid arbitrary spacing except safe-area/keyboard offsets.
- Min-heights: `min-h-touch`, `min-w-touch`, `min-h-cta` only; replace fixed sizes where they duplicate tokens.
- Motion: `--duration-*`, `--ease-out`, `motion-safe:animate-*`, `motion-reduce:transition-none`, `useReducedMotion` for JS.
- Safe-area: `--safe-pad-*`, `--mobile-action-bar-height`, `--mobile-action-bar-offset`, utilities `pt-safe`, `pb-safe`, `px-safe`, `pl-safe-left`, `pr-safe-right`.
- Type scale: prefer `text-2xs`, `text-xs`, `text-xs-plus`, `text-sm-mobile`, `text-sm`, `text-base`; avoid `text-[Npx]` for microcopy.

**4) Regression Checklist**
- Validate `xxs/xs/sm/md/lg` layouts at 320/375/640/768/1024 widths (no overflow, readable type).
- Verify safe-area padding on notched devices for top/bottom/left/right and no double-padding.
- Open/close keyboard on mobile; bottom bars/drawers stay visible and don’t jump or overlap.
- Confirm touch targets ≥44px and CTA ≥52px across icon-only and text buttons.
- Toggle `prefers-reduced-motion: reduce`; all animations/transitions and JS animations cease.
- Check landscape ≤500px height and `short` height behavior for consistent density.

If you want me to proceed with changes, pick one:
1) I can draft a patch that consolidates breakpoints/safe-area utilities and fixes the highest-risk issues (inputs + bottom bars).
2) I can add a small lint/codemod pass to flag non-standard text sizes and missing `min-h-touch`.
