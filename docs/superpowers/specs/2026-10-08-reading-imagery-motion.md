# Personalized reading: imagery and motion proposal

**Date:** October 8, 2026

**Status:** Design exploration, with a playable fixture. Production implementation is not included.

**Source baseline:** `ba009b346216c46597c60a4f07a5283cfc98d5cc`

**Prototype:** [Current Star motion study and preview instructions](../../../output/reading-motion/README.md)

## Purpose

Preserve the personalized reading's prose, section structure, and interpretive rhythm while helping the reader see how the writing relates to the cards in their spread. Small gestures should feel like a tarot reader gently indicating a visible detail as its meaning develops. Recognition should come from the connection among the actual imagery, the passage, and what the reader chose to share.

Use [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md), and the [design contract](../../design-contract.md) as the application authorities. Keep Tableu's warm brass, restrained motion, Source Serif headings, and Inter reading copy. This proposal does not redesign the narrative into slides, require a response after each card, or change model-generated text to fit animation.

## What the existing readings do

The investigation covered the current prompt assembly and rendering/streaming paths, plus all 11 generated samples in local qualification run `2026-10-07T23-47-19.908Z-5eqpUm`. That run includes single-card, three-card, five-card, relationship, decision, and Celtic Cross readings; RWS, Thoth, and Marseille decks; hypothetical relationships; and Spanish prose. These are recorded evaluation outputs, not a new live production test. The focused sample needed to reproduce this study is preserved in the [fixture](../../../output/reading-motion/fixtures/three-card-transition.json).

### Introduction is different from interpretation

The [system prompt](../../../functions/lib/narrative/prompts/systemPrompt.js) asks for an opening that names a recognizable experience before introducing frameworks or a spread overview. The opening may name every card before any is interpreted. The first occurrence of a card name is therefore not a reliable signal to spotlight its imagery.

### Imagery, interpretation, and personal context are woven together

The prompt's underlying movement is what the reader sees, why it matters, and what they might do next. It explicitly varies the order and discourages rigid WHAT/WHY/WHAT NEXT templates. A passage may begin with an image, a felt experience, or a practical invitation. Question and reflection references are part of that prose, with the question serving as a throughline in the opening and synthesis.

In the current fixture, the Star's pitcher pouring into the pool becomes a way to describe memory and people back home. The pitcher pouring onto land becomes new ground. The passage then holds both pitchers together, echoing the supplied reflection's nostalgia and readiness for reinvention. No additional feedback control is needed to make that existing connection visible.

### Cards recur and relate to other cards

Three-card readings progress through Past, Present, and Future while explaining the transitions. Relationship readings explore interplay. Celtic Cross guidance groups and revisits positions through Nucleus, Timeline, Consciousness, Staff, cross-checks, and synthesis; it is not ten independent descriptions.

One recorded Celtic Cross sample (`celtic-deep-shift`) recalls Death's white horse when introducing the white horse in The Sun. Its synthesis returns to the Hermit's lantern and Temperance's cups. A future implementation needs to support returning to a prior card and indicating more than one card when the writing makes a relationship explicit. The current single-card study does not demonstrate those behaviors.

### Context constrains a valid gesture

[Card prompt construction](../../../functions/lib/narrative/prompts/cardBuilders.js) includes identity, spread position, orientation, visual information, and applicable reflections. [Deck guidance](../../../functions/lib/narrative/prompts/deckStyle.js) distinguishes RWS scenes, Thoth imagery and naming, and Marseille pip geometry. [Depth guidance](../../../functions/lib/narrative/styleHelpers.js) changes how much space is available for each card and for relationships.

Indicate only imagery actually supported by the selected artwork. Preserve drawn orientation and the selected reversal interpretation. Do not treat a metaphor or a familiar word as evidence that another card is present: a user mentioning "towers" does not mean The Tower was drawn. Do not reuse RWS image coordinates across decks.

## Proposed interaction vocabulary

