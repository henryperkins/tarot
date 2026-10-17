# Primary checkout reconciliation — 2026-10-17

Reviewed all 46 overlapping files from the preserved primary checkout against master. Keep master's current implementation in 43 files. Carry forward three narrow changes: remove an obsolete video-cron diagram edge, assert that the retired speech-token endpoint is not cached, and assert that the narration browser flow never requests either retired media endpoint. No application runtime, dependency, or deployment configuration changes are needed.

## Compared inputs and preservation

- Primary checkout: `codex/preserve-primary-20261008`, based on `d5ab70b78daf8662420f575b4231c629216a063f`, plus its frozen uncommitted files.
- Target master: `5e90d3751e08cea869e95fe8d5405367c74021ae`.
- Reviewed the primary delta against its own base first, then compared its intent with current master and the relevant callers and tests. Older files missing later features were not treated as intentional removals.
- Frozen copies, SHA-256 manifest, staged and unstaged binary patches, the original index, ref inventory, reviewer reports, and verification logs are stored privately at `/home/ubuntu/.local/state/tarot/primary-integration-20261017`. The earlier full recovery bundle remains at `/home/ubuntu/.local/state/tarot/git-reconciliation/20261017T123220Z`.
- The primary checkout's 237 dirty status entries, local evidence, staged modal configuration, and the separate reading bridge were preserved. Integration runs in an isolated worktree.

The disposition is supported by source review. Browser checks use mocked services and establish browser behavior only; they do not renew physical-device, live-provider, or production qualification.

## File dispositions

“Keep master” means the primary intent is already integrated or superseded. “Port assertion” and “Port documentation” identify the only selected hunks.

