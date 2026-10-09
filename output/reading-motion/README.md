# Reading imagery motion studies

Design exploration for Tableu's personalized reading, October 8, 2026. These files are reviewable prototypes; they do not change the application or narrative service.

## Start here

- [Personalized reading gestures](personalized-reading-gestures.html): the current study. Six authored Star moments animate the artwork as its painted pours become part of the interpretation, followed by a separately sourced Hermit/Five of Wands example. Preview instructions are below.
- [Earlier Star study](star-reading-motion.html): preserves an actual generated paragraph and connects the Star's imagery to the reflection supplied with that evaluation sample.
- [Design proposal and source findings](../../docs/superpowers/specs/2026-10-08-reading-imagery-motion.md): reading structure, interaction intent, integration considerations, and remaining questions.
- [Production React bridge plan](../../docs/superpowers/plans/2026-10-09-reading-gestures-react-bridge.md): adapt the existing `feat/reading-card-touch` foundation, with source progress, semantic associations, explicit inspection priority, and artwork-specific detail geometry. This is an implementation plan; production application code is unchanged by this study.
- [Sample excerpt and provenance](fixtures/three-card-transition.json): the exact question, reflection, spread, and 97-word paragraph used by the current study. This is a local evaluation fixture, not a private production reading.
- [Related-card excerpt and provenance](fixtures/gestures-celtic-deep-shift.json): the complete 183-word “The Heart of It” section from the separate 23:23 Celtic Cross reading. Its timestamp and question stay distinct from the Star fixture's 23:47 qualification run.
- [Earlier exploration](reading-with-you.html): **superseded** synthetic Hermit/Star example. Its resonance buttons and simplified card-by-card progression are historical exploration, not the current proposal.

## Preview

From the repository root, with Node.js installed:

```sh
node output/reading-motion/preview.mjs personalized-reading-gestures.html 4324
```

Open <http://127.0.0.1:4324/>. Stop the server with Ctrl+C. The preview listens only on localhost and requires no application server, login, model credentials, or package installation. Refresh after editing a fragment; restart after changing the server. To inspect the earlier Star study on another port:

```sh
node output/reading-motion/preview.mjs star-reading-motion.html 4321
```

To inspect the superseded exploration:

```sh
node output/reading-motion/preview.mjs reading-with-you.html 4321
```

The HTML files are fragments authored for an inline preview host. The local preview supplies the document, mobile viewport, and light/dark color-scheme metadata; opening a fragment directly is not equivalent responsive/theme evidence. Fonts are embedded. The current study loads original SVG artwork from `assets/rws-immanuelle/`, so keep that directory with the study when moving machines. The earlier studies still embed their artwork. For the earlier studies, optional host `Tweak` controls and widget-state persistence are absent from the local preview; the host's decorative play icon is omitted locally, leaving the labelled button intact.

## Explore the current study

Playback begins when the passage area enters the viewport. Each card emerges with its own description: almost imperceptible at introduction, becoming readable around the middle of the literal imagery, and settling into a softly translucent resting state. Reveal progress follows the delivered passage rather than an independent timer, so quick text arrivals do not queue a backlog of entrances. The Five of Wands stays concealed until its introduction while the already-described Hermit remains present.

Mouse hover, keyboard focus, and held inspection brighten the base artwork. Its illumination is a separate layer: light follows each painted pour, then returns to the same detail as the prose connects it to memory or reinvention. Both details settle together at “Neither pitcher gets dropped.” Motion uses the native Web Animations API, SVG light traces, and masked illumination of the original artwork. Reduced motion reveals each card statically when its name has arrived and retains the imagery associations.

The artwork carries the interaction without explanatory captions or separate **Hold**, **Look closer**, or playback buttons. Click the card to hold or resume; after the Star passage completes, tap the pool or land to hold its memory or reinvention connection. A small timeline supports revisiting; Left/Right and Home/End provide keyboard revisiting. Choose either example again to replay it. Explicit inspection reveals the requested card immediately.

The Star paragraph remains exactly 97 words. The related-card example preserves the separate 183-word section and its own provenance. Streaming and semantic cues are hand-authored for these recorded passages; this prototype does not infer gaze or generate annotations.

## Explore the earlier Star study

These instructions describe `star-reading-motion.html`, not the current study:

1. Choose **Play passage**. A simulated word reveal cues the card, star, and two pouring details as their phrases complete.
2. Watch the reflection's **nostalgic** and **ready for reinvention** phrases respond when the passage connects memory to the pool and new ground to the other pitcher.
3. Hover, keyboard-focus, or activate an underlined phrase to inspect its connection. Activation holds the passage until **Resume passage**; **Show all** reveals the complete text immediately.
4. Use **Look closer**, then **Return to reading**. At narrow widths the companion becomes a compact row; explicit expansion reveals a larger card.
5. Try the browser's light/dark and reduced-motion preferences. Reduced motion keeps the visual associations while disabling animated transitions.

That earlier study uses hand-authored streaming, cue boundaries, and artwork coordinates. It does not detect where a person is reading, generate annotations, or implement cross-card connections. Neither study establishes integration, authenticated-state, real-device, or production readiness.

## Asset provenance