| Passage moment | Proposed visual response | Reader value |
| --- | --- | --- |
| A card becomes the subject of interpretation | Bring its companion into attention with a small, brief gesture | Establish which card the passage concerns |
| Literal imagery is described | Briefly indicate the relevant detail; for the Star, follow the selected pouring detail | Connect the words to something visible |
| That image is related to the supplied reflection | Pair the same detail with restrained emphasis on the relevant words the reader supplied | Make the personal connection traceable |
| Two parts of an image are interpreted together | Indicate both details together | Show how the interpretation holds them in relationship |
| A passage relates or revisits cards | Support a shared or returning emphasis, rather than advancing permanently to the next card | Preserve the reading's larger argument |
| The reader inspects a phrase again | Replay or hold its association on hover, keyboard focus, or activation | Make connections available at the reader's pace |

The final two-card behavior remains a design requirement to explore. In the current study the card touch is approximately 3px, imagery emphasis settles over roughly 0.4–1.2 seconds, and automatic cues clear after a short hold. These timings are prototype choices to evaluate, not production tokens or validated reading-speed defaults.

## Current motion study

[star-reading-motion.html](../../../output/reading-motion/star-reading-motion.html) retains the exact 97-word Future paragraph from the `three-card-transition` sample, including its original wording. It shows the sample's question and reflection as context, then the existing **The Story** section and **Future: The Star (Upright)** position label.

The desktop composition places the card beside the prose. At narrow widths it becomes a compact companion row with an explicit **Look closer** control. Underlined phrases are native links; they remain in the prose's natural line flow. Keyboard focus and pointer inspection hold the connection. Explicit activation pauses playback until resumed. Pending content is inert, and reduced-motion preferences suppress CSS animation and transitions while retaining the same static associations.

**Play passage**, **Pause/Resume**, **Replay**, and **Show all** are demonstration controls, not a proposal to add a playback toolbar to every reading. The mockup's reserved space during simulated reveal is also a fixture technique, not a decision about production streaming layout.

The earlier [reading-with-you.html](../../../output/reading-motion/reading-with-you.html) is retained as a superseded exploration. It uses synthetic copy and resonance controls. The subsequent investigation replaced that approach with a passage from an actual recorded reading and connections already present in its wording.

## Integration considerations

These observations identify where implementation work would be needed; no production architecture or annotation contract has been approved here.

- [StreamingNarrative.jsx](../../../src/components/StreamingNarrative.jsx) currently tracks first phrase/section appearance. That event is different from the moment a person reads or revisits an interpretive passage. Some mobile, long Markdown, and reduced-motion paths also suppress client reveal.
- [Narrative model utilities](../../../src/hooks/narrativeReadingModelUtils.js) preserve the narrative text and currently derive card-name highlight phrases. Card-name matching alone does not identify literal imagery or the passage's personal connection.
- [Reading selection](../../../src/hooks/useReadingSelection.js) handles existing card-selection/pulse behavior; the narrative surface needs its own visible card context for a cue to be useful.
- [ReadingContext.jsx](../../../src/contexts/ReadingContext.jsx) receives deltas and can replace text with snapshots or a completed result. Any future annotations must remain attached to the correct text through those updates, without replaying every cue on reconnect or final replacement.
- [Reading stream transport](../../../functions/lib/readingStream.js) can divide buffered text into chunks, including a default 160-character size. Transport boundaries are not semantic boundaries and cannot reliably determine when imagery is interpreted.
- Arrival timing is not reading position. Automatic cues should yield to explicit inspection, and complete readings must retain the same connections for readers who arrive after generation or read at a different pace.

A future annotation design would need reliable card identity/spread index, supported detail identity for the selected artwork, and alignment with the exact passage. Missing, uncertain, or unsupported annotations should leave the complete reading usable without inventing a visual connection. This study does not choose between generation-time annotations and a separate alignment pass.

## Questions for the next design pass

1. How should the companion hold two related cards on a phone without covering the prose?
2. Which gestures can be subtle yet legible on the compact card, and when should a detail be enlarged?
3. How should automatic emphasis follow reading progress without assuming gaze or forcing scroll movement?
4. How should a reversal, another deck, a very short reading, or translated prose affect cue selection and placement?
5. How can the original question/reflection remain available when a long reading moves it offscreen?

## Evidence and limits

The [verification record](../../../output/reading-motion/verification.md) separates standalone mockup checks from repository tests. The prototype has no live model requests, authentication, subscription behavior, saving, or application integration. Its hand-authored associations demonstrate an interaction idea; they do not validate automated imagery recognition, personalization correctness, reading-position tracking, or production accessibility across assistive technologies and devices.
