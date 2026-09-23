# Astronomy, reversal, and retrieval evaluation

This report records the pre-release evaluation. Application unit tests pass, but the paired live narrative run fails the existing story-structure gate. The initial recommendation was a draft PR; after these results were reported, the user explicitly requested a local merge into the primary branch, a push to origin, and deployment. That release decision does not change the test results or limitations below.

## Paired live evaluation

Baseline: `origin/master` at `15047a45453c36108baf52b3752f4757cb2f02bf`.
Candidate: the scoped changes on `fix/review-astro-reversal-retrieval-pr`, based on that same commit.

Both runs used all nine synthetic samples, the `azure-gpt5` backend through native OpenAI Responses, `gpt-5.6-sol`, `xhigh` reasoning, and reference time `2026-09-23T14:04:00Z`. The existing API key was supplied through the process environment. No credentials are included in the evidence.

| Metric | Baseline | Candidate |
| --- | ---: | ---: |
| Story-structure pass rate | 100% (9/9) | 88.9% (8/9) |
| Average coherence rubric | 100% | 91.1% |
| Card coverage / accuracy rubric | 100% | 100% |
| Agency rubric | 100% | 100% |
| Supportive-tone / compassion rubric | 100% | 100% |
| Hallucinated cards | 0 | 0 |
| Deterministic / harsh-tone flags | 0 / 0 | 0 / 0 |
| Flagged samples | 0 | 1 |
| `npm run ci:narrative-check` | Pass | Fail |

The candidate's `five-card-creative-project` sample is flagged `spine-incomplete`, with coherence 0.2. Four card sections put the complete card name only in the heading; their bodies use shortened references such as “An Ace” and “The Queen.” The existing structure detector checks section bodies for its required WHAT signal and excludes those headings. This accounts for the reported flags; the paragraphs do contain interpretations and all drawn cards are covered. The gate and the original result remain unchanged.

These are heuristic scores from one generation per sample per version, not a statistical demonstration of quality improvement or regression. The decision sample passes all metrics in both runs. Review the actual readings before drawing a broader conclusion.

### Reproduction and evidence

The candidate evaluation runner was copied into the otherwise unchanged baseline worktree so both runs used the same harness. The old baseline orchestrator ignores `referenceTime`, so **both** processes also loaded this temporary clock shim with Node's `--import` option:

```js
const NativeDate = globalThis.Date;
const instant = NativeDate.parse('2026-09-23T14:04:00Z');
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return instant; }
};
```

Each process ran `npm run ci:narrative-check` with `NARRATIVE_EVAL_BACKEND=azure-gpt5`, `NARRATIVE_EVAL_REFERENCE_TIME=2026-09-23T14:04:00Z`, `OPENAI_MODEL=gpt-5.6-sol`, and `OPENAI_REASONING_EFFORT=xhigh`. Because the shim freezes `Date`, `generatedAt` in the generated JSON is the reference instant; the separate status files preserve actual run start/end times. No performance claim is made from frozen-clock logs. The baseline harness overlay and default generated evaluation files were restored after evidence capture.

Evidence under [astro-reversal-2026-09-23](evidence/astro-reversal-2026-09-23/) includes both full sample sets, per-sample metrics, structure diagnostics for the flagged sample, and run metadata.

## Other verification

- Node `v24.15.0`; dependencies installed with `npm ci` from the rebased lockfile.
- `npm test`: **2,000 passed**, zero failures.
- ESLint over all 26 scoped source/test files: **pass**, no warnings.
- Full `npm run lint`: **146 errors, 37 warnings**, with identical diagnostics on baseline and candidate after normalizing worktree paths.
- `npm run build`: **pass**, existing large-chunk warning.
- `node --test functions/__tests__/*.test.js functions/__tests__/*.test.mjs`: **136 passed, 2 failed**. Both failures at `telemetry.test.js:415` and `:570` reproduce on untouched baseline code.
- Prompt-assembly checks: **pass**, also run separately because the failed candidate metrics gate short-circuits that stage of `ci:narrative-check`.
- Independent read-only review found no critical or important application regression. Sixty monthly-start, 90-day forecast scans across 2024–2028 completed without search errors.

## Focused browser evidence

The flow tested was: fixed ephemeris and journal fixtures → focus/hover the production Moon component and switch journal metadata → observe lunation sign/time, tied suit names, and removal of a stale dominance claim.

Playwright Chromium rendered the actual `MoonPhaseIndicator`, `useEntryMetadata`, and `normalizeThemeLabel` modules at widths 1440, 390, and 320 with reduced motion. The page identity and content were present, no framework overlay appeared, and the final isolated fixture interaction run logged zero errors. Keyboard focus opens the tooltip; Escape closes it. The exact lunation renders as Full Moon in Aries, Sep 26 at 11:49 AM in the browser's America/Chicago timezone; all three tied suits remain visible in text, and a legacy `dominantSuit` alone produces no suit insight.

This is component evidence, not a complete reading or authenticated journal end-to-end test. The initial full-app smoke load used Vite without its Worker API and reported unavailable auth/health endpoints; those calls were absent from the isolated component fixture.

The existing tooltip is narrow (about 95 px), causing excessive wrapping and overlap with nearby content; the candidate's sequential resize fixture also exposed about 1.3 px of left-edge overflow at 320 px. `Tooltip.jsx` is unchanged. These layout limitations are not claimed fixed by this PR.

Screenshots: [baseline desktop](evidence/astro-reversal-2026-09-23/ui-baseline-1440.png), [baseline 320](evidence/astro-reversal-2026-09-23/ui-baseline-320.png), [candidate desktop](evidence/astro-reversal-2026-09-23/ui-1440.png), [candidate 390](evidence/astro-reversal-2026-09-23/ui-390.png), [candidate 320](evidence/astro-reversal-2026-09-23/ui-320.png).

## Remaining review item

Planetary speed is rounded to four decimals before `isDirect` is derived. Around a slow outer-planet station this can round a small negative motion to negative zero: at `2026-10-16T01:24Z`, the Pluto snapshot reports direct motion approximately an hour before the forecast's station. A follow-up should derive direction from raw motion and round only the exposed speed, with a station-boundary regression. This minor precision issue is documented rather than changing the evaluated implementation during publication.
