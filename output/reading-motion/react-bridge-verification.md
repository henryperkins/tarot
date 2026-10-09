# Reading gesture React bridge verification

Verified October 9, 2026 on the feature branch `codex/reading-gestures-react-bridge`, using Node 24.21.0. The verified implementation checkpoint is `e373620` (final documentation follows in a separate commit). This handoff documents the application bridge and its development fixture route. The earlier standalone HTML studies and recorded source fixtures remain available. No production deployment or live narrative generation was performed.

## Scope and implementation

The bridge uses the existing `NarrativePanel`, Markdown renderer, reading context, spread companion, and artwork renderer. The study flag defaults to disabled. The fixture supplies explicit recorded sidecars and the `rws-immanuelle-vector` artwork edition; ordinary readings keep functional prose and card inspection without requiring sidecars.

Raw text and generation identity are tracked independently of formatted prose. Append, reconnect, pause and completion retain the run identity; non-prefix replacement increments the source revision, and regeneration creates a new identity. A deferred flush fixes the case where a final short delta arrived during the 120 ms batching interval and otherwise remained undisplayed.

Arrived associations are inline `span` elements with `role="button"`, keyboard activation, focus indication and pressed state. The span permits normal paragraph wrapping. Partial delivered phrases remain readable before their complete activation target appears. Explicit inspection holds artwork while source delivery continues; pending automatic cues coalesce. Whole-card shelf inspection keeps identity separate from detail emphasis. React manages the crossfade nodes: departure lasts 300 ms and entrance 550 ms. Native local animation handles own finite glints and water slowdown, without per-frame React state updates.

Eight cards have authored edition-specific details; the other 70 vector card faces have no authored detail geometry and retain whole-card context. The full collection contains 78 faces plus a back. Reversal rotates the common artwork plane once; supported details retain their card orientation.

## Portable preview and focused tests

From the repository root on this feature branch:

```sh
npm run dev:frontend -- --port 5174 --strictPort
```

