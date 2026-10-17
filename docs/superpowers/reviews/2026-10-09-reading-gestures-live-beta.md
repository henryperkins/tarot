# Reading gestures: real development beta

The ordinary reading route now supports a fresh question, subscription-generated prose, independently generated visual cues, and the existing React companion. This is a local development beta, not a production release or full-deck semantic qualification.

## Run

From the reading bridge worktree:

```bash
npm run dev:reading-gestures
```

Open <http://localhost:5175/>. The separate local API/authentication origin is <http://localhost:8787/>. See [development setup](../../dev-reading-gestures.md) for the private reviewer login and storage boundaries. The normal reading and journal share a `DEV && VITE_READING_GESTURES` opt-in; production builds remain off even when that environment flag is set.

The runner selects Claude Opus 5.5/xhigh using the existing verified personal subscription. Visual annotation uses Workers AI `@cf/zai-org/glm-5.3-flash`, low reasoning, with a 60-second deadline and its supported JSON-schema envelope. These are separate requests. The narrative prompt is unchanged. No paid Anthropic/OpenAI credentials are loaded, and no production deployment or migration was performed.

## Implemented behavior

- Revealed cards remain available for whole-card inspection when annotations are missing, late, or translated. Availability is separate from narrated introduction; it does not fabricate cue timing or reveal undrawn cards.
- RWS accompaniment uses the matching vector-derived images. Unsupported artwork editions and other decks retain selected artwork and whole-card fallback.
- Held inspection survives text progress and narrative completion. The narrative and complete scenes preserve the same mounted reading; new source/revision resets still clear the old hold.
- Live and restored readings retain reflections by spread position, including duplicate cards. General context cannot become a card-specific note.
- The independent prompt supplies positions, orientations and optional notes, asks for exact non-overlapping quotations, and distinguishes literal evidence from interpretation and balance. Model-side schema constraints supplement the existing application validator.
- Shared development-server policy protects private state, dotenv files and authentication state on ordinary Vite, test servers and the beta. Canary HTTP tests cover regular, encoded, raw and `/@fs` paths, plus rejected arbitrary Host headers.

## Actual live evidence

[Result and source](../../../output/reading-motion/evidence/live-beta-2026-10-09/result.json) record a fresh question submitted through the normal app, real local password authentication, Pro entitlement, actual card draw, real narrative job, and independent visual transport. No reading, authentication or cue endpoint was mocked in that run. The created browser session was logged out afterward.

Question: “How can I make steady progress on a creative project while leaving enough space to rest?”

Spread: Six of Swords upright (Past), Eight of Swords upright (Present), Ace of Pentacles reversed (Future).

The narrative contains 4,098 characters. The visual model returned eight accepted cues with zero validation rejections: three literal details and five interpretation returns. Examples connect carried swords to habits brought into the project, the blindfold to an unseen way out, and the offered pentacle to a project that has not taken root. Every quotation was checked against exact source offsets; the analyzed final raw text equals the delivered prose.

Polling observed prose completion at 42.853 seconds and the completed cue ledger at 57.193 seconds from starting interpretation. These are one local-run wall-clock observations, with approximately two-second polling granularity, not production latency estimates or measurements of where the reader was looking. The subscription path buffers prose. Late cues remain useful for visible passages and explicit inspection; this does not establish the hand-authored preview's exact six-moment timing.

The same run exercised a delivered interpretation cue, keyboard hold/release, a 390 × 844 phone viewport with no horizontal overflow, and reduced motion with zero running companion animations. No page errors were recorded. Headless Chromium and an emulated phone were used; service workers were blocked. Initial screenshots captured transitions before settlement and exposed navigation/shelf overlap. The companion now uses the existing measured header height. Separate desktop Chromium and emulated iPhone WebKit regressions wait for settled artwork, then verify header clearance, pointer access, decoded images and no overflow. [Desktop layout](../../../output/reading-motion/evidence/live-beta-2026-10-09/controlled-desktop-settled.png) and [phone layout](../../../output/reading-motion/evidence/live-beta-2026-10-09/controlled-phone-settled.png) are explicitly controlled replays with generic test prose, not additional live model runs.

Two earlier attempts are retained separately: one returned the local composer because Workers rejected `redirect: 'error'`; the transport now uses manual redirects and rejects every 3xx without following it. The second was interrupted by development Worker reloads during a concurrent build and is invalid latency evidence. Subsequent real-workerd synthetic probes passed success, chunked bodies, redirect rejection, stalled headers/body timeouts, and caller cancellation. Builds and code edits were paused during the successful live run.

The durable follow-up check logged in again, retrieved the owned completed snapshot and SSE without a capability token, and matched both to the exact D1 ledger. Its raw SHA, spread and context fingerprints match the browser source. The accepted inference record confirms the actual narrative model was `claude-opus-5-5` (41,820 ms). Visual request configuration selects GLM-5.3-Flash; the service's actual returned model identifier was not persisted and is not independently asserted. Server annotation batches took 1,903 ms and 12,658 ms. These server intervals are recorded separately from browser polling; clocks were not subtracted across hosts.

## Final checks

- Root Node suite: 3,217 tests passed across 515 suites. This does not include every Functions test or browser suite.
- Existing React bridge browser suite: 51 passed, including independent cue arrival and static journal restoration.
- Normal-route browser suite: 10 passed, including guest/mock-Pro transport, translated fallback, supported/unknown/non-RWS art, held inspection through completion, card-specific notes in live/restored readings, and desktop/phone header clearance.
- Controlled server acceptance: [handoff 9/9](../../../output/reading-motion/evidence/live-beta-2026-10-09/controlled-handoff-final.json), [persistence 4/4](../../../output/reading-motion/evidence/live-beta-2026-10-09/controlled-persistence-final.json). These use deterministic model responses; they are not live inference.
- Shared and beta Vite HTTP canary security regressions pass within the root suite. Synthetic workerd transport diagnostics separately covered redirects, body cleanup, timeouts and cancellation.
- Production build, maintained Markdown links (181 files), and diff checks passed. ESLint checked 69 changed JavaScript paths with zero warnings/errors; repository-ignored Vite/ESLint config files were imported/exercised by configuration tests rather than counted as linted.

The exact commands for the two browser lanes are:

```bash
npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs
npx playwright test --config output/reading-motion/live-reading.playwright.config.mjs
```

## Semantic limits

This single reading establishes the live application path. It does not qualify every card, language, relationship or model output. This sample did not emit cross-card relationship cues or explicit question-context metadata, and missed plausible later returns in the “Name one sword” and “Leave a breadcrumb” next steps. The earlier independent Star probe produced valid literal/interpretation/balance cues but grouped both physical pours into one literal cue instead of reproducing all six authored moments.

Full-corpus semantic review, real-device motion/performance measurement, broader provider latency/cost evidence, and bounded re-annotation after expired or failed attachment remain open. Auth coverage here is real local Pro plus separately labelled controlled guest/mock-Pro tests; it does not establish Plus, inactive subscriptions, or production authentication coverage.
