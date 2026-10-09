# Reading imagery motion studies

Design exploration for Tableu's personalized reading, October 8–9, 2026. The standalone HTML studies remain reviewable prototypes. The feature branch also contains a React bridge in the existing application, behind a disabled-by-default study flag and a development-only fixture route. No production deployment or live narrative generation is part of this handoff.

## Start here

- [React bridge verification and handoff](react-bridge-verification.md): existing application renderer/provider integration, controlled SSE tests, separate real guest/Pro auth evidence, screenshots, performance measurements and remaining limits.
- [Recorded React fixture](http://localhost:5174/__e2e/reading-gestures?study=star&arrival=gentle): start `npm run dev:frontend -- --port 5174 --strictPort` from this feature branch. Default recorded mode needs no credentials. Keep `sourceMode=job-sse` within the controlled test fixture, because selecting it directly invokes the real generation entrypoint.
- [Dynamic React alignment](http://localhost:5174/__e2e/reading-gestures?study=star&arrival=gentle&associations=dynamic): the same recorded text through the application provider with no authored sidecar. Conservative English detail rules cover eight authored vector cards; the canonical deck keeps identity fallback. See the verification handoff for current repair results and scope.

- [Five cards in dialogue](five-card-dialogue.html): the next study, preserving the complete recorded Five-Card Clarity reading. A persistent shelf remembers the five introductions, while the main artwork accompanies literal details, their interpretations, the Ace/Queen synthesis, and returns to the two swords, collaborators, and wheel. Explicit inspection holds the artwork while text keeps arriving. [Full fixture and provenance](fixtures/gestures-five-card-creative-project.json).
- [Personalized reading gestures](personalized-reading-gestures.html): the current study. A living illustration of The Star card accompanies the prose: authored masks and water paths follow the two painted streams, pool, and meadow rivulets while the figure, pitchers, and landscape remain still. Six authored moments awaken each pour, return to it for memory or reinvention, and briefly move both streams in unison at “Neither pitcher gets dropped,” before settling into stillness. Followed by a separately sourced Hermit/Five of Wands example. Preview instructions are below.
- [Earlier Star study](star-reading-motion.html): preserves an actual generated paragraph and connects the Star's imagery to the reflection supplied with that evaluation sample.
- [Design proposal and source findings](../../docs/superpowers/specs/2026-10-08-reading-imagery-motion.md): reading structure, interaction intent, integration considerations, and remaining questions.
- [Production React bridge plan](../../docs/superpowers/plans/2026-10-09-reading-gestures-react-bridge.md): adapt the existing `feat/reading-card-touch` foundation, with source progress, semantic associations, explicit inspection priority, and artwork-specific detail geometry. The feature branch now implements the application bridge described in this plan; see the separate verification handoff for the checks performed and release limits.
- [Sample excerpt and provenance](fixtures/three-card-transition.json): the exact question, reflection, spread, and 97-word paragraph used by the current study. This is a local evaluation fixture, not a private production reading.
- [Related-card excerpt and provenance](fixtures/gestures-celtic-deep-shift.json): the complete 183-word “The Heart of It” section from the separate 23:23 Celtic Cross reading. Its timestamp and question stay distinct from the Star fixture's 23:47 qualification run.
- [Earlier exploration](reading-with-you.html): **superseded** synthetic Hermit/Star example. Its resonance buttons and simplified card-by-card progression are historical exploration, not the current proposal.

## Preview

For the React fixture and focused tests, use the feature branch checkout:

```sh
npm run dev:frontend -- --port 5174 --strictPort
# Or run the focused specs; this config manages the dedicated fixture server.
npx playwright test --config output/reading-motion/react-bridge.playwright.config.mjs
```

Open [the recorded Star route](http://localhost:5174/__e2e/reading-gestures?study=star&arrival=gentle). Lab selectors choose Star, Celtic or five-card, gentle/burst/complete arrival, authored/dynamic associations, and optional reflection. Add `associations=dynamic` to exercise alignment without a supplied sidecar. They remain separate from the reading controls. The development fixture and original SVG URLs are excluded from the production build.

The following preview commands remain available for the standalone HTML studies:


From the repository root, with Node.js installed:

```sh
node output/reading-motion/preview.mjs personalized-reading-gestures.html 4324
```

Open <http://127.0.0.1:4324/>. Stop the server with Ctrl+C. The preview listens only on localhost and requires no application server, login, model credentials, or package installation. Refresh after editing a fragment; restart after changing the server. To inspect the earlier Star study on another port:

```sh
node output/reading-motion/preview.mjs star-reading-motion.html 4321
```

For the five-card dialogue, keep the Star preview open and start a second preview:

```sh
node output/reading-motion/preview.mjs five-card-dialogue.html 4325
```

Open <http://127.0.0.1:4325/>. This server also serves the allowed study filenames directly, so the five-card page links back to the existing Star study. Keep `five-card-dialogue.js`, `five-card-art.js`, and `assets/rws-immanuelle/` with the HTML when moving machines. Its fixture and local fonts are embedded safely in the fragment; the JavaScript modules are local resources.

To inspect the superseded exploration:

```sh
node output/reading-motion/preview.mjs reading-with-you.html 4321
```

The HTML files are fragments authored for an inline preview host. The local preview supplies the document, mobile viewport, and light/dark color-scheme metadata; opening a fragment directly is not equivalent responsive/theme evidence. Fonts are embedded. The current study loads original SVG artwork from `assets/rws-immanuelle/`, so keep that directory with the study when moving machines. The earlier studies still embed their artwork. For the earlier studies, optional host `Tweak` controls and widget-state persistence are absent from the local preview; the host's decorative play icon is omitted locally, leaving the labelled button intact.

## Explore the current study

Playback begins when the passage area enters the viewport. Each card emerges with its own description: almost imperceptible at introduction, becoming readable around the middle of the literal imagery, and settling into a softly translucent resting state. Reveal progress follows the delivered passage rather than an independent timer, so quick text arrivals do not queue a backlog of entrances. The Five of Wands stays concealed until its introduction while the already-described Hermit remains present.

Mouse hover, keyboard focus, and held inspection brighten the base artwork. The living water layer acts as a cinemagraph: the figure, pitchers, stars, and landscape stay still, while the two painted streams, expanding concentric ripples across the pool, and five rivulets across the meadow awaken in dialogue with the prose. Each pour is introduced, returns for memory or reinvention, and flows together at “Neither pitcher gets dropped.” The five meadow paths trace the painted blue channels and share their geometry with a narrow alpha mask, so the overlay is contained without cutting off the paths. The phone detail window includes the lower rivulets.

Releasing inspection immediately slows the water's playback rate and fades it over 1.5 seconds, then pauses the animations completely. Reinspection during settlement restores the flow. Automatic gestures also settle; concealed, settled, offscreen, and hidden-document water does not keep running invisibly. Explicitly held inspection may continue while its artwork is visible. Reduced motion preserves static illumination with zero running water animations.

The artwork carries the interaction without explanatory captions, a tracking bar, or separate **Hold**, **Look closer**, or playback buttons. Click the card to hold or release; after the Star passage completes, tap the pool or land to hold its memory or reinvention connection. Each of the six associated passages is also one inline inspection target: tap or click it, or focus it and press Enter or Space. Unrevealed passages are hidden from keyboard navigation, and available passages show visible focus and report their held state. Activating the held passage again releases it. Left/Right and Home/End on the card provide keyboard revisiting. Choose either example again to replay it. Explicit inspection reveals the requested card immediately.

The Star paragraph remains exactly 97 words. The related-card example preserves the separate 183-word section and its own provenance. Streaming and semantic cues are hand-authored for these recorded passages; this prototype does not infer gaze or generate annotations.

## Explore the earlier Star study

These instructions describe `star-reading-motion.html`, not the current study:

1. Choose **Play passage**. A simulated word reveal cues the card, star, and two pouring details as their phrases complete.
2. Watch the reflection's **nostalgic** and **ready for reinvention** phrases respond when the passage connects memory to the pool and new ground to the other pitcher.
3. Hover, keyboard-focus, or activate an underlined phrase to inspect its connection. Activation holds the passage until **Resume passage**; **Show all** reveals the complete text immediately.
4. Use **Look closer**, then **Return to reading**. At narrow widths the companion becomes a compact row; explicit expansion reveals a larger card.
5. Try the browser's light/dark and reduced-motion preferences. Reduced motion keeps the visual associations while disabling animated transitions.

That earlier study uses hand-authored streaming, cue boundaries, and artwork coordinates. It does not detect where a person is reading, generate annotations, or implement cross-card connections. Neither study establishes integration, authenticated-state, real-device, or production readiness.

## Explore the five-card dialogue

The full reading retains Opening, all five Story movements, Putting It Together, all four Gentle Next Steps, and Closing. The question, optional reflection, card positions, orientations, and source wording remain unchanged. The fixture identifies `generatedAt: 2026-10-07T23:23:59.556Z`; the checked-in source does not label it a qualification run. The source file and complete reading have recorded SHA-256 hashes. Relative timing and astrological language are preserved as part of that historical reading.

Each card gradually emerges in its recorded spread position, then stays on the shelf at resting translucency. The main view changes with a short crossfade; earlier cards remain available throughout. Authored associations move from the sprouting wand to the distant castle; from the carried swords to the two actually planted behind; to the covered cup; to the three collaborators and shared plans; and to the wheel. Short glints follow inspected artwork coordinates. They finish instead of looping, and the figures, covered cup, and card orientations remain still.

The Ace and Queen share the main view when the prose relates drive to sensitivity. The two reversed cards share an identity view when the prose relates readiness and structure. The next steps return to the same planted swords, collaborators, and wheel treatment. On a phone, the shelf stays compact while the focus window frames the supported imagery. The combined Ace interpretation uses two detail views so both the sprout and distant castle remain visible.

Click or tap an available underlined association, or activate it with Enter or Space, to hold that connection. Click a previously introduced shelf card for whole-card inspection; this does not infer a detail. Arrow keys and Home/End move keyboard focus among introduced cards. Activate the held association again, tap the focus view, or press Escape to release. Inspection does not change the delivered text position or stop simulated text arrival. New automatic cues coalesce while held. No gesture forces scrolling or keyboard focus; viewport eligibility supports accompaniment and revisiting without claiming to measure gaze.

The **About this study** disclosure contains quick-burst arrival, Show Full, Replay, reflection, and provenance controls. There is no tracking bar or primary play button. Without JavaScript, the complete recorded prose is still present. Reduced motion retains static detail illumination and relationships. Streaming and all associations are authored for this fixture, rather than live model output or automated semantic tagging.

## Asset provenance

The current study references original SVG artwork from [Vectorized Tarot by Immanuelle](https://commons.wikimedia.org/wiki/Category:Vectorized_Tarot_by_Immanuelle), based on Pamela Colman Smith's illustrations. The [local collection](assets/rws-immanuelle/README.md) contains all 78 card faces and the roses-and-lilies back (276,071,643 bytes). Its [manifest](assets/rws-immanuelle/manifest.json) records source URLs, dimensions, file checksums, licensing metadata, SVG validation, and the complete verification result. Retrieval is resumable and respects Wikimedia's download cooldowns; the included runner is useful if a future checkout or transfer is incomplete.

The studies load their referenced cards directly as SVG images. The preview's hand-authored masks and water traces have been aligned to this edition; the downloaded files remain unmodified. Their traced paths have not been reorganized into semantic objects such as pitchers or lanterns. The previous Geldard comparison's [source and encoding manifest](fixtures/geldard-artwork.json) is retained for provenance.

The earlier Star study still embeds the [repository's RWS Star artwork](../../public/images/cards/RWS1909_-_17_Star.jpeg); the superseded exploration also uses its existing RWS Hermit artwork. Those studies retain the repository's original asset provenance. Embedded Inter and Source Serif 4 fonts come from the repository's installed Fontsource packages; their bundled licenses are preserved in [Inter license](licenses/inter.txt) and [Source Serif 4 license](licenses/source-serif-4.txt).

## Verification record

Five-card study checks on October 8, 2026 (America/Chicago): both modules and the preview server parsed. The complete 904-word recorded reading, question, reflection, five cards, generation timestamp, embedded JSON, and both recorded hashes matched the checked-in source. Chromium confirmed all five rendered sections and four bullet items retained their wording. Quick-burst delivery introduced cards in the recorded order and retained the same five shelf nodes. Holding the Ace's sprouting-wand connection left text delivery advancing; releasing, revisiting, and identity inspection preserved the delivered position. Automatic accompaniment followed visible literal passages for all five cards without requiring clicks.

Desktop (1100×1000) and phone (390×844) checks exercised Ace/Queen synthesis, the planted-swords, collaborator, and wheel returns, keyboard Enter/Space/Escape and shelf arrows, single reversal, identity inspection without inherited illumination, and optional reflection removal. Phone framing retained separate sprout/castle details for the combined Ace interpretation. The phone companion reserves its focus area before emergence; a targeted check confirmed the first card introduction did not change its height. The brief departing image existed during the crossfade and was removed after completion. Held glints finished instead of looping. Partially streamed associations retained arrived text in the accessibility tree before becoming keyboard controls. Reduced motion had zero running animations; a simulated hidden-document event canceled artwork animation. Compact layouts at 375×667 and 320×667 had no horizontal overflow, including the light-theme check. No page errors or failed requests were recorded in the main browser pass.

Five-card evidence: [desktop synthesis](evidence/five-card-desktop.png), [phone synthesis](evidence/five-card-phone-pair.png), [phone sprout and castle](evidence/five-card-phone-ace.png), [phone planted swords](evidence/five-card-phone-swords.png), [phone collaboration](evidence/five-card-phone-pentacles.png), [phone wheel](evidence/five-card-phone-wheel.png), and [reduced motion](evidence/five-card-phone-reduced.png). Screenshots were visually inspected in two bounded passes. The mechanical Impeccable detector returned typography/radius advisories and font warnings against a stale design sidecar; embedded Inter and Source Serif 4 were confirmed in the browser, and the actual font aliases and short title leading were corrected. Detector findings are not a clean accessibility result. These are headless Chromium and authored-stream checks, not physical-device, screen-reader, live generation, or production integration evidence. Repository-wide tests, narrative/vision gates, and deployment checks were not run for this prototype.

Remediation checks on October 8, 2026 (America/Chicago): the script and embedded JSON parsed, both passages/questions/reflections still matched their fixtures exactly (97 and 183 words), and `git diff --check` passed. `npm run docs:check` checked 177 maintained Markdown files with all local links resolving. Chromium delivered the six Star cues in order. Initial, automatically settled, offscreen, and reduced-motion states had zero running water animations. Releasing a held memory passage lowered the playback rate to approximately 0.69 after 250 ms and paused all water after settlement; resizing during that slowdown did not leave running copies. Reinspection restored normal playback. Reduced-motion preference changes did not replay a completed, unheld gesture. The related-card revisit, Show Full, and compact fast-arrival paths also passed with no page errors or horizontal overflow.

There were six inline phrase controls per example, none available before their text arrived; click, Enter, and Space held/released the matching association with the expected pressed state. All five meadow paths shared their mask geometry, and 101 sampled centerline points per path fell inside the 14 px mask surrounding each 6 px visible stroke. Desktop (1040×1100) and phone (390×844) screenshots were visually inspected, including the lower-rivulet framing; compact playback was checked at 375×667. Simulated document-visibility and persisted pagehide/pageshow events stopped water and restored held inspection without resuming text. These event checks do not establish real background-tab or back/forward-cache behavior. Real touch devices and assistive technologies were not tested.

Current evidence: [desktop held balance](evidence/2026-10-09-desktop.png) and [phone held balance](evidence/2026-10-09-phone.png). These stills show the revised geometry and framing; the playable study demonstrates motion. Repository-wide tests, live model generation, vision/narrative gates, and deployment checks were not rerun for this standalone remediation. The records below describe earlier versions.

Earlier handoff checks recorded on October 9, 2026 UTC: `npm test` passed all 2,942 tests with no failures, skips, or cancellations; `fetch-deck.py --verify-only` verified all 79 original SVGs without network access. `npm run docs:check` checked 177 maintained Markdown files with all local links resolving. The HTML script and fixture JSON parsed. Both passages, questions, reflections, timestamps, card names, and orientations matched their fixtures; the Celtic excerpt remained verbatim within its source reading and matched its recorded source SHA-256.

Fresh Chromium checks at 1040×1100 captured initial concealment, gradual emergence, all six Star cues in order, and an active painted-pour trace. Hover changed the base from opacity 0.74 / brightness 0.88 to 1 / 1 while preserving illumination. Pool inspection held the memory connection; keyboard End revisited balance. The pair kept Wands hidden during the Hermit's description, introduced it independently, and retained the reversed card in the relationship. Phone checks at 390×844 retained the association without horizontal overflow; reduced motion held a static new-ground association with zero running animations. Compact 375×667 playback started automatically without overflow. Desktop and phone screenshots were inspected, and no page errors or failed requests were captured. These are headless Chromium checks with simulated streaming, not real-device, authenticated, or production integration evidence. CSS compositing hints were inspected in source; hardware acceleration/performance was not measured.

After bar removal, Chromium confirmed automatic accompaniment, keyboard revisiting, retained illumination, and no phone overflow or page errors. The evidence files have since been refreshed for the remediation described above.

After the translucency and reveal changes, Chromium confirmed that the Star starts concealed, is barely visible at “A figure kneels,” and grows in visibility through the first pitcher description. All six semantic cues still arrived in order, including an active water trace. Hover brightened the base image from 0.74 to 1 opacity without changing the illumination mask or settled light opacity. The playback control was absent, keyboard focus held and fully revealed the connection, and the phone's balanced-pitcher revisit had no horizontal overflow or active animation under reduced motion. The related-card check confirmed that Wands stays hidden while the Hermit is described, then emerges independently while retaining the Hermit. Reduced motion revealed the Star when its complete name arrived; quick bursts completed without overflow or an entrance backlog. Both embedded fixtures remained unchanged, the script parsed, and no page errors were captured. Desktop and phone screenshots were inspected.

With the local vector artwork, Chromium decoded all five preview cards at 1086×1810. It delivered all six Star cues in order and ran the water trace in the new artwork coordinates; clicking the pool held the memory association. The related-card revisit held the Hermit's lantern while retaining the reversed Five of Wands. Desktop (1040×1100) and phone (390×844) screenshots were inspected, including the lantern crop; the phone retained both pours without horizontal overflow, and reduced motion had zero active animations. No page errors or failed requests were captured in the five-card check. The script parsed and both passages still matched their fixtures exactly (97 and 183 words). Full-deck retrieval completed: all 79 original SVGs (78 faces and one back, 276,071,643 bytes) matched their recorded source checksums and passed the final offline XML verification. The manifest records the complete collection.

After the Geldard artwork swap, all five embedded images decoded at 2100×3600 and matched their manifest hashes. A fresh Chromium check captured all six Star cues, an active water trace, the held Hermit-lantern revisit, and correctly reversed Five of Wands. Desktop and phone screenshots were inspected; the phone retained both pours without horizontal overflow, and reduced motion had zero active animations. No page errors were captured. The source reading data and its 97/183-word counts were unchanged.

Before these artwork swaps, the study was checked in Chromium at 1040×1100 and 390×844. Its script and embedded fixture JSON parsed; automatic playback delivered all six Star cues in order, with active light-trace animation during the pool cue. Tapping the pool revisited and held the memory association. Both passages matched their embedded source text, the related-card payoff retained the Hermit and reversed Five of Wands, and reduced motion retained land emphasis with zero active animations. The phone had no horizontal overflow, all embedded artwork loaded, and no page errors were captured. This is simulated streaming; real devices, other browsers, and production integration were not tested.

See [verification.md](verification.md) for the earlier Star study's checks and evidence boundaries. Those results do not verify the revised `personalized-reading-gestures.html` interactions.