| File | Disposition | Reason and safeguard retained |
| --- | --- | --- |
| `README.md` | Keep master | Selectable ElevenLabs/Deepgram narration and their shared allowance supersede implicit reader-voice selection. |
| `docs/DEVELOPER_ONBOARDING.md` | Keep master | Current setup documents both selectable engines, the Deepgram binding, and shared accounting. |
| `docs/architecture/full-system-diagrams.md` | Port documentation | Remove only the dangling `Worker --> CronVideo` edge: the configured cron is daily cleanup, and the scheduled handler ignores the retired video schedule. Keep newer provider and diagnostics descriptions. |
| `docs/architecture/overview-diagram.md` | Keep master | Speech-token retirement is already documented; keep current narration choice and shared allowance. |
| `docs/azure-tts-reference.md` | Keep master | Keep the newer archived-reference status and current setup pointer. |
| `docs/narration-safeguards.md` | Keep master | Keep explicit choice, no silent fallback, provider-aware caches and health, and shared allowance. |
| `docs/provider-reference.md` | Keep master | Keep the current owner-subscription and visual-provider inventory; preserve the older branch inventory as historical local evidence. |
| `docs/superpowers/plans/2026-10-08-remaining-frontend-failures.md` | Keep master | Keep the completed 14-task execution record and qualification limits rather than restoring the earlier unchecked plan. |
| `e2e/frontend-effect-state.spec.js` | Keep master | Primary query, scroll, and highlight coverage is present; keep the shared frontend fixture and height stabilization. |
| `e2e/media-narration-reliability.spec.js` | Port assertion | Observe page requests before setup and assert no speech-token or card-video requests after pricing navigation. Preserve provider migration, keyboard controls, guest coverage, reload state, quota recovery, cancellation, and automatic-narration coverage. |
| `functions/api/journal-summary.js` | Keep master | Native OpenAI migration is present; keep personal-provider routing and model provenance. |
| `functions/api/speech-token.js` | Keep master | The endpoint already returns 410 with `no-store` without accessing authentication, environment, or upstream services. |
| `functions/api/tarot-reading.js` | Keep master | Keep current personal-provider routing, stream finalization, quota handling, and model provenance. |
| `functions/api/tts.js` | Keep master | ElevenLabs transport and abort handling are present; keep explicit narrator validation and shared accounting before synthesis. |
| `functions/lib/narrativeBackends.js` | Keep master | Native OpenAI is present; keep selected personal-provider admission and provenance. |
| `package-lock.json` | Keep master | Retired SDK removal is present; keep later dependencies and required tool versions. |
| `playwright.modals.config.js` | Keep master | Keep onboarding exit-focus coverage and reduced motion under `contextOptions`. |
| `public/sw.js` | Keep master | Branding is present; keep v7, neutral card fallback, and protection against caching SPA HTML as script responses. |
| `src/TarotReading.jsx` | Keep master | Generic narration health is present; keep save-controller, cancellation, viewport, and focus behavior. |
| `src/components/AnimatedReveal.jsx` | Keep master | Card identity, stale-media clearing, tier memoization, style clamping, and cleanup invalidation are present; keep Tailwind 4 classes. |
| `src/components/AudioControls.jsx` | Keep master | Keep supported provider choice, speed controls for both engines, and keyboard radio behavior. |
| `src/components/ConfirmModal.jsx` | Keep master | Single modal focus ownership is present; keep fallback focus and current Tailwind focus classes. |
| `src/components/DeckSelector.jsx` | Keep master | Larger wrapping typography is present; keep current carousel labels and Tailwind 4 classes. |
| `src/components/Header.jsx` | Keep master | Shared logo is present; keep reading navigation, pinned-height ownership, install integration, and safe-area behavior. |
| `src/components/SpreadSelector.jsx` | Keep master | Typography and wrapping are present; keep restored-selection scrolling and responsive image priority. |
| `src/components/UserMenu.jsx` | Keep master | Owner-scoped journey state and event-driven preference loading are present; keep draft clearing, auth-dialog ownership, and utilities. |
| `src/components/onboarding/OnboardingWizard.jsx` | Keep master | Keep current nested focus ownership, replay fallback focus, and the shared Android back guard. |
| `src/components/onboarding/trimmed/WelcomeStep.jsx` | Keep master | Branding, larger copy, and wrapping choices are present; keep current Tailwind classes. |
| `src/contexts/AuthContext.jsx` | Keep master | Cancellable auth setup is present; keep owner-specific visual resume cleanup. |
| `src/contexts/PreferencesContext.jsx` | Keep master | Lifecycle cleanup is present; keep normalized selectable narration providers. |
| `src/contexts/ReadingContext.jsx` | Keep master | Keep the shared predicate recognizing both narrators, owner transitions, persisted job identities, and visual binding changes. |
| `src/hooks/narrativeReadingModelUtils.js` | Keep master | Both narrators have progress support; keep exact source, deck, artwork, reflection, and inspection identities. |
| `src/hooks/useAudioController.js` | Keep master | Server narration is present; keep provider-switch cancellation, completed-reading admission, voice-off gating, and current enable/play callback ownership. |
| `src/hooks/useJournal.js` | Keep master | Stable callbacks and cancellable setup are present; keep owner and deletion fences, cross-instance deduplication, and storage writes before reporting save success. |
| `src/hooks/useJournalFilters.js` | Keep master | Query identity and lifecycle cleanup are present; keep stricter owner and deletion rules. |
| `src/hooks/useNarrationAutomation.js` | Keep master | Keep the shared provider predicate and single completed-reading narration owner; old literal provider checks would be incompatible. |
| `src/hooks/useNarrativeReadingController.js` | Keep master | Retired word-boundary removal is present; keep current reading identity and lifecycle behavior. |
| `src/lib/audio.js` | Keep master | Keep current provider normalization, provider-separated caches, neutral metadata, request cancellation, and object-URL cleanup. |
| `src/pages/AccountPage.jsx` | Keep master | Keep selectable narrators and owner-specific account erasure with truthful cleanup status. |
| `tests/mediaAvailability.test.mjs` | Keep master | Retirement and migration coverage is present; additional old-ID examples repeat the same default branch. |
| `tests/narrationStream.test.mjs` | Keep master | Keep explicit duplicate-request prevention for both current providers and legacy saved IDs. |
| `tests/narrativeReadingModelUtils.test.mjs` | Keep master | Playback and pause cases cover both narrators; keep newer source and card-identity tests. |
| `tests/speech-token.test.mjs` | Port assertion | Add the `cache-control: no-store` check to the existing GET/POST retirement test. Keep request/environment proxies, zero upstream calls, absent token, and unchanged allowance assertions. |
| `tests/tts-elevenlabs.test.mjs` | Keep master | Original transport, failure, abort, and accounting cases are present; keep newer provider isolation, shared-limit, refund, and concurrency coverage. |
| `tests/useNarrationAutomation.test.mjs` | Keep master | Keep both providers' ReadingContext ownership, streaming cases, and stable reading-key tests. |
| `wrangler.jsonc` | Keep master | Azure removal is present; keep current visual-job binding and migration, MCP access configuration, and schedule. |

## Verification

- `npm test`: 4,229 passed, two skipped, zero failed (4,231 tests in 527 suites). The pre-change baseline had the same totals.
- `node --test tests/speech-token.test.mjs`: three passed, including GET/POST cache headers and unchanged allowance accounting.
- Modified browser flows: all eight scoped cases passed across two runs, covering Chromium and WebKit at 1440px and 390px in dark and light themes. The initial matrix passed seven cases; WebKit at 390px in dark mode timed out waiting for “Deal spread,” before the new retired-endpoint assertion. Its trace records repeated Vite disconnect/reconnect events and page reloads while the root suite ran concurrently. Reload interference is supported by the trace; attribution to concurrent cache mutation is inferred. The exact failed case passed alone after the root suite finished (7.1 seconds), without source, assertion, or timeout changes. Preserve the initial failure and the rerun as separate evidence; this is not an uninterrupted eight-case pass.
- `npm run lint`, `npm run docs:check` (194 maintained Markdown files), and `git diff --check`: passed.
- The ledger contains exactly the 46 unique candidate paths. The 43 paths marked “Keep master” are unchanged from the target master.
- Primary preservation check: all 237 entries, HEAD, status, and index match the frozen snapshot. Bridge preservation check: all 133 dirty file hashes, HEAD, and status match the earlier recovery snapshot. The four existing bridge listeners remain owned by their original processes.

The complete logs, failed trace, rerun artifacts, and preservation manifests remain in the private review directory above. These documentation and test-only changes make no provider calls and require no deployment. Earlier live, device, and narrative qualification retains its original scope and date.
