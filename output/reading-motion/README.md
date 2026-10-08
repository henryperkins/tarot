# Reading imagery motion studies

Design exploration for Tableu's personalized reading, October 8, 2026. These files are reviewable prototypes; they do not change the application or narrative service.

## Start here

- [Current Star study](star-reading-motion.html): preserves an actual generated paragraph and connects the Star's imagery to the reflection supplied with that evaluation sample.
- [Design proposal and source findings](../../docs/superpowers/specs/2026-10-08-reading-imagery-motion.md): reading structure, interaction intent, integration considerations, and remaining questions.
- [Sample excerpt and provenance](fixtures/three-card-transition.json): the exact question, reflection, spread, and 97-word paragraph used by the current study. This is a local evaluation fixture, not a private production reading.
- [Earlier exploration](reading-with-you.html): **superseded** synthetic Hermit/Star example. Its resonance buttons and simplified card-by-card progression are historical exploration, not the current proposal.

## Preview

From the repository root, with Node.js installed:

```sh
node output/reading-motion/preview.mjs
```

Open <http://127.0.0.1:4320/>. Stop the server with Ctrl+C. The preview listens only on localhost and requires no application server, login, model credentials, or package installation. Restart it after editing a fragment. Use another port if 4320 is occupied:

```sh
node output/reading-motion/preview.mjs star-reading-motion.html 4321
```

To inspect the superseded exploration:

```sh
node output/reading-motion/preview.mjs reading-with-you.html 4321
```

The HTML files are fragments authored for an inline preview host. The local preview supplies the document, mobile viewport, and light/dark color-scheme metadata; opening a fragment directly is not equivalent responsive/theme evidence. Images and fonts are embedded. Optional host `Tweak` controls and widget-state persistence are absent from the local preview; core interactions still work. The host's decorative play icon is omitted locally, leaving the labelled button intact.

## Explore the current study

1. Choose **Play passage**. A simulated word reveal cues the card, star, and two pouring details as their phrases complete.
2. Watch the reflection's **nostalgic** and **ready for reinvention** phrases respond when the passage connects memory to the pool and new ground to the other pitcher.
3. Hover, keyboard-focus, or activate an underlined phrase to inspect its connection. Activation holds the passage until **Resume passage**; **Show all** reveals the complete text immediately.
4. Use **Look closer**, then **Return to reading**. At narrow widths the companion becomes a compact row; explicit expansion reveals a larger card.
5. Try the browser's light/dark and reduced-motion preferences. Reduced motion keeps the visual associations while disabling animated transitions.

The stream, cue boundaries, and artwork coordinates are hand-authored for this fixture. The study does not detect where a person is reading, generate annotations, or implement cross-card connections. It does not establish integration, authenticated-state, real-device, or production readiness.

## Asset provenance

The current study embeds the repository's [RWS Star artwork](../../public/images/cards/RWS1909_-_17_Star.jpeg). The earlier exploration also uses the existing RWS Hermit artwork. Embedded Inter and Source Serif 4 fonts come from the repository's installed Fontsource packages; their bundled licenses are preserved in [Inter license](licenses/inter.txt) and [Source Serif 4 license](licenses/source-serif-4.txt). Card imagery follows the repository's existing asset provenance.

## Verification record

See [verification.md](verification.md) for the checks performed and the boundaries of that evidence.
