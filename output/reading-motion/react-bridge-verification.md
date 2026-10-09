# Reading gesture React bridge verification

The original bridge was verified October 9, 2026 on `codex/reading-gestures-react-bridge`, using Node 24.21.0, at implementation checkpoint `e373620`. The current passage-alignment repair is documented separately below; the original test counts, screenshots, auth review, and performance trace remain historical evidence for that bridge checkpoint. The earlier standalone HTML studies and recorded source fixtures remain available. No production deployment or live narrative generation was performed.

## Dynamic passage alignment repair — October 9, 2026

The opted-in provider now accepts an absent sidecar and resolves associations from the actual live or hydrated Markdown source. [The shared contract](../../shared/contracts/readingPassageAssociations.js) validates exact UTF-16 passage ranges, spread occurrences, optional context, artwork details and introduction boundaries. [The aligner](../../src/lib/narrativePassageAligner.js) returns validation errors through `resolveDynamicPassages().invalid`; malformed data is not reported as a clean result.

This fallback provides whole-card identity for the canonical 78-card roster. Literal and interpretive detail rules are deliberately limited to reviewed English constructions for the eight cards with authored vector geometry: The Star, The Hermit, Five of Wands, Ace of Wands, Seven of Swords, Queen of Cups, Three of Pentacles, and Wheel of Fortune. A literal rule requires descriptive context for the matching card. Later interpretations require that the corresponding detail was established earlier in the same reading. Unrecognized wording keeps ordinary prose and available identity inspection. Other or unspecified artwork editions receive no vector detail geometry, and an individual card edition cannot be overridden by a spread-level edition. This is a bounded deterministic aligner, not universal understanding of an arbitrary reading.

The repair addresses dropped heading introductions, paired introductions, later named returns, and cue ordering. Source-order cues feed the focus engine; artwork-registry order no longer chooses the last detail. Markdown code, links, image metadata and HTML are excluded from annotation. Visible ranges inside strong/emphasis markup remain interactive without losing text or formatting. Figurative language such as “pool your resources” and “land a new role” does not establish painted pours. The aligner does not infer a personal association from word overlap. Supplied context references must match their actual source, and absent optional reflection text removes the local context reference while preserving the valid card/passage association.

Streaming distinguishes a known source boundary from an unfinished prefix. Trailing incomplete words do not become available cues; committed cues keep stable IDs and ranges across appends. A dynamic introduction carries `dynamic` and `pending` state. After the name becomes available, pending artwork stays at quiet presence until a supported descriptive detail or a completed description block establishes its arrival; source completion resolves remaining identity introductions. It then emerges over 550 ms. Inspection selects full presence, and reduced motion retains static full presence without that transition. Authored sidecars still use their known description midpoint curve. Dynamic alignment does not predict the midpoint of future text.

Contract validation also distinguishes `sourceComplete` from a streaming prefix: future associations are unavailable until their text arrives, supplied expected text can validate future authored ranges, and ranges beyond a complete source are rejected. Duplicate association IDs are rejected before availability filtering so a future collision cannot overwrite held inspection. Unsupported detail IDs are removed through edition-aware validation; the dynamic fallback retains whole-card identity where no supported detail rule exists.

### Repair verification status

Final repair verification on October 9, 2026:

- `npm test`: **3,049/3,049 passing**, across 515 suites. The focused contract/alignment/renderer/state run passed 91 tests, including regressions first observed failing. All 11 recorded evaluation samples have zero alignment validation errors; this checks structure and selected semantic cases, not exhaustive interpretation accuracy.
- Dedicated Playwright configuration: **21/21 passing** (19 Chromium, 2 mobile WebKit), including six no-sidecar dynamic tests alongside the 15 authored/lifecycle tests. Dynamic checks cover controlled SSE emergence, held continuity, source ordering, opaque Markdown, card headings, paired introductions, five-card returns, and reduced-motion phone behavior. Browser authentication remains mocked in this lane; no fresh real-auth review was needed or performed for these repairs.
- `npm run build` passed in 17.53 seconds. Scoped ESLint passed with `--max-warnings 0`; documentation and whitespace checks passed. `unified` and `remark-parse` are explicit dependencies at their existing locked versions.
- A separate canonical-name check exercised all **78 cards** through named headings with unknown-edition identity fallback, with zero failures. Seven-character incremental checks on the Star and five-card recorded sources found no changed or withdrawn committed cues. Soft-line-break and closing-quotation boundaries have dedicated regressions.
- Dynamic desktop (Chromium, 1100×1000, held Star pool) and phone (WebKit, 390×844, reduced-motion Ace/Queen pair) were captured and visually inspected. Both had readable artwork/prose and zero horizontal overflow or page errors; the phone stage stayed 106px with zero running stage animations. These repair screenshots were temporary local inspection artifacts, not replacements for the historical captures below.

The no-sidecar browser path is `associations=dynamic`. The final bounded headless trace observed 32 animation frames, nine frame intervals above 34ms, a maximum interval of 83.3ms, and no main-thread task above 50ms. These observations do not establish locked 60fps or physical-handset performance. No production deployment, live generation, narrative-generation gate, or new authentication/tier qualification was performed. The historical verification tables below remain evidence for the original bridge checkpoint.

## Scope and implementation

The original bridge uses the existing `NarrativePanel`, Markdown renderer, reading context, spread companion, and artwork renderer. The study flag defaults to disabled. Its authored fixture mode supplies explicit recorded sidecars and the `rws-immanuelle-vector` artwork edition; ordinary readings keep functional prose and card inspection without requiring sidecars. The dynamic fallback described above remains behind the same opt-in gate.

