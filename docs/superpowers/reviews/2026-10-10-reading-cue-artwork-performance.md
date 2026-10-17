# Reading cue artwork and owned runtime preparation

Status: **structural resource budgets met on the integrated revision in emulation; Task 13 acceptance stays OPEN** because transfer/decode/memory/frame budgets need a physical mid-range handset baseline, which was not run. Measurements below are emulated engines on an owned optimized build, not device evidence.

## Owned local offline runtime

`scripts/dev-reading-cue-validation.mjs` exports `startReadingCueValidation({ host = '127.0.0.1', ports, privateDirectory, sourceHead, live = false, explicitProviders = null, budget = null })`, returning `{ origins, buildIdentity, ownedResources, close }`. Supply four distinct explicit nonprotected ports (`frontend`, `api`, `optimized`, `inspector`), an exact current HEAD, and a new/empty absolute private directory outside the checkout and dependencies. The inspector port is a reserved owned socket only; no inspector protocol or measurement is claimed. Existing beta settings and listeners remain untouched.

The source is an enumerated immutable allowlist in `scripts/lib/readingCueValidationSource.json`, not a recursive copy or mutable worktree server. Only listed regular files are copied. Private names, path escape and symlinks are refused; source bytes are rechecked across capture. Snapshot files/directories are read-only, and teardown checks integrity. The allowlist has a named version and byte digest in buildIdentity. After later Task 10/11/12/14 integration, review the new import/build paths, edit this exact path manifest and increment its version, then start a new snapshot/build/run. There is no runtime glob refresh or unreviewed source-directory expansion. New repaired source modules require this explicit reviewed allowlist update; copied Worker source is provenance only and is not executed by the offline scaffold. Approved public card faces may exist in the snapshot/build; this does not mean the browser downloaded them.

A detached child receives an explicit environment with private HOME/XDG/TMP/cache/log locations, no NODE_OPTIONS, proxy/provider/Cloudflare keys or inherited arbitrary VITE variables, and an empty owned dotenv directory. Vite config discovery and dotenv discovery are disabled. The frontend uses the existing development security primitive plus an HTTP allowlist; a resolved shared dependency root and owned generated optimizer files are permitted separately. The built actual app is served from its own bounded static file set. Auth/jobs/visual/generation requests fail at all offline API boundaries with 503/no-store before SPA fallback. `live:true`, explicit provider settings and budget objects fail closed.

Wrangler's real `getPlatformProxy` provisions an isolated local D1 with envFiles empty, remoteBindings false, a distinct database ID, and private persistence. It inserts only runtime identity metadata. Browser fixture requests are controlled transports and do not exercise this database or real authenticated application APIs. No migrations, reviewer credential reads, subscriber login checks, AI/provider calls or remote bindings occur.

The optimized validation build uses MODE `reading-cue-validation` plus the explicit gesture flag while DEV=false. Ordinary production keeps its existing gesture gate; DEV-only routes and timing probes remain DEV-only. The frontend fixture lane is separate from optimized actual-app lanes. Builds/caches/state never target checkout dist or beta directories.

Cleanup closes only owned listeners, disposes Vite/platform handles, stops owned detached process groups with bounded escalation, verifies snapshot and frozen optimized output hashes, and removes only the marked private directory. Startup exceptions, signals, late bind races and abrupt child death have dedicated tests. Caller-owned evidence and foreign listeners survive. Linux process-group behavior is the verified host contract; physical access/tunnels and other host platforms are unqualified.

Finalized optimized files are frozen at mode 0444 and their directories at 0555. Each served file must match its recorded output hash/size; changed, deleted or linked output fails with 503. Both listener identity endpoints verify the complete generated file set and permissions. Integrity failure is permanent for the run, including after bytes are restored, and cleanup reports `outputIntegrity` with any runtime failure. Startup `buildIdentity.outputIntegrity` is the before attestation; successful evidence requires the independent after lane/cleanup checks.

## Browser configuration

`output/reading-motion/reading-cue-remediation.playwright.config.mjs` uses explicit externally owned runtime manifests and lane selection: qualification, fixture, application or optimized. It has eight explicit Chromium/WebKit desktop/phone normal/reduced projects, `contextOptions.reducedMotion`, service workers blocked, workers=1 and retries=0. It owns no webServer and inherits no beta/base URL. Every run gets unique output/results/trace paths. Qualification additionally requires `CUE_QUALIFICATION=true`; real Pro remains excluded unless separate Task 8 authorization/preflight is available, and this offline scaffold rejects its opt-in.

All three top-level origins must exactly match the captured identity and one owned listener of the corresponding kind. The handshake attests the actual listener address/kind, serving DEV/PROD/MODE flags, optimized build flags, output digest and current integrity. Borrowed qualification verifies frontend kind before attachment and again on borrowed close. The config's global setup/teardown writes before/after `lane-integrity.json` for every selected spec; failed integrity or wrong listener makes the command fail, even if earlier individual tests passed.

`reading-cue-runtime-lane.spec.js` verifies the served snapshot and listener/build identity, actual matchMedia value, browser version, viewport and DPR. Those are emulation/configuration observations only. Existing specs that override media/viewport keep their explicit case values; qualification records and checks actual preferences after those overrides, and geometry records actual preferences/browser/project. Do not infer actual case settings from project names. Qualification borrows the immutable externally owned frontend; its cleanup does not stop the owner. Existing beta qualification behavior is unchanged when the new manifest is absent.

