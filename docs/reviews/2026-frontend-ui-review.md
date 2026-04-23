Type: review
Status: historical snapshot
Last reviewed: 2026-04-23

**Assumptions & Inputs Needed**

This review preserves the original audit structure, but the file references have been normalized to repo-relative links for portability. Treat it as historical review evidence rather than a maintained navigation surface.
Assumptions used for this best-effort review:
1. I reviewed the live codebase only (no Figma, screenshots, product analytics, or support logs provided).
2. I prioritized core user flows and high-change surfaces: app shell/routing, reading flow, onboarding/spread selection, media generation, and account/pricing/share pages.
3. I treated this as a production-quality frontend review (architecture + UX + a11y + perf), not just lint/style feedback.

Scope reviewed (key pages/components):
1. App shell and routing: [main.jsx](../../src/main.jsx#L1), [AnimatedRoutes.jsx](../../src/components/AnimatedRoutes.jsx#L1)
2. Core reading flow: [TarotReading.jsx](../../src/TarotReading.jsx#L41), [ReadingDisplay.jsx](../../src/components/ReadingDisplay.jsx#L1), [ReadingContext.jsx](../../src/contexts/ReadingContext.jsx#L28)
3. Spread/onboarding/media: [SpreadSelector.jsx](../../src/components/SpreadSelector.jsx#L128), [SpreadEducation.jsx](../../src/components/onboarding/SpreadEducation.jsx#L46), [spreadArt.js](../../src/utils/spreadArt.js#L1), [AnimatedReveal.jsx](../../src/components/AnimatedReveal.jsx#L836), [StoryIllustration.jsx](../../src/components/StoryIllustration.jsx#L664), [UpgradeNudge.jsx](../../src/components/UpgradeNudge.jsx#L18)
4. Secondary pages: [PricingPage.jsx](../../src/pages/PricingPage.jsx#L1), [AccountPage.jsx](../../src/pages/AccountPage.jsx#L1), [ShareReading.jsx](../../src/pages/ShareReading.jsx#L35), [CardGalleryPage.jsx](../../src/pages/CardGalleryPage.jsx#L197)
5. Quality/test infra: [eslint.config.js](../../eslint.config.js#L1), [vite.config.js](../../vite.config.js#L1), [wcag-analyzer.mjs](../../tests/accessibility/wcag-analyzer.mjs#L1), [accessibility.spec.js](../../e2e/accessibility.spec.js#L1)

Artifacts still needed (targeted questions):
1. Which flows are highest priority for your next 1-2 sprints: onboarding, reading generation, journal analytics, or conversion/paywall?
2. What are your mobile performance targets (e.g., initial JS budget, LCP target on 4G)?
3. What browser support matrix is required (especially older Safari where modal/focus behavior differs)?
4. Can you share current analytics drop-off and error rates by route/component?
5. Can you share design source of truth (Figma/design tokens) for visual consistency scoring vs intent?

Provisional plan until those inputs arrive:
1. Execute quick wins below first (they are low-risk and high leverage).
2. Re-run a focused a11y/perf audit on top 3 user flows after the quick wins.

**Analysis Framework (criteria + weights)**
| Criterion | Weight | Current Score (1-5) | Weighted |
|---|---:|---:|---:|
| Maintainability | 20% | 2.5 | 10.0 |
| Consistency / Design System adherence | 15% | 3.0 | 9.0 |
| Accessibility | 20% | 2.5 | 10.0 |
| Performance | 20% | 2.0 | 8.0 |
| Responsiveness | 10% | 3.5 | 7.0 |
| Usability | 10% | 3.0 | 6.0 |
| Visual polish | 5% | 3.5 | 3.5 |
| **Total** | **100%** |  | **53.5 / 100** |

Validation runs used:
1. `npm run build` passed, but emitted large-chunk warnings and very large emitted assets.
2. `npm run test:a11y` passed contrast checks but produced extremely noisy static warnings.
3. `npm run dev:frontend` failed due `cloudflare:workers` dependency optimization error.
4. Playwright a11y smoke (`home page has no critical violations`) failed because dev server failed to stay up.

**Findings**
**Performance**
1. **High**  
Evidence: spread art preloading currently loads all formats including huge PNG fallbacks in sequence ([spreadArt.js:111](../../src/utils/spreadArt.js#L111), [spreadArt.js:116](../../src/utils/spreadArt.js#L116), [spreadArt.js:129](../../src/utils/spreadArt.js#L129)); called on mount in both spread selection and onboarding ([SpreadSelector.jsx:153](../../src/components/SpreadSelector.jsx#L153), [SpreadEducation.jsx:55](../../src/components/onboarding/SpreadEducation.jsx#L55)).  
Impact: this can front-load significant network and memory cost on mobile and slow first meaningful interaction.  
Recommendation: preload only visible/selected spread plus adjacent candidates; remove `.png` from proactive preload list; keep PNG fallback on-demand.

2. **High**  
Evidence: frontend dev server and e2e runtime are blocked by dependency optimization pulling worker-only imports (`cloudflare:workers`) into browser optimize step; config scans all `src/**/*` ([vite.config.js:23](../../vite.config.js#L23), [vite.config.js:25](../../vite.config.js#L25)); worker import exists in frontend tree ([src/worker/index.js:11](../../src/worker/index.js#L11)).  
Impact: local UI validation and automated a11y flow are unstable/non-functional, slowing all frontend quality work.  
Recommendation: exclude `src/worker/**` from browser optimize entries, or alias/externalize `cloudflare:workers` for browser builds; separate worker compilation boundary from Vite frontend path.

3. **Medium**  
Evidence: internal navigation in feature gates uses hard reloads ([AnimatedReveal.jsx:844](../../src/components/AnimatedReveal.jsx#L844), [StoryIllustration.jsx:685](../../src/components/StoryIllustration.jsx#L685), [UpgradeNudge.jsx:55](../../src/components/UpgradeNudge.jsx#L55)).  
Impact: unnecessary full page reloads reset React state and can interrupt user flow.  
Recommendation: switch internal routes to `navigate('/pricing')`/`<Link>`; keep hard redirects only for external checkout URLs.

**Accessibility**
1. **High**  
Evidence: upgrade modal implementations are not using dialog semantics/focus management in key paths ([UpgradeNudge.jsx:123](../../src/components/UpgradeNudge.jsx#L123), [SpreadSelector.jsx:534](../../src/components/SpreadSelector.jsx#L534), [StoryIllustration.jsx:665](../../src/components/StoryIllustration.jsx#L665)).  
Impact: keyboard and screen reader users can lose context and tab to background content while modal is open.  
Recommendation: standardize on a single modal primitive with `role="dialog"`, `aria-modal="true"`, focus trap, Escape close, and focus restore (you already have [useModalA11y.js](../../src/hooks/useModalA11y.js#L57)).

2. **Medium**  
Evidence: onboarding spread card has outer interactive semantics (`role="button"` + `onClick`) but is non-focusable and wraps another button ([SpreadEducation.jsx:123](../../src/components/onboarding/SpreadEducation.jsx#L123), [SpreadEducation.jsx:125](../../src/components/onboarding/SpreadEducation.jsx#L125), [SpreadEducation.jsx:126](../../src/components/onboarding/SpreadEducation.jsx#L126), [SpreadEducation.jsx:142](../../src/components/onboarding/SpreadEducation.jsx#L142)).  
Impact: duplicate interactive semantics can confuse assistive tech and create inconsistent keyboard behavior.  
Recommendation: keep one interactive control per card (single button or radio-style pattern), remove outer faux-button role.

3. **Medium**  
Evidence: media lightbox autoplays video regardless reduced-motion preference ([MediaGallery.jsx:68](../../src/components/MediaGallery.jsx#L68), [MediaGallery.jsx:354](../../src/components/MediaGallery.jsx#L354)).  
Impact: can be uncomfortable for motion-sensitive users and create unexpected motion on open.  
Recommendation: gate autoplay with reduced-motion (`autoPlay={!prefersReducedMotion}`) and default to manual play.

**Maintainability / Architecture**
1. **High**  
Evidence: core flow files are very large and multi-responsibility (`TarotReading`, `ReadingDisplay`, `ReadingContext`) with broad state + orchestration coupling ([TarotReading.jsx:41](../../src/TarotReading.jsx#L41), [TarotReading.jsx:862](../../src/TarotReading.jsx#L862), [ReadingDisplay.jsx:1](../../src/components/ReadingDisplay.jsx#L1), [ReadingContext.jsx:28](../../src/contexts/ReadingContext.jsx#L28), [ReadingContext.jsx:1440](../../src/contexts/ReadingContext.jsx#L1440)).  
Impact: high regression risk, low change velocity, and broad rerender surfaces.  
Recommendation: split by domain boundaries (session orchestration, narrative/media, persistence/telemetry), and expose narrower selector-based hooks.

2. **Medium**  
Evidence: dead/legacy artifacts remain in frontend tree ([Journal_backup.jsx](../../src/components/Journal_backup.jsx)).  
Impact: increases cognitive load and invites accidental drift between “real” and stale files.  
Recommendation: remove or archive stale files outside active source paths.

**Consistency / Design System & Quality Gates**
1. **Medium**  
Evidence: static WCAG analyzer is regex-based and scans all JS/CSS under `src`, including worker/backend-like files ([wcag-analyzer.mjs:94](../../tests/accessibility/wcag-analyzer.mjs#L94), [wcag-analyzer.mjs:241](../../tests/accessibility/wcag-analyzer.mjs#L241), [wcag-analyzer.mjs:273](../../tests/accessibility/wcag-analyzer.mjs#L273)).  
Impact: high false-positive volume lowers trust in a11y reporting and buries real issues.  
Recommendation: move rule enforcement to `eslint-plugin-jsx-a11y` + route-level axe tests; scope static checks to JSX render files only.

2. **Medium**  
Evidence: ESLint config lacks jsx-a11y plugin integration ([eslint.config.js:59](../../eslint.config.js#L59), [eslint.config.js:75](../../eslint.config.js#L75)).  
Impact: accessibility regressions are caught late (or not at all) unless runtime tests happen.  
Recommendation: add `eslint-plugin-jsx-a11y` with baseline rules and CI fail-on-regression for changed files.

**Usability**
1. **Medium**  
Evidence: wildcard route falls back to reading page instead of explicit 404 ([AnimatedRoutes.jsx:207](../../src/components/AnimatedRoutes.jsx#L207)).  
Impact: broken links and mistyped URLs silently look valid, creating user confusion and support burden.  
Recommendation: add a dedicated NotFound route with clear recovery actions and optional telemetry.

**Top 5 Quick Wins (high impact / low effort)**
1. Fix frontend dev/e2e blocker by excluding worker paths from Vite dependency optimization and browser bundle scan ([vite.config.js:23](../../vite.config.js#L23)).
2. Replace `window.location.href='/pricing'` in SPA components with router navigation ([AnimatedReveal.jsx:844](../../src/components/AnimatedReveal.jsx#L844), [StoryIllustration.jsx:685](../../src/components/StoryIllustration.jsx#L685), [UpgradeNudge.jsx:55](../../src/components/UpgradeNudge.jsx#L55)).
3. Convert upgrade overlays to the shared modal a11y pattern (`role="dialog"`, focus trap, Escape, restore focus) ([UpgradeNudge.jsx:123](../../src/components/UpgradeNudge.jsx#L123)).
4. Change spread art preload strategy to selected/nearby only; remove eager PNG preload ([spreadArt.js:116](../../src/utils/spreadArt.js#L116), [SpreadSelector.jsx:153](../../src/components/SpreadSelector.jsx#L153)).
5. Add proper 404 route instead of wildcard redirect to home flow ([AnimatedRoutes.jsx:207](../../src/components/AnimatedRoutes.jsx#L207)).

**Deeper Refactors (high impact / higher effort)**
1. Split `ReadingContext` into smaller providers with selector hooks to reduce rerender fan-out and improve testability ([ReadingContext.jsx:1440](../../src/contexts/ReadingContext.jsx#L1440)).
2. Break `TarotReading`/`ReadingDisplay` into scene-level containers with clearer state ownership and integration contracts ([TarotReading.jsx:862](../../src/TarotReading.jsx#L862), [ReadingDisplay.jsx:1](../../src/components/ReadingDisplay.jsx#L1)).
3. Introduce a unified modal system and enforce via lint/code review checklist so all dialogs share the same accessibility contract.
4. Replace regex WCAG scanning with AST/lint + route-based axe tests across critical routes (`/`, `/pricing`, `/account`, `/share/:token`, onboarding modal).

**Risks & Open Questions**
1. Runtime a11y verification is currently blocked locally by the frontend dev-server dependency optimization failure (`cloudflare:workers` resolution), so this review is code- and build-heavy rather than full interactive flow validation.
2. Without production analytics and session recordings, usability prioritization is inferred from code structure, not user behavior.
3. Visual polish scoring is provisional without screenshots/Figma baselines and device snapshots.
4. Open question: what is the acceptable tradeoff between immediate visual richness and first-load performance budget on mobile?
5. Open question: do you want recommendations optimized for strict WCAG AA conformance, or balanced with current visual style even when that creates minor exceptions?

<oai-mem-citation>
<citation_entries>
MEMORY.md:47-56|note=[used quick memory pass to identify recent tarot UI/telemetry rollouts and avoid stale assumptions]
rollout_summaries/2026-02-26T00-59-58-n3tP-media_companion_visual_studio.md:21-23|note=[used prior note that bundle warnings were pre-existing when interpreting current build output]
rollout_summaries/2026-02-25T23-34-15-LMBp-graphrag_source_usage_enhancements.md:28-29|note=[used prior context on sourceUsage propagation when reviewing reading metadata surfaces]
</citation_entries>
<rollout_ids>
019c9775-b0b0-7170-bfd1-95eac2f87e5d
019c9727-359b-7eb2-b692-0701276e6817
</rollout_ids>
</oai-mem-citation>