Raw text and generation identity are tracked independently of formatted prose. Append, reconnect, pause and completion retain the run identity; non-prefix replacement increments the source revision, and regeneration creates a new identity. A deferred flush fixes the case where a final short delta arrived during the 120 ms batching interval and otherwise remained undisplayed.

Arrived associations are inline `span` elements with `role="button"`, keyboard activation, focus indication and pressed state. The span permits normal paragraph wrapping. Partial delivered phrases remain readable before their complete activation target appears. Explicit inspection holds artwork while source delivery continues; pending automatic cues coalesce. Whole-card shelf inspection keeps identity separate from detail emphasis. React manages the crossfade nodes: departure lasts 300 ms and entrance 550 ms. Native local animation handles own finite glints and water slowdown, without per-frame React state updates.

Eight cards have authored edition-specific details; the other 70 vector card faces have no authored detail geometry and retain whole-card context. The full collection contains 78 faces plus a back. Reversal rotates the common artwork plane once; supported details retain their card orientation.

## Portable preview and focused tests

From the repository root on this feature branch:

```sh
npm run dev:frontend -- --port 5174 --strictPort
```

Open [the recorded Star fixture](http://localhost:5174/__e2e/reading-gestures?study=star&arrival=gentle), or [the Star with dynamic alignment and no sidecar](http://localhost:5174/__e2e/reading-gestures?study=star&arrival=gentle&associations=dynamic). Default recorded mode requires no credentials. The lab supports `study=star|celtic|five-card`, `arrival=gentle|burst|complete`, `associations=authored|dynamic`, and `reflection=off`; restart and discrete selectors remain outside the reading surface. The dynamic option changes association resolution, while keeping recorded source delivery. Star and Celtic headings are separate from their exact excerpt source so raw offsets remain valid. Five-card retains the complete reading and headings.

Run the focused suites with the dedicated configuration, which starts or reuses the fixture server on port 5174:

```sh
npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs
```

`sourceMode=job-sse` invokes the actual reading generation entrypoint after seeding the public Tarot setters. Use this mode through the controlled test fixture. Selecting it outside those tests can start a live backend job. The helper replaces reading responses with recorded, controllable SSE and separately selects mocked Pro, guest or passthrough authentication.

## Original bridge verification lanes

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

The sidecars remain authored for three recorded studies. The dynamic fallback adds validated associations for supported source constructions, but does not establish semantic coverage for every arbitrary narrative, the 70 unauthored card detail sets, or other artwork editions. Unsupported geometry and unrecognized wording retain prose and identity inspection without guessing detail positions.

Native background/BFCache behavior, physical handset smoothness, native text/page zoom, and screen-reader behavior beyond the tested accessibility semantics are not claimed. Free/Plus/inactive subscription states were not reviewed. No live narrative model was exercised. The feature branch began at `4c433b9`; foundation commit `eca5290` was imported as `9aa1ec1`. The bounded bridge is complete at the verified implementation checkpoint. This is a feature checkpoint, not a production release; no merge, deployment or live-Worker parity is asserted.


## Review findings and repairs

A fresh read-only whole-branch review against `4c433b9` found no additional confirmed blocker. Its focused run overlapped the known delayed native water-handle regression; the subsequent repair passed its injected regression, three isolated browser restoration runs, and the final 15-test browser sequence. The controller discovers newly recreated CSS handles over at most three eligible frames and cancels discovery on ownership loss.

Rendered review also repaired phrase wrapping (one inline control rather than an indivisible native button), font serving in the isolated worktree, invalid-sidecar fallback, and mobile text reflow. At doubled text size, intrinsic flex sizing had widened the prose column to 285.66px despite only 206px of available space. The scoped mobile rule now bounds the column and allows long headings to wrap, without shrinking the chosen font size. A long multiline phrase can exceed the space below the sticky companion; the zoom check taps an actually visible line rather than its full bounding-box center.

The five streamed introductions assert zero manual `onSelectCard` calls and unchanged scroll/focus. Scoped ESLint and whitespace checks passed. Impeccable detection reported zero primary findings, with six artwork palette/radius advisories retained as intentional image treatments. An initial detector invocation named two nonexistent paths; the corrected paths were scanned, and no inaccessible target is treated as a successful check.

The real-auth lane used fresh contexts with service workers blocked to prevent the primary checkout's service worker from serving stale HTML. Chromium local-network checks were disabled for the loopback-only frontend/SSE proxy. Default private-network policy and production service-worker delivery remain unverified; these browser settings are part of the local review qualification. Credentials and browser session state were not saved with this handoff.

## Continue on another machine

Fetch and select `codex/reading-gestures-react-bridge`, install repository dependencies with `npm ci`, and install test browsers with `npx playwright install chromium webkit` if needed. All recorded fixtures, original SVG artwork and authored sidecars are checked in. Private reviewer credentials are intentionally excluded; a machine without the local reviewer account must record its own real-auth coverage gap.

The [execution plan](../../docs/superpowers/plans/2026-10-09-reading-gestures-react-bridge.md) records implementation decisions, the dynamic alignment follow-up, and historical test-order exceptions. The [78-card inventory](deck-gesture-coverage.md) distinguishes authored and visually inspected details from structural roster coverage. The contract and conservative fallback now provide the continuation seam; broader language/semantic coverage and deliberate imagery treatments still need validation through the same occurrence/edition/focus engine. Before enabling it for ordinary readings, validate all promoted orientations/compact views, larger spreads, optimized artwork decode/memory, and actual handset/assistive-technology behavior.