Open [the recorded Star fixture](http://localhost:5174/__e2e/reading-gestures?study=star&arrival=gentle). Default recorded mode requires no credentials. The lab supports `study=star|celtic|five-card`, `arrival=gentle|burst|complete`, and `reflection=off`; restart and discrete selectors remain outside the reading surface. Star and Celtic headings are separate from their exact excerpt source so raw offsets remain valid. Five-card retains the complete reading and headings.

Run the focused suites with the dedicated configuration, which starts or reuses the fixture server on port 5174:

```sh
npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs
```

`sourceMode=job-sse` invokes the actual reading generation entrypoint after seeding the public Tarot setters. Use this mode through the controlled test fixture. Selecting it outside those tests can start a live backend job. The helper replaces reading responses with recorded, controllable SSE and separately selects mocked Pro, guest or passthrough authentication.

## Verification lanes

| Lane | Evidence | Qualification |
| --- | --- | --- |
| Root unit suite | `npm test`: 2,996 passing tests across 510 suites | Root suite scope; not every server test or E2E suite |
| Production build | `npm run build` passed in 12.86 seconds; fixture strings and development artwork URLs absent from `dist` | Build output inspected; no deployment |
| Recorded renderer and controlled SSE | Both focused specs: 15/15 passing across Chromium 151.0.7922.34 and WebKit 26.5 | Headless emulated desktop/handset; source and metadata recorded; fixture Pro auth mocked where configured |
| Held reduced-motion restoration | Isolated focused run: 3/3 passing | Native browser motion preference change and actual animation handles |
| Guest authentication review | Authentication endpoint returned 401 | Separate local application context; recorded/mock reading response |
| Real local Pro review | Authentication returned 200 with active Pro status; logout returned 200; subsequent authentication returned 401 | Real auth/tier verified separately from recorded SSE; no live model output |

The focused browser checks cover exact recorded prose, Star's six associations, related-card returns, five-card paired and independent details, shelf keyboard inspection, partial-phrase access, source continuity while held, non-prefix snapshot invalidation, regeneration, terminal error, route departure/return, and authored emergence around the description midpoint. They also inspect reserved artwork height, compact layouts, reduced-motion fallback and motion-owner limits.

Water checks inspect actual browser animation handles: release slows the flow and reaches zero running loops after settlement, offscreen artwork stops, visible held inspection restores motion, preference changes retain static meaning, and resize retains one owner. Exiting copies are inert and retire without removing the current card or moving keyboard focus. Visibility-listener checks explicitly simulate `visibilitychange`; they do not prove native background-tab, BFCache or physical-device behavior.

The three recorded sources retain verbatim 97-, 183- and 904-word text. Their provenance and timestamps remain distinct. No changes were made to `data/evaluations/narrative-samples.json`, and fixture general reflections are not represented as newly supplied production card notes.

## Visual evidence

- [Star desktop](evidence/react-star-desktop.png) and [Star phone](evidence/react-star-phone.png).
- [Five-card desktop](evidence/react-five-desktop.png), [Five-card phone](evidence/react-five-phone.png), and [small reduced-motion five-card view](evidence/react-five-small-reduced.png).
- [Recorded visual metrics](evidence/react-visual-metrics.json).

These captures document rendered application fixtures before the final scoped text-reflow repair. They are emulated-browser evidence, not real handset screenshots. The final WebKit test also passed at 320px with root CSS font size set to 200%: prose and headings wrap within the viewport, a visible line of the long synthesis phrase accepts a real touch, and Enter releases its hold. This is CSS text resizing, not native OS accessibility-setting or browser page-zoom coverage.

## Bounded performance evidence

The isolated final Chromium measurement covers active Star water while controlled SSE arrives, followed by a card association handoff. The [summary](evidence/react-performance-summary.json) and [compressed timeline](evidence/react-performance-trace.json.gz) preserve that run.

| Measurement | Isolated final run | Earlier full-suite run |
| --- | --- | --- |
| Observed animation-frame callbacks | 35 | 31 |
| Frame intervals above 34 ms | 4 | 9 |
| Maximum observed interval | 50.1 ms | 83.3 ms |
| Script time | 68.847 ms | 116.49 ms |
| Task time | 251.557 ms | 267.516 ms |
| Layout time | 3.031 ms | 3.22 ms |
| Paint events | 76 | 66 |
| Timeline `RunTask` events above 50 ms | 0 | 0 |

The isolated performance test passed; frame timing varied under the broader run, so both observations are reported. Frame intervals are observed callback spacing, not compositor dropped-frame counts. The trace contains document paint clips of 1100×1000 (and 1100×1097 as prose grows), plus water-SVG clips on the full 1086×1810 source plane. These are reported clip bounds, not the pixels actually rasterized. Localized visual emphasis therefore does not prove localized paint cost, hardware acceleration or GPU compositing. The measured browser is headless and emulated; a real mid-range handset performance check remains a production gate.

## Remaining limits and release state

The sidecars are authored for three recorded studies. This work does not generate production annotations or establish coverage for arbitrary narratives, 70 unauthored card detail sets, or other artwork editions. Unsupported geometry and source mismatch retain ordinary prose rather than guessing detail positions.

Native background/BFCache behavior, physical handset smoothness, native text/page zoom, and screen-reader behavior beyond the tested accessibility semantics are not claimed. Free/Plus/inactive subscription states were not reviewed. No live narrative model was exercised. The feature branch began at `4c433b9`; foundation commit `eca5290` was imported as `9aa1ec1`. The bounded bridge is complete at the verified implementation checkpoint. This is a feature checkpoint, not a production release; no merge, deployment or live-Worker parity is asserted.


## Review findings and repairs

A fresh read-only whole-branch review against `4c433b9` found no additional confirmed blocker. Its focused run overlapped the known delayed native water-handle regression; the subsequent repair passed its injected regression, three isolated browser restoration runs, and the final 15-test browser sequence. The controller discovers newly recreated CSS handles over at most three eligible frames and cancels discovery on ownership loss.

Rendered review also repaired phrase wrapping (one inline control rather than an indivisible native button), font serving in the isolated worktree, invalid-sidecar fallback, and mobile text reflow. At doubled text size, intrinsic flex sizing had widened the prose column to 285.66px despite only 206px of available space. The scoped mobile rule now bounds the column and allows long headings to wrap, without shrinking the chosen font size. A long multiline phrase can exceed the space below the sticky companion; the zoom check taps an actually visible line rather than its full bounding-box center.

The five streamed introductions assert zero manual `onSelectCard` calls and unchanged scroll/focus. Scoped ESLint and whitespace checks passed. Impeccable detection reported zero primary findings, with six artwork palette/radius advisories retained as intentional image treatments. An initial detector invocation named two nonexistent paths; the corrected paths were scanned, and no inaccessible target is treated as a successful check.

The real-auth lane used fresh contexts with service workers blocked to prevent the primary checkout's service worker from serving stale HTML. Chromium local-network checks were disabled for the loopback-only frontend/SSE proxy. Default private-network policy and production service-worker delivery remain unverified; these browser settings are part of the local review qualification. Credentials and browser session state were not saved with this handoff.

## Continue on another machine

Fetch and select `codex/reading-gestures-react-bridge`, install repository dependencies with `npm ci`, and install test browsers with `npx playwright install chromium webkit` if needed. All recorded fixtures, original SVG artwork and authored sidecars are checked in. Private reviewer credentials are intentionally excluded; a machine without the local reviewer account must record its own real-auth coverage gap.

The [execution plan](../../docs/superpowers/plans/2026-10-09-reading-gestures-react-bridge.md) records implementation decisions and historical test-order exceptions. The [78-card inventory](deck-gesture-coverage.md) distinguishes authored and visually inspected details from structural roster coverage. The next authorized milestone should choose the production passage-association contract, then expand deliberate imagery treatments using that same occurrence/edition/focus engine. Before enabling it for ordinary readings, validate all promoted orientations/compact views, larger spreads, optimized artwork decode/memory, and actual handset/assistive-technology behavior.