Before a complete repaired application matrix, route all scenario outputs through the run-owned directory, assert actual case preferences, record controlled API identity, and collect application network/animation evidence. Runtime identity probes alone do not qualify handoff/restoration/deck/layout behavior.

## Scaffold verification

The revised prescribed artwork/motion/runtime command has 20 pass and 0 fail; additional config/flag checks have 6 pass and 0 fail. Both scoped lint commands exit 0. Eight optimized and eight frontend configuration-only browser probes pass with actual matchMedia/runtime identity and zero retries. Swapped origins, consistently relabeled wrong-listener routing and borrowed wrong-frontend attachment are rejected. Mutation/deletion regressions invalidate delivery/identity/cleanup, and lane teardown invalidation is tested. The task workspace retains RED/GREEN logs, exact source/build/runner identities and owned cleanup. These results do not qualify the final repaired application or physical devices.

## Integrated-revision measurements (October 10, 2026)

Spec `e2e/reading-cue-artwork-performance.spec.js`, registered only in the optimized lane, ran on all eight projects (Chromium and WebKit; desktop and phone; normal and reduced motion) against the owned optimized build on the normal reading route, with mocked auth and narrative transports, zero retries: **24/24 passed** (6.3 min; runtime cleanup verified: child exited, source and output integrity intact, state removed). Run identity: worktree `rt-final-integrated-perf` (source digest `8d4fe088…`), runId `b22c4b59-b335-47b3-ada5-45e971ac0d80`. The journal fixture lane ran concurrently on the same host, so recorded timings carry that load. A first run failed 24/24 on a spec defect (its warm pass reused a transport fixture that allows one reading); the fixed spec gives the warm pass its own fixture while the page's HTTP cache persists.

**Asserted structural budgets (all projects, 3-, 5- and 10-card spreads):** only the drawn faces are requested (3/5/10 distinct WebP faces, cold); the warm pass requests nothing outside its drawn faces; no separately named gesture-detail registry, vector registry or SVG file is fetched; settled companion running animations 0; horizontal overflow 0. That registry check only catches separately requested files: the production build bundles the full detail registry (all 145 detail IDs) into the `MarkdownRenderer` chunk (about 159 KB), so whether shipping the whole registry in code meets the plan's "no full registry" intent is open. The bundling predates this work.

**Recorded, not asserted (emulated engines; random spreads, so byte totals vary with the drawn cards):**

| Spread | Cold face transfer (range over 8 projects) | Warm face transfer | Chromium cold JS heap / DOM nodes / layout time |
| --- | --- | --- | --- |
| 3-card | 573–1,022 KB | 0 KB (cache) | 15–21 MB / 2,011–3,664 / 24–33 ms |
| 5-card | 1,224–1,579 KB | 0 KB | 13–21 MB / 1,770–2,422 / 21–32 ms |
| 10-card | 2,704–2,932 KB | 0–299 KB (one project redrew a face) | 16–18 MB / 2,727–4,249 / 19–35 ms |

Cumulative layout shift over the whole guided flow (setup, draw, reveal, narrative) was 0.63–0.90 on Chromium desktop, 0.09 on Chromium phone with normal motion and 0.01 with reduced motion. This is a whole-session sum rather than the windowed CLS metric, but the desktop values are high and need a follow-up attribution; the qualification spec's prose-start drift budget (0 px) passed. WebKit reports 0 because it does not expose `layout-shift` entries: that is "not measured", not stability.

Raw per-project measurements: remediation workspace `post-integration/performance-summary.json` and the run's `results.json` attachments.

The optimized build initializes Sentry with the production DSN and 10% trace sampling (`src/main.jsx`), so these emulated runs were not network-isolated: they could send error events and sampled traces to the production Sentry project, and that traffic is included in the recorded page activity. This predates the remediation; block the Sentry host in the validation lanes (or disable Sentry in validation builds) before relying on further measurements.

## Open measurement gates

- Measured above in emulation: cold/warm 3/5/10-card face transfers, the separately-named registry/SVG fetch check, settled companion animations, horizontal overflow, Chromium heap/DOM/layout counters and a whole-flow layout-shift sum. Response cache headers and encodings are recorded per request in the raw results but not tabulated.
- NOT_RUN even in emulation: image decode/paint timing, long-reading memory growth, duplicated decoded layers, active RAF/WAAPI/CSS handle counts beyond the settled-companion check, held/offscreen/restored motion handles, frame and long-task timing, and windowed layout-shift attribution. WebKit metrics it does not expose stay unavailable, not inferred from Chromium.
- No transfer/decode/memory/frame numeric budget is set: those need an explicit device baseline. The required structural budgets (undrawn-card downloads 0, prose-start drift 0 px, horizontal overflow 0 px, automatic reduced/restored animations 0, hidden/offscreen motion handles 0) are met where measured: downloads, overflow and settled animations here; prose-start drift in the qualification spec; hidden/offscreen handles only in Node tests and the Chromium lifecycle lanes.
- Open finding: the whole registry ships in the `MarkdownRenderer` chunk (see above); high whole-flow layout shift on Chromium desktop needs attribution.

Actual physical iPhone Task 15, a physical mid-range handset baseline, an approved isolated device-reachable HTTPS origin, secure-cookie/auth verification and real Pro checks: NOT_RUN. Emulation/high-end device observations cannot close the broad handset gate. Production cue/gesture gates, migration 0036 and DO rollout remain closed.
