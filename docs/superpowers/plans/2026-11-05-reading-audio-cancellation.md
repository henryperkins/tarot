# Reading Audio Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep rapid card reveals and cancelled audio requests from blocking narration of a completed reading.

**Architecture:** Enable incoming Worker cancellation events and protect the complete reservation lifecycle, including acquisition and final accounting, with the existing Worker execution context. Coordinate buffered card announcements in the audio controller so a new reveal does not abort an active synthesis; give completed-reading narration priority over queued announcements. Preserve the current streaming player, provider selection, quota model, and crash-recovery lease.

**Tech Stack:** React hooks, ESM JavaScript, Cloudflare Workers and D1, Node test runner, sql.js, Miniflare/workerd, Playwright.

**Spec:** [Remediation design and acceptance criteria](#remediation-design-and-acceptance-criteria), embedded below. Tasks 1–4 were initially authorized for native implementation with one independent final review. After local integration and verification, the user explicitly authorized the remaining Task 5 release work, including commits, pushes, deployment, and bounded Deepgram live verification.

**Status:** Tasks 1–5 are complete with the coverage limits recorded below. Audio source commit `2d21f349` is deployed as Worker `35b897e5-7962-411a-abd7-4cc40090a874`, serving 100% of traffic with `enable_request_signal`. Live guest UI, Deepgram playback, cancellation cleanup, accounting, and asset verification passed. The user reported that the requested signed-in Pro/physical iPhone flow worked; the exact iPhone model and iOS version were not supplied. Browserbase cloud verification was unavailable because its browser-minutes allowance was exhausted; local Chromium exercised the live guest checks instead. Live ElevenLabs was not exercised. Original implementation baseline: `6e4d15bf`; integrated baseline: `216e157d`.

## Global Constraints

- Keep `compatibility_date: "2025-11-24"`; add `enable_request_signal` beside `nodejs_compat` without an unrelated compatibility-date upgrade.
- Keep the 120,000 ms synthesis deadline, 180,000 ms reservation lease, 64,000-character request cap, and 1,900-character synthesis pieces.
- Keep one active server narration per identity and the existing Free/Plus/Pro monthly allowances and abuse protection.
- Keep Deepgram as the default and preserve explicit ElevenLabs selections. Never silently switch providers or automatically repeat synthesis after failure.
- Preserve paid ElevenLabs partial-audio accounting: any observed nonempty paid audio settles one unit; failures before paid audio release it. Successful complete Deepgram narration settles one unit.
- Test with fake providers and isolated databases. Never use production credentials, private readings, or paid inference in automated tests.
- Preserve unrelated checkout files and the Git index. Implementation, commits, publication, and deployment require their own authorized scope.

## Review Focus

- A disconnect during reservation acquisition, or an INSERT that commits and then rejects, must retain the attempted reservation ID for cleanup and must not start provider work afterward (Task 1).
- Paid audio and cancellation in the same turn, or a transient D1 failure after a commit, must resolve accounting once with the correct outcome (Task 1).
- Rapid reveals followed by a completed reading must create a bounded request sequence and prioritize the full reading (Task 2).
- Stop, voice-off, provider change, reset, or unmount must invalidate queued work and late events without restarting speech (Tasks 2 and 4).
- Another tab's active narration, expired leases, and permanent accounting failure must produce truthful errors while preserving concurrency and quota guarantees. A busy error must not dispatch queued speech; waiting and recovery messages must be visibly rendered (Tasks 1–4).

## Evidence and limits

The preceding live investigation observed cancelled buffered `POST /api/tts` requests followed by repeated `409 NARRATION_BUSY` responses, including completed-reading requests with `stream=true`. The associated signed-in Pro reservations had unlimited monthly allowances and remained reserved after cancellation. The same pattern occurred around 05:46 and 12:13 UTC on November 5, across two deployed versions. A separate short Deepgram request returned HTTP 200 and MP3 bytes in 1.7 seconds; that proves generation for that probe, not phone playback.

The baseline source explains the request sequence: `useTarotState` calls `speak()` for individual reveals, and `speakText()` aborts its predecessor before issuing a replacement. The server rejects a replacement while the predecessor's reservation remains active. Expiry is lazy: the next request after the three-minute lease releases the abandoned reservation. A row remaining reserved after expiry does not establish that expiry recovery is broken.

The baseline also had two caller gates requiring adjustment: `ReadingContext` discarded pending automatic full-reading narration when any narration was busy, and the manual handler/control model treated card narration as though it were full-reading playback. Tasks 2–4 now distinguish those narration contexts.

A read-only inspection of active Worker version `146f4a51-3ea8-45a0-a2c1-9e84d650fb30` confirmed compatibility date `2025-11-24` and flags containing only `nodejs_compat`. Incoming disconnect events require `enable_request_signal` at that date. The router already supplies `waitUntil`, but the TTS handler does not use it. Together these gaps explain why Node-level abort tests can pass while actual Worker cancellation leaves a reservation behind. [Cloudflare incoming cancellation documentation](https://developers.cloudflare.com/changelog/post/2025-05-22-handle-request-cancellation/), [compatibility-date behavior](https://developers.cloudflare.com/changelog/post/2026-11-02-request-signal-default/).

`waitUntil` can protect cleanup for up to 30 seconds after disconnect; it cannot turn the 120-second synthesis deadline into guaranteed background runtime. Cancellation must unblock local waits promptly. The lease remains recovery for a crash or unavailable database. [Cloudflare execution-context documentation](https://developers.cloudflare.com/workers/runtime-apis/context/#waituntil).

The subsequent read-only review of the same baseline found three additional gaps:

- An isolated SQLite probe committed the reservation INSERT and then rejected its call. The first request returned `503 ACCOUNTING_UNAVAILABLE`, the follow-up returned `409 NARRATION_BUSY`, and usage remained `used=0, reserved=1` with zero provider calls. `reserveNarration` lost the attempted ID on that baseline error path.
- An isolated audio probe confirmed that `speakText()` resolves normally after emitting `NARRATION_BUSY`. Promise resolution alone cannot authorize queue advancement after an error.
- Source inspection found that `NarrativeStatusStack` enables custom status messages only for errors and mounts `NarrationError` only for tier limits. Queued loading text and any separate busy hint require explicit wiring to a visible surface.

The review ran `node --test tests/narrationAccounting.test.mjs tests/narrationReliability.test.mjs tests/tts-elevenlabs.test.mjs tests/audioReliability.test.mjs tests/audioLifecycle.test.mjs`: 78 passed, zero failed or skipped. These are existing baseline tests and isolated Node/SQLite probes, not verification of the proposed remediation, real Worker disconnects, browser playback, or physical devices.

## Remediation design and acceptance criteria

### Server lifecycle

Register one deferred lifecycle promise with `waitUntil` before reservation acquisition can write. Install the cancellation gate before acquisition, attach any accepted reservation even if cancellation occurred during its INSERT, and check cancellation before dispatching synthesis. Keep the lifecycle pending until terminal accounting and listener/timer cleanup finish, including after returning a streamed response.

Retain the attempted reservation ID when an INSERT rejects with an uncertain commit outcome. `reserveNarration` returns its existing `ACCOUNTING_UNAVAILABLE` denial with an internal optional `reservation: { id }` identifying that attempted INSERT. The handler attaches this candidate before branching on `allowed`, then releases that exact ID under the protected lifecycle before returning the denial. Presence of an ID is not admission: only `allowed: true` permits synthesis. The existing `id = ? AND state = 'reserved'` guard makes release safe when the INSERT did not commit or cleanup already succeeded. Never repeat the INSERT, release by identity, or expose this internal candidate in the public error payload. Admission cleanup uses the same single terminal operation and bounded finalization retries as accepted reservations.

Cancellation signals stop work; they must not call finalization early. Choose the settlement/release outcome only after in-flight audio reads have recorded paid bytes. Keep finalization idempotent across caller abort, stream cancel, deadline, body failure, and buffered-response failure. Retry only the same idempotent D1 finalization, at most three attempts with 100 ms then 300 ms delays; never retry synthesis. Report permanent cleanup failure using an opaque reservation ID, provider, and stage, without reading text, account details, credentials, or upstream error bodies.

Workers AI cannot guarantee cancellation of an already-running `AI.run()` call. Stop awaiting it through the existing cancellation race, prevent later pieces, and cancel any body that arrives late. Do not claim that the remote inference itself stops immediately.

Acceptance: with healthy local D1, actual HTTP disconnects resolve accounting within five seconds and admit a subsequent same-identity narration without waiting for lease expiry. After a committed-then-rejected INSERT, healthy cleanup releases the attempted reservation without provider dispatch, with or without caller cancellation; the next same-identity request is admitted. An INSERT that did not commit cannot release another request's active reservation. Transient finalization failure still resolves once; permanent D1 failure during admission cleanup or later finalization remains observable and retains lease-based recovery. No migration, reservation bypass, or new Durable Object is planned.

### Client coordination

Keep coordination at `useAudioController`, the application's sole production caller of `speakText()`. Use a small independently tested helper rather than restructuring the streaming player.

| Situation | Proposed behavior |
| --- | --- |
| First individual card reveal | Start its buffered narration normally. |
| More reveals while that request is pending | Keep only the latest pending card announcement; do not abort the active request. Superseded queued announcements make no API request. |
| Completed-reading narration requested during a pending card request | Replace the pending card announcement with the full reading. After the active buffered request succeeds, start the full reading once; an active-request failure follows the failure rule below. |
| Card reveal during a pending, playing, or paused full reading | Do not interrupt the full reading or queue announcements behind it. |
| Explicit Stop, voice-off, provider change, reset, or unmount | Clear queued work immediately, invalidate late events, and use the existing stop/cancel path. Nothing restarts automatically. |
| Same-identity contention from another tab or a just-cancelled request | Clear pending card/full-reading work and its waiting overlay, preserve the busy error, and display the manual retry hint. Resolve discarded queue promises without dispatch. Only a fresh explicit Play action retries the discarded full reading. |
| Active request fails with a quota, rate-limit, accounting, provider, body, playback, or autoplay error | Clear pending work and its waiting overlay, resolve discarded queue promises without dispatch, and preserve the distinct error/recovery state. No failure automatically advances or retries the queue. A later explicit request remains possible. |

Do not infer network completion from `status: 'playing'`: progressive full-reading audio can still be downloading. The coordinator may use the existing promise to serialize buffered card responses, but must retain its full-reading priority through the actual terminal playback/reset state. Keep `speakText()`'s public resolution semantics and MediaSource backpressure intact.

Promise fulfillment is not a success signal: `speakText()` resolves after reporting HTTP and playback failures. Feed raw player notifications to `updateState(ttsState)` before projecting queued UI feedback, and associate the outcome with the active coordinator generation. An `error`, `unlock-failed`, or rejected `speak` promise clears queued work under the failure rule; `idle`/`stopped` cancellation states never authorize a drain. The internal `stopped` notification with `reason: 'replaced'` emitted while starting the next speech is not a user cancellation and must not invalidate that newly dispatched generation. Advance only after a successful buffered request has resolved, with no failure or invalidation for that generation. Do not hide an active card's terminal error as an obsolete notification. Discarded automatic requests remain consumed by the existing once-per-reading guard; later state changes must not silently resubmit them. A new reading/reset can still use the ordinary automatic-narration flow.

Automatic narration must submit the completed screened text to the coordinator once even while a card is busy, rather than discard that pending reading. The completed-reading Play control stays available during card narration and queues the full reading; Pause/Resume apply only when the active context is `full-reading`. A repeated automatic/manual request for the same pending full reading must not create duplicate synthesis.

Acceptance: a burst of five reveals with the first response held dispatches one active request and at most one latest pending card request; if a full reading arrives first, it replaces that pending card request. If the held request returns `409 NARRATION_BUSY` after the full reading is queued, the POST count remains one until explicit manual Play, every discarded queue promise resolves, and the busy error replaces the waiting feedback. Other active-request failure classes also dispatch zero queued POSTs. The ordinary reveal-to-reading flow produces no client-induced busy response, stale playback, or queue growth.

### Error behavior

Map only HTTP 409 with `errorCode: 'NARRATION_BUSY'` to: **“Another narration is finishing. Please wait a moment, then try again.”** Preserve `Retry-After` as a validated positive integer in `ttsState.errorDetails.retryAfterSeconds`; use two seconds if missing or invalid. The hint is not a promise that a long narration in another tab finishes within that interval. Keep quota, rate-limit, provider, interrupted-body, and autoplay errors distinct. Keep queued full-reading feedback within the existing loading state with: **“Finishing card narration before your reading…”**

The hook projects queued feedback as `status: 'loading'`, `context: 'full-reading'`, and `reason: 'waiting-for-card'`, without changing the raw player state. `NarrativeStatusStack` must enable `NarrationStatus`'s message display for this reason as well as errors, so the exact waiting text is visible. Render the busy message and its manual retry hint in `NarrationStatus`, the existing surface that is mounted for general errors. Use **“Use Play to try again after at least {n} seconds; another narration may take longer.”**, with the validated interval and singular `second` when `n` is one. Keep `NarrationError`'s tier-limit/upgrade presentation separate; it is not the busy-error target. Do not add a countdown, automatic retry, or delayed POST. Browser assertions must inspect the visible text, not only `ttsState` or screen-reader announcements.

## File map

| Files | Responsibility |
| --- | --- |
| `wrangler.jsonc` | Enable incoming cancellation events. |
| `functions/api/tts.js` | Protect acquisition-through-finalization lifetime and terminal accounting. |
| `functions/lib/ttsLimits.js` | Retain the attempted reservation ID on uncertain acquisition failure; preserve atomic reservation/lease behavior and guarded idempotent finalization. |
| `src/lib/narrationCoordinator.js` (new), `src/hooks/useAudioController.js`, `src/contexts/ReadingContext.jsx`, `src/hooks/narrativeReadingModelUtils.js` | Bound card work, submit automatic narration once, and make completed-reading controls distinguish card playback. |
| `src/lib/audio.js` | Preserve busy details and classify failures without changing player behavior or promise resolution semantics. |
| `src/components/NarrationStatus.jsx`, `src/components/reading/narrative/NarrativeStatusStack.jsx` | Render queued-loading text and busy/manual-retry feedback in the visible status surface; preserve tier-limit presentation. |
| `tests/narrationWorkerLifecycle.test.mjs`, `tests/helpers/narrationWorker.mjs` (new) | Real HTTP disconnect tests with isolated workerd, D1, and fake providers. |
| `scripts/lib/readingCueValidationSource.json` | Include the new public coordinator module in the existing frozen-source runtime allowlist. |
| `tests/narrationCoordinator.test.mjs` (new), existing audio/accounting tests | Deterministic ordering, cancellation, quota, and accounting regressions. |
| `e2e/narration-cancellation.spec.js`, `playwright.narration.config.js` (new), existing narration harness | Targeted browser reproduction and lifecycle regression coverage. |
| `docs/narration-safeguards.md`, this plan | Final behavior, verification evidence, and outstanding device/release checks. |

## Task 1: Repair Worker cancellation and reservation cleanup

**Interfaces:** `onRequestPost({ request, env, waitUntil }) -> Promise<Response>` consumes the router's existing bound `waitUntil`. `reserveNarration`, `settleNarration`, and `releaseNarration` retain their existing call signatures and SQL guards. Extend only the internal denied acquisition result for an uncertain INSERT with optional `reservation: { id }`; the existing `allowed: false`, status, and public payload remain intact. Attach this candidate before the handler's denial branch and release it through the shared terminal operation. The deferred lifecycle belongs to the request and survives a streamed handler return; it must not resolve at response-header delivery.

- [x] Add failing deterministic tests for abort during committed-but-not-yet-returned reservation acquisition, pre-aborted requests, cancellation before provider headers, cancellation during buffered assembly, and cancellation during streamed audio. Assert no provider dispatch after cancellation during admission, and no subsequent synthesis piece after cancellation.
- [x] Add acquisition-failure regressions that reject the INSERT both before and after commit, with and without caller cancellation. Assert an uncertain failure retains the attempted ID internally, returns the existing safe accounting denial when the caller remains connected, and releases only that ID once cleanup is healthy. For the committed case assert `used=0, reserved=0`, zero provider calls, no repeated INSERT, and an admitted follow-up. Separately keep another request's reservation active and prove cleanup of a failed candidate cannot release it.
- [x] Add accounting tests for simultaneous paid-byte/cancel events and transient finalization failure before and after a D1 commit. Assert `used` increments zero or one as specified, `reserved` returns to zero, and repeated terminal events cannot change the selected outcome. For permanent failure, assert bounded attempts, safe reporting, and later lease recovery.
- [x] Create `createNarrationWorkerFixture(options)` in `tests/helpers/narrationWorker.mjs`, returning `{ url, db, provider, close }`. Use installed esbuild/Miniflare patterns, actual local D1 triggers from migration 0034 with prerequisites, deterministic provider barriers/counters, and an actual listening HTTP URL. Block/intercept all external network access; fake both Worker-side `AI.run()` and ElevenLabs fetch.
- [x] Add socket-level tests in `tests/narrationWorkerLifecycle.test.mjs` using `node:http` and `request.destroy()` before provider headers for both response modes. For buffered partial-audio cancellation, use a deterministic provider barrier to confirm the Worker consumed nonempty upstream bytes while that body remains open, then destroy the client socket before HTTP response headers. For streamed partial-audio cancellation, destroy the socket after the client receives the first audio bytes while synthesis remains active. Assert the appropriate paid/unpaid outcome, observe D1 directly until cleanup completes, then send one follow-up narration. A buffered disconnect after HTTP response bytes is not partial-synthesis evidence: that route returns JSON only after assembly and accounting finish. Do not substitute `dispatchFetch()` with a manually aborted signal for real disconnect proof.
- [x] Run the new tests before implementation and retain failures showing the missing flag/lifetime behavior. Run `node --test tests/narrationWorkerLifecycle.test.mjs tests/narrationAccounting.test.mjs tests/narrationReliability.test.mjs tests/tts-elevenlabs.test.mjs`.
- [x] Add `enable_request_signal`, install the early cancellation gate, and register the deferred lifecycle before acquisition. Await acquisition under that lifetime even when the caller leaves; attach and release a late accepted reservation before returning. Share terminal accounting across stream/buffer paths without changing paid-byte policy.
- [x] Retain uncertain INSERT ownership in `functions/lib/ttsLimits.js` and attach the returned candidate before the handler checks `allowed`. Route denial cleanup through the same guarded release and terminal promise as accepted reservations; only `allowed: true` can reach a provider. Do not perform separate competing cleanup inside `reserveNarration`, retry admission, expose the candidate ID in the public payload, or release another request by identity.
- [x] Implement the bounded D1 finalization attempts inside the single terminal operation. Interrupt local provider waits promptly; do not wait for an uncancellable binding or an upstream cancellation promise to finish before cleaning up accounting.
- [x] Rerun the command above. Expected: every new case passes; socket-disconnect cleanup completes within five seconds with healthy D1, including the paid ElevenLabs case, and the follow-up is admitted. Retain the 180-second crash-lease test separately with controlled time.
- [x] Check other incoming-signal consumers (`tarot-reading`, `reading-followup`, `journal-summary`, `generate-question`) because the flag applies to the whole Worker. Run their relevant existing cancellation tests and the root suite in Task 4; preserve background reading-job durability after a browser disconnect.

## Task 2: Coordinate card announcements and completed readings

**Interfaces:** Add `createNarrationCoordinator({ speak, onWaiting })` in `src/lib/narrationCoordinator.js`. `speak(options) -> Promise<void>` is the injected existing `speakText` call, with the current text/enabled/provider/context/voice/speed/stream/emotion options; it may resolve after an error. `onWaiting(waiting: boolean) -> void` controls the hook's queued full-reading projection, setting the existing `reason` field to `'waiting-for-card'`. The helper returns `request(options) -> Promise<void>`, `updateState(ttsState) -> void`, and `cancelQueued({ preserveActive = false } = {}) -> void`. `updateState` consumes raw player notifications before any UI projection and records the active generation's outcome. Superseded, failed-queue, and cancelled queued requests resolve without dispatch; default cancellation invalidates queued requests and late state notifications. Internal `preserveAudio` housekeeping passes `preserveActive: true` to discard pending automatic work while retaining ownership of the active request; it does not abort or orphan a card fetch. The disabled-automation effect resets only on an actual settings-disable transition, not incidental reading-stream changes. Use ordinary Promise construction to support the existing Vite browser targets. `useAudioController.speak(text, context, emotion)` retains its public signature.

- [x] Write failing helper tests with deferred buffered responses: five rapid cards dispatch only first and latest; full-reading request replaces the latest pending card; a full reading starts exactly once after the active buffered request completes; cards cannot interrupt a loading/playing/paused full reading. Include the player's synchronous `stopped`/`reason: 'replaced'` notification before the next `loading` state and assert it does not invalidate the new dispatch or its full-reading priority.
- [x] Add model/hook/browser regressions for a reading completing while a card is loading or playing. Assert automatic narration is queued once instead of discarded, manual Play can request the full reading, card playback does not label that action Pause/Resume, and simultaneous automatic/manual requests do not duplicate the queued reading.
- [x] Add a regression with a held card request, a latest queued card, and then a queued full reading: emit raw `error`/`NARRATION_BUSY` and fulfill the active `speak` promise as the real player does. Assert only one POST until manual Play, no remaining queued work or unresolved queue promises, the waiting overlay clears, and the busy state remains visible. Exercise the same failure disposition for tier/rate/accounting/provider/body/playback errors, `unlock-failed`, and a rejected injected promise. Use the real hook/audio path for the busy case so a rejecting fake cannot conceal the player's normal fulfillment semantics.
- [x] Cover the five invalidation paths from Review Focus. Assert zero delayed POSTs after Stop, voice-off, provider change, reset, and unmount, including when an old request resolves afterward. Verify a successful cached card advances normally and a failed active request clears the queue without deadlocking later explicit requests or resubmitting a discarded automatic reading. Cover automatic narration already off and a true on-to-off transition followed by manual Play: both retain an active card request until completion. Verify narration still dispatches when `Promise.withResolvers` is unavailable.
- [x] Run `node --test tests/narrationCoordinator.test.mjs` and retain the initial failure.
- [x] Implement the helper and connect it to the hook's `speak`, subscription, stop, provider/voice effect, and reset/unmount paths. Capture provider/preferences per submitted request; cancelled work must not reappear through stale closures. Process raw player state before queued UI feedback and decide queue advancement from both the active generation's outcome and its settled buffered promise. Route queued feedback through `onWaiting`; mask ordinary card progress while waiting, but let an active card error clear the queue and restore the error surface. Ignore notifications from invalidated generations.
- [x] Change the automatic fallback gate in `ReadingContext.jsx` to hand completed text to the coordinator once when card narration is busy. Make `handleNarrationButtonClick` and `buildNarrativePanelModel` derive full-reading Pause/Resume/loading behavior from both status and context; keep an explicit full-reading Play action available during card narration. Preserve the existing once-per-reading and user-interruption guards.
- [x] Extend `e2e/helpers/narrationControllerHarness.js` only as needed to exercise the real hook and reset/unmount paths. Do not change reveal gestures, `Reveal all`, narration preference defaults, autoplay unlocking, or the completed-and-screened text requirement.
- [x] Run `node --test tests/narrationCoordinator.test.mjs tests/narrativeReadingModelUtils.test.mjs tests/audio.test.mjs tests/audioReliability.test.mjs tests/audioLifecycle.test.mjs tests/streamingAudio.test.mjs tests/narrationStream.test.mjs tests/useNarrationAutomation.test.mjs`. Expected: new ordering cases and existing streaming/cancellation/cache behavior pass without automatic synthesis retries.

## Task 3: Expose the busy error and recovery hint

**Interfaces:** Keep existing TTS statuses, `errorCode`, and `errorDetails`; add only optional `errorDetails.retryAfterSeconds` on a busy response. Consume Task 2's queued `loading` projection with `reason: 'waiting-for-card'`. `NarrativeStatusStack` enables `NarrationStatus` message display for errors and this waiting reason. `NarrationStatus` renders the busy message and validated manual retry hint; `NarrationError` continues to receive `ttsState` for tier-limit presentation. Reuse the existing manual Play action; no new retry endpoint or automatic POST loop.

- [x] Add failing audio tests for `409 NARRATION_BUSY` with valid/missing/invalid `Retry-After`, another unrelated 409, `429 TIER_LIMIT`, ordinary 429, provider 503, and interrupted streamed audio. Assert the exact proposed busy wording, default two-second hint, and unchanged classification of other failures.
- [x] Run `node --test tests/audioReliability.test.mjs tests/audioLifecycle.test.mjs` and retain the relevant failing assertions.
- [x] Implement the busy-specific mapping and header parsing in `src/lib/audio.js`. Keep the full underlying busy code and safe details available for diagnostics without changing promise resolution semantics.
- [x] Update `src/components/reading/narrative/NarrativeStatusStack.jsx` to expose the exact queued-loading message via `NarrationStatus` when `reason === 'waiting-for-card'`. Add the busy-only manual retry hint to `src/components/NarrationStatus.jsx`, using the validated interval and the copy specified above. Keep tier-limit/upgrade rendering distinct and avoid duplicate busy alerts. Task 4 must assert both messages on the visible rendered controls, not just in state.
- [x] Rerun the focused tests. Expected: contention is recognizable, Play remains a deliberate user action, and no quota-upgrade prompt appears for a Pro busy rejection.

## Task 4: Verify the complete local flow

**Interfaces:** Add `playwright.narration.config.js` selecting `narration-cancellation.spec.js`, `narration-defaults.spec.js`, `narration-lifecycle.spec.js`, and `media-narration-reliability.spec.js`. Use Chromium desktop, WebKit desktop, and WebKit iPhone emulation sequentially, zero retries, and the existing Vite fixture conventions. Keep all provider calls fake. Run the root Node suite before starting the browser watcher to avoid dotenv-triggered Vite restarts.

- [x] Add a browser regression that enables Reader voice, reveals five cards rapidly while the first audio response is held, and requests the completed reading. Assert the exact visible text “Finishing card narration before your reading…” during the wait, first-card then full-reading request order, no intermediate card POSTs, no client-induced busy errors, one complete reading request, and advancing audio playback time.
- [x] Add a second-tab busy fixture with a full reading already queued behind the held card response. Return `409 NARRATION_BUSY` for the card, then verify the exact visible busy message and manual retry hint replace the waiting text, no upgrade prompt appears, and only one POST occurs until explicit Play. Release the other tab's reservation, click Play, and verify successful admission. Check valid/missing/invalid retry intervals in the rendered hint. Cover Stop, reset, provider switching, voice-off, queued-work unmount, and a delayed stale response. Use labeled auth/tier fixtures for deterministic failure cases.
- [x] Run `npm test`, changed-file ESLint, `npm run build`, and `npm run docs:check`. Expected: passing root suite, valid production build and maintained links, and no unrelated diff. No narrative text or prompt changes are planned; if implementation expands into those paths, apply their repository quality gates rather than assuming audio checks cover them.
- [x] Run `npx playwright test --config playwright.narration.config.js`. Expected: all selected cases pass in all three configured browser profiles, with no external provider traffic. Collect request counts and inspect captures of waiting/busy controls at desktop and 390 px; include 320 px if copy wraps or controls become occluded.
- [x] Exercise the same flow against the local Worker as guest and the real active Pro reviewer, using the private credential file directly and logging out afterward. Verify the real Pro session through `/api/auth/me`; intercept only reading-generation/audio responses with deterministic fixtures to avoid inference. Keep credentials restricted to the documented local origin. Record this as authenticated browser coverage with mocked media; Task 1 supplies the separate real-runtime/backend evidence.
- [x] Document that Chromium/WebKit emulation is browser evidence. Physical iPhone Safari audio unlocking, backgrounding, and interruption behavior remain a separate device check.
- [x] Obtain an independent whole-diff review focused on lifetime races, accounting, queue invalidation, global flag effects, and paid-call repetition. Resolve material findings with targeted regression checks.
- [x] Update `docs/narration-safeguards.md` with the final queue behavior, cancellation flag, cleanup limits, retry policy, and retained crash lease. Record exact checks and unresolved limits in this plan. No synthetic test result counts as live synthesis or device proof.

## Local verification record — November 5, 2026

Tasks 1–4 were implemented in an owned detached worktree at baseline `6e4d15bf64ea8a00883494424dab3e129a7086df`. The verified 25-file candidate is copied to the primary checkout without staging. The original index and unrelated critique are hash-protected; every other tracked primary file is compared with the initial preservation manifest. The implementation ledger, RED/GREEN logs, review snapshot, and final verification manifest are retained locally in `.superpowers/sdd/2026-11-05-reading-audio-cancellation/` within `.worktrees/audio-cancellation-20261105`. These are local evidence, not publication or live-provider proof.

| Check | Recorded result |
| --- | --- |
| Task 1 focused command listed above | 81 passed, zero failed. Includes eight actual TCP-disconnect cases using direct workerd HTTP sockets, real isolated D1 triggers, and fake Deepgram/ElevenLabs providers. Each requires cleanup within 4.5 seconds and an admitted follow-up request. |
| Task 2 combined coordinator/model/audio/automation command, after review fixes | 121 passed, zero failed. Covers bounded ordering, fulfilled-error handling, full-reading priority, invalidation, cache behavior, preserved active ownership, and absence of `Promise.withResolvers`. |
| Task 3 audio lifecycle/reliability and model regressions | 68 passed, zero failed, including busy-only classification and validated retry intervals. |
| `npm test` (final run) | 6,337 passed, two skipped, zero failed; 6,339 tests total. The two skips are existing opt-in installed CLI/app-server integration checks. Other incoming-signal and durable reading-job regressions are included in this root suite. |
| Changed-file ESLint | Passed for all 21 changed JavaScript/JSX/MJS files. |
| `npm run build` | Passed; production build completed in 10.34 seconds. |
| `npm run docs:check` | Passed in the implementation worktree (245 maintained Markdown files) and primary checkout (249 maintained Markdown files). |
| `npx playwright test --config playwright.narration.config.js` | 105 passed in 9.8 minutes: 35 Chromium desktop, 35 WebKit desktop, 35 WebKit iPhone-emulation cases; one worker, zero retries. |
| Built local Worker authenticated browser flow | Real guest and active Pro sessions verified through `/api/auth/me` at `http://localhost:8787`; synthetic generation/audio only. Both sent exactly `[card-reveal, full-reading]`, visibly showed waiting, exposed Pause, and advanced playback. Pro logout returned 200. Owned Worker stopped and private task-created database copy removed. |
| Render inspection | Viewed desktop and 390 px waiting/busy captures plus 320 px waiting/busy captures. New copy fits/wraps within the status surface; 320 px overflow assertions pass. |

Commands ran through a local environment allowlist that removes inherited provider credentials. The root suite finished before the browser watcher started. No paid inference, private reading, production credential, reservation bypass, migration, or new Durable Object was used. The browser log contains a refused localhost health probe during a profile transition; it was not a provider call, and all media/request/control assertions passed.

RED evidence is retained for acquisition/lifetime failures, coordinator/model gates, busy mapping, and both final review findings. A run of the final real-socket fixture against the pristine baseline failed its 4.5-second cleanup assertion; the candidate then passed all eight socket cases. Transient D1 failures before/after commit, uncertain reservation INSERT outcomes, simultaneous paid-byte cancellation, bounded permanent failure, safe reporting, and the unchanged 180-second crash lease have deterministic regressions.

One independent whole-diff review found two P2 issues, both resolved with author RED→GREEN checks and the final root/browser runs: preserving audio had orphaned active coordinator ownership, and `Promise.withResolvers` exceeded the configured browser target floor. The helper now retains ownership for internal preserving resets, automation housekeeping is transition-aware, and ordinary Promise construction supports the existing targets. No confirmed material or minor product finding remains deferred. Per the authorized native workflow, one independent review was used; no second review or commit was created.

Integration decisions stayed within audio scope: interpretation preparation preserves an active card instead of cancelling it; the frozen-source runtime allowlist adds exactly the new coordinator module; existing browser fixtures use the current Settings link and confirm the unsaved-reading dialog before asserting reset. Narration text, prompts, reveal gestures, preference defaults, player resolution semantics/backpressure, provider choice, quotas, and timing/size constants are unchanged.

Remaining qualification limits are explicit: direct TCP reset proves the local workerd TTS disconnect path, not every edge/proxy transport; the other signal consumers have source inspection and existing regressions rather than this new socket matrix. Workers AI remote stop timing and unobserved provider-side paid bytes cannot be guaranteed. Chromium/WebKit emulation and mocked-media authentication are not physical iPhone Safari, live synthesis, deployed-flag, or production reservation evidence. Physical unlocking, backgrounding/interruption, production generation/accounting, and release identity checks remain in Task 5.

## Integration verification — November 5, 2026

The user authorized finishing the candidate against current `master` and verifying it locally, with publication remaining separate. Live GitHub HEAD and a fresh fetch both identified `master` at `216e157dfafa69c70822e018260a8f380272d1ed`. Integration used the managed detached worktree `/home/ubuntu/.codex/worktrees/c991/tarot`; the original audio worktree and its evidence remain preserved.

A verified recovery archive at `/home/ubuntu/.cache/tableu-audio-integration-20261105-98tkztxr` contains all 26 originally dirty/untracked primary files, the original index, and a manifest covering 3,544 tracked paths. The 25 audio candidate files matched the original detached worktree byte for byte before integration. The only shared path with the six incoming commits, `scripts/lib/readingCueValidationSource.json`, applied cleanly and retains the newer manifest entries alongside `src/lib/narrationCoordinator.js`.

| Fresh integration check | Result |
| --- | --- |
| Credential-free `npm test` | 6,390 passed, two existing opt-in skips, zero failed; 6,392 tests total. |
| Actual HTTP-disconnect regressions, included in the root suite | All eight passed with isolated D1 and fake Deepgram/ElevenLabs providers, timely reservation cleanup, correct observed-audio accounting, and admitted follow-up requests. |
| Changed-file ESLint | All 21 changed code files passed; the subsequently corrected browser fixture also passed its targeted lint check. |
| `npm run build` | Passed in 10.41 seconds. |
| `npm run docs:check` | Passed for 240 maintained Markdown files before this record; checked again after the documentation update. |
| Full narration browser matrix | 104 passed and one failed in 9.3 minutes, across the three configured profiles with one worker and zero retries. The failure and its correction are described below. |
| Corrected duration fixture, separate targeted rerun | Three passed: Chromium desktop, WebKit desktop, and WebKit iPhone emulation; one worker, zero retries. |
| Built local Worker guest and real active Pro flow | Both real sessions verified through `/api/auth/me`; synthetic media/generation produced exactly `[card-reveal, full-reading]`, visible waiting, Pause, and advancing playback. Pro logout returned 200. |
| Render inspection | Desktop and WebKit iPhone-emulation waiting/busy captures at 390 px and 320 px were viewed; recovery copy wraps within the status surface, and the existing overflow assertions passed. |

The sole browser failure was `stream duration stays indeterminate until a finite length is available` on WebKit iPhone emulation. Its fixed 50 ms wait sampled the preceding unknown-duration render after scheduling the finite-duration render. The progress component is unchanged. The fixture now waits for React's layout-effect commit before inspecting the DOM; its time, percentage, and ARIA assertions remain intact. The original failed trace/capture and full matrix log are retained, followed by the successful three-profile targeted rerun. These are combined passing evidence for all 105 selected profile/case combinations, not a single uninterrupted 105/105 run. The other 104 cases were retained because this correction changes only synchronization within the failed fixture.

The product code checked by the root suite, build, socket tests, browser matrix, and authenticated flow is identical; the fixture synchronization and this documentation were updated afterward. The completed independent implementation review and its recorded RED/GREEN fixes are retained. Integration required no further audio product-code changes, dependency changes, or narrative/prompt changes.

Authenticated verification used a private copy of the local reviewer database; the incoming preferences migration was applied only to that copy. The local Worker configuration omitted AI, email, remote provider credentials, and tail bindings, and the browser intercepted generation/media with deterministic responses. The verified task-owned Worker was stopped and the private database copy removed after logout. The browser matrix log includes refused loopback health probes after that Worker stopped; these were not provider requests or failed media/control assertions.

The integration ledger, exact source hashes, logs, failed browser evidence, and targeted rerun are retained under `.superpowers/sdd/2026-11-05-reading-audio-cancellation/` in the managed worktree. At this integration stage, production generation/accounting, deployed cancellation flags, edge transports, and physical iPhone behavior were pending Task 5. The subsequent release results are recorded below.

## Task 5: Prepare and verify an authorized release

The user explicitly authorized this release stage after reviewing the completed local integration. The normal deployment entrypoint must still pass its fresh release QA before production changes. Live ElevenLabs usage requires separate explicit provider authorization and remains outside this release's live probe scope.

- [x] Prepare a concrete scoped diff and final local evidence; preserve the unrelated critique file and any newly discovered dirty work. If isolation is needed, use an owned worktree and verify the final source being released.
- [x] When publication/deployment is authorized, run the repository's required release checks and `npm run deploy:dry-run` before `npm run deploy`. Use local verification on the subscription-authenticated host. GitHub Actions billing is unavailable; missing subscription access must not trigger paid narrative fallback.
- [x] Record source/remote SHA, active Worker version and traffic, deployed `enable_request_signal`, and matching live frontend assets separately. Verify that dashboard-managed settings and provider secrets were preserved.
- [x] Perform a bounded live guest smoke test with synthetic text and sufficient allowance: complete Deepgram narration, cancel a card request, then start a full reading. Verify actual MP3 delivery and browser playback, prompt reservation resolution, and no repeated 409 sequence. Exercise ElevenLabs only within explicitly authorized provider usage; otherwise retain its live lane as unverified.
- [x] Confirm real signed-in Pro behavior on production. The user reported that the requested Pro/iPhone flow worked; this is user-reported evidence, separate from the agent's local real-Pro authentication with mocked media.
- [x] Verify real cancellation did not debit a no-audio request and that partial paid audio consumes exactly one unit when that lane is exercised. Live Deepgram no-audio cancellation was verified; the unexercised live ElevenLabs partial-audio lane remains explicitly unverified. Do not expose credentials, account identifiers, or reading text.
- [x] Arrange a physical iPhone Safari check of rapid reveals, Listen, Stop/Replay, and background/foreground. The user answered “Yes, it worked” to the requested signed-in Pro/Deepgram iPhone check. Exact hardware/OS and per-step recordings were not supplied; retain this as user-reported device evidence.
- [x] Close the release with the named results and limits below. If a material regression appears later, inspect active production/process ownership and resource compatibility before choosing rollback; do not clear reservations wholesale, bypass accounting, or shorten the crash lease as a workaround.

### Release execution and live evidence — November 5, 2026

The exact 25-file audio implementation was committed and pushed to `master` as `2d21f349b032604cfec5f635120e32ce43f122b4`. Git publication required a command-scoped use of the existing valid `gh` login after the default credential path failed; all 46 new Git objects, fast-forward ancestry, and remote parity were checked. No force push or branch-rule change was used. The user's separate Impeccable hook installation and pre-existing critique remain local and were excluded from the audio commit.

Both `npm run deploy:dry-run` and Wrangler's actual packaging dry run passed. The first normal deployment attempt stopped before production changes when the owner's Claude subscription reported its five-hour limit. After the reported 10:30 a.m. America/Chicago reset, the unchanged normal release entrypoint passed its full fresh QA using the same subscription, Opus 5.5 model, and `xhigh` effort. No paid narrative API fallback or gate waiver was used.

| Release check | Observed result |
| --- | --- |
| Root tests | 6,390 passed, two existing opt-in skips, zero failed. |
| Deployment tests | 74 passed, zero failed. |
| Cloudflare command validation | 591 files passed. |
| Maintained Markdown links in release worktree | 241 files passed before upload. |
| Claude-subscription narrative qualification | All 11 samples generated; zero flagged samples; 100% narrative spine and card coverage. |
| Prompt assembly | 874 fixtures, 2,541 provider builds, 30 partial pairs, 10 complete triads, 525 canon/deck projections, and 12 boundaries passed. |
| Production migrations | Already applied; this audio release introduced no migration. |
| Production frontend build | Passed in 10.78 seconds. |
| Settings preservation | Deployment script verified existing variables, secrets, and monitoring settings; independent metadata reads retained 35 secret bindings and 62 plaintext/JSON variables. |

Worker deployment `af5b0f86-2d80-4a8d-90a3-2374037008cd` activated version `35b897e5-7962-411a-abd7-4cc40090a874` at 100% traffic at 10:50 a.m. America/Chicago. Compatibility date remains `2025-11-24`; deployed flags are `nodejs_compat` and `enable_request_signal`. The normal deployment command returned a nonzero result after publication because its hosted post-check was unavailable, as detailed below; the upload itself and settings verification succeeded.

Browserbase session creation returned HTTP 402 because the free-plan browser-minutes limit had been reached. No cloud session or UI run started, and the report has no cleanup errors. Billing was unchanged. As additional live functional evidence, the same guest checker and network guard were run in local Chromium against `https://tarot.lakefrontdev.com` at 1280×900 and 390×844. All four checks passed at both sizes: onboarding/exit, deck/spread selection, sign-in dialog open/close, and draw/deal/reveal. No page errors or unexpected failed requests were observed. This is a local browser against production, not a Browserbase cloud pass or physical-device result.

That check exposed one stale desktop fixture assumption: the current setup hides deck choices inside its Deck disclosure. The three-line runner correction opens that existing disclosure before testing the choices. Its original live desktop failure is retained, followed by passing checks at both sizes, all 11 Browserbase unit/guard tests, targeted ESLint, and whitespace validation. No application UI or deployed bundle changed for this correction.

The subsequent fresh root suite also passed 6,390 tests with two existing opt-in skips and zero failures. Final documentation checks passed for 241 maintained files in the release worktree and 295 in the primary checkout, including the local Impeccable installation. The follow-up changes only this evidence record and the guest smoke-test helper; deployed application, Worker, configuration, and dependency source remain identical to `2d21f349`.

Eight served JavaScript/CSS resources, including entry, reading, and narration bundles, match the release build byte for byte by SHA-256. The served index contains one identified Cloudflare JavaScript Detection script; after removing only that injected tag for comparison, the index exactly matches the build. Both raw and normalized hashes are retained. No Cloudflare challenge or security setting was changed.

The bounded real-guest Deepgram check made exactly three POSTs using synthetic text and SELECT-only accounting reads for its own identity:

| Request | Live result |
| --- | --- |
| Complete narration | HTTP 200, 50,256 MP3 bytes, advancing browser playback, one monthly unit settled. |
| Buffered card narration cancelled before audio delivery | Client `AbortError`, zero received audio bytes; reservation released in 274 ms, before lease expiry; zero monthly debit and no remaining reservation. |
| Full reading after cancellation | HTTP 200, 62,496 MP3 bytes, advancing browser playback, one monthly unit settled; no busy response or synthesis retry. |

Observed monthly usage moved from `used=1, reserved=0` to `used=3, reserved=0`: exactly two completed narrations were counted. The guest browser context was closed afterward. Playback used a temporary diagnostic gesture control; this proves delivered MP3 playback and the live backend sequence, while production rapid-reveal UI and physical Safari behavior remain part of the user's Pro/iPhone check. Remote Workers AI stop timing and unobserved provider-side work remain outside the guarantee.

All release logs, the unavailable Browserbase report, initial/corrected live guest checks, raw/normalized asset hashes, and the successful live accounting result are retained in the managed worktree's `.superpowers/sdd/2026-11-05-reading-audio-cancellation/`. Generated narrative samples and metrics were copied there and hash-verified before restoring only those task-generated tracked outputs. Original worktree evidence, unrelated files, the critique, hook installation, and stash remain preserved.

After publication, the user was asked to reload the live app on their signed-in Pro iPhone in Safari, use Deepgram with Reader Voice enabled, rapidly reveal cards and start the full reading, try Stop/Replay, and background/foreground the app. They replied **“Yes, it worked.”** This closes the requested user device check as a reported success. No exact iPhone model, iOS version, or per-step recording was supplied, so this is not agent-observed device instrumentation or certification of other iOS/browser combinations.

The release closes with two explicitly unverified live lanes: Browserbase cloud Chrome could not run because of its HTTP 402 allowance limit, and paid ElevenLabs usage was not separately authorized or exercised. The successful local Chromium checks against production, live Deepgram/D1 evidence, and user-reported Pro/iPhone result remain distinct. The follow-up test-helper and documentation commits require no additional Worker publication because application, Worker, configuration, and dependency source remain identical to deployed `2d21f349`.

## Execution boundaries and sequencing

Implement Task 1 first. Task 2 can then proceed alongside Task 3 with separate ownership of `useAudioController`/the new helper and `audio.js`/`NarrationStatus`/`NarrativeStatusStack`. Preserve their shared contracts: raw player errors reach the coordinator before UI projection, promise fulfillment alone does not permit queue advancement, and queued-loading feedback uses `reason: 'waiting-for-card'`. Serialize integration of their shared tests, then complete Task 4. Task 5 follows only within an authorized release scope.

Tasks 1–4 used native execution with one independent final review under explicit implementation authorization. Their local completion did not authorize publication by itself; the user's subsequent instruction to proceed with the remaining tasks explicitly authorized Task 5, commits, pushes, and deployment.