The current study references original SVG artwork from [Vectorized Tarot by Immanuelle](https://commons.wikimedia.org/wiki/Category:Vectorized_Tarot_by_Immanuelle), based on Pamela Colman Smith's illustrations. The [local collection](assets/rws-immanuelle/README.md) contains all 78 card faces and the roses-and-lilies back (276,071,643 bytes). Its [manifest](assets/rws-immanuelle/manifest.json) records source URLs, dimensions, file checksums, licensing metadata, SVG validation, and the complete verification result. Retrieval is resumable and respects Wikimedia's download cooldowns; the included runner is useful if a future checkout or transfer is incomplete.

The five cards in the reading examples are loaded directly as SVG images. The preview's hand-authored masks and water traces have been aligned to this edition; the downloaded files remain unmodified. Their traced paths have not been reorganized into semantic objects such as pitchers or lanterns. The previous Geldard comparison's [source and encoding manifest](fixtures/geldard-artwork.json) is retained for provenance.

The earlier Star study still embeds the [repository's RWS Star artwork](../../public/images/cards/RWS1909_-_17_Star.jpeg); the superseded exploration also uses its existing RWS Hermit artwork. Those studies retain the repository's original asset provenance. Embedded Inter and Source Serif 4 fonts come from the repository's installed Fontsource packages; their bundled licenses are preserved in [Inter license](licenses/inter.txt) and [Source Serif 4 license](licenses/source-serif-4.txt).

## Verification record

Fresh handoff checks on October 9, 2026: `npm test` passed all 2,942 tests with no failures, skips, or cancellations; `fetch-deck.py --verify-only` verified all 79 original SVGs without network access. `npm run docs:check` checked 177 maintained Markdown files with all local links resolving. The current HTML script and fixture JSON parsed. Both passages, questions, reflections, timestamps, card names, and orientations matched their fixtures; the Celtic excerpt remained verbatim within its source reading and matched its recorded source SHA-256.

Fresh Chromium checks at 1040×1100 captured initial concealment, gradual emergence, all six Star cues in order, and an active painted-pour trace. Hover changed the base from opacity 0.74 / brightness 0.88 to 1 / 1 while preserving illumination. Pool inspection held the memory connection; keyboard End revisited balance. The pair kept Wands hidden during the Hermit's description, introduced it independently, and retained the reversed card in the relationship. Phone checks at 390×844 retained the association without horizontal overflow; reduced motion held a static new-ground association with zero running animations. Compact 375×667 playback started automatically without overflow. Desktop and phone screenshots were inspected, and no page errors or failed requests were captured. These are headless Chromium checks with simulated streaming, not real-device, authenticated, or production integration evidence. CSS compositing hints were inspected in source; hardware acceleration/performance was not measured.

Portable evidence: [desktop held balance](evidence/2026-10-09-desktop.png) and [phone static balanced pours](evidence/2026-10-09-phone.png). Screenshots show settled states; the playable study demonstrates the transitions.

After the translucency and reveal changes, Chromium confirmed that the Star starts concealed, is barely visible at “A figure kneels,” and grows in visibility through the first pitcher description. All six semantic cues still arrived in order, including an active water trace. Hover brightened the base image from 0.74 to 1 opacity without changing the illumination mask or settled light opacity. The playback control was absent, keyboard focus held and fully revealed the connection, and the phone's balanced-pitcher revisit had no horizontal overflow or active animation under reduced motion. The related-card check confirmed that Wands stays hidden while the Hermit is described, then emerges independently while retaining the Hermit. Reduced motion revealed the Star when its complete name arrived; quick bursts completed without overflow or an entrance backlog. Both embedded fixtures remained unchanged, the script parsed, and no page errors were captured. Desktop and phone screenshots were inspected.

With the local vector artwork, Chromium decoded all five preview cards at 1086×1810. It delivered all six Star cues in order and ran the water trace in the new artwork coordinates; clicking the pool held the memory association. The related-card revisit held the Hermit's lantern while retaining the reversed Five of Wands. Desktop (1040×1100) and phone (390×844) screenshots were inspected, including the lantern crop; the phone retained both pours without horizontal overflow, and reduced motion had zero active animations. No page errors or failed requests were captured in the five-card check. The script parsed and both passages still matched their fixtures exactly (97 and 183 words). Full-deck retrieval completed: all 79 original SVGs (78 faces and one back, 276,071,643 bytes) matched their recorded source checksums and passed the final offline XML verification. The manifest records the complete collection.

After the Geldard artwork swap, all five embedded images decoded at 2100×3600 and matched their manifest hashes. A fresh Chromium check captured all six Star cues, an active water trace, the held Hermit-lantern revisit, and correctly reversed Five of Wands. Desktop and phone screenshots were inspected; the phone retained both pours without horizontal overflow, and reduced motion had zero active animations. No page errors were captured. The source reading data and its 97/183-word counts were unchanged.

Before these artwork swaps, the study was checked in Chromium at 1040×1100 and 390×844. Its script and embedded fixture JSON parsed; automatic playback delivered all six Star cues in order, with active light-trace animation during the pool cue. Tapping the pool revisited and held the memory association. Both passages matched their embedded source text, the related-card payoff retained the Hermit and reversed Five of Wands, and reduced motion retained land emphasis with zero active animations. The phone had no horizontal overflow, all embedded artwork loaded, and no page errors were captured. This is simulated streaming; real devices, other browsers, and production integration were not tested.

See [verification.md](verification.md) for the earlier Star study's checks and evidence boundaries. Those results do not verify the revised `personalized-reading-gestures.html` interactions.
