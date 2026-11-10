# Archetypal triads: membership and reading contract

Type: spec
Status: active reference
Last reviewed: 2026-10-23

Triads identify shared themes among canonical Major Arcana identities. Membership is independent of order and orientation; interpretation always honors each drawn position and reversal. An arc's authored sequence is a possible thematic relationship, not evidence that events occurred in that order or that a person experienced a crisis, loss, addiction or other unprovided event.

## Active registry

All ten triads in [knowledgeGraphData.js](../../src/data/knowledgeGraphData.js) are active. Each has three explicit numeric pair entries: **30 pair meanings**. Shared pairs in different triads retain their pattern identity. The [partial passage registry](../../functions/lib/knowledgeBasePartialProjections.js) supplies separately authored matched-only GraphRAG text; it does not inherit the full arc's contextual variants.

| Theme | Canonical members | Pair keys |
| --- | --- | --- |
| Healing Arc | Death (13), Temperance (14), The Star (17) | 13-14, 13-17, 14-17 |
| Liberation Arc | The Devil (15), The Tower (16), The Sun (19) | 15-16, 15-19, 16-19 |
| Inner Work Arc | The Hermit (9), The Hanged Man (12), The Moon (18) | 9-12, 9-18, 12-18 |
| Mastery Arc | The Magician (1), The Chariot (7), The World (21) | 1-7, 1-21, 7-21 |
| Relationship & Values Arc | The Empress (3), The Lovers (6), The Hierophant (5) | 3-5, 3-6, 5-6 |
| Complete Manifestation Cycle | The Fool (0), The Magician (1), The World (21) | 0-1, 0-21, 1-21 |
| Authority & Structure Arc | The Empress (3), The Emperor (4), The Hierophant (5) | 3-4, 3-5, 4-5 |
| Karmic Acceptance Arc | Wheel of Fortune (10), Justice (11), The Hanged Man (12) | 10-11, 10-12, 11-12 |
| Post-Crisis Navigation Arc | The Tower (16), The Star (17), The Moon (18) | 16-17, 16-18, 17-18 |
| Inner Mastery Through Solitude Arc | Strength (8), The Hermit (9), Wheel of Fortune (10) | 8-9, 8-10, 9-10 |

These numbers are canonical identities, not selected-deck printed numbering. Deck aliases such as Art, Adjustment or The Universe affect display; they do not change membership.

## Detection and partial dispatch

[detectArchetypalTriads](../../functions/lib/knowledgeGraph.js) reports two or three distinct matching members. `matchedCards` and `missingCards` are canonical membership; `matchedNames` uses selected-deck labels; `matchedCardIndices` identifies every actual matching slot. Repeated Death cards in two relationship roles are two slots and one unique identity. They cannot form a pair alone or complete a three-member arc.

`getMajorPairKey` accepts exactly two distinct integer canonical Majors 0–21 and sorts numerically. Thus Lovers (6) plus Hierophant (5) resolves `5-6`, not `6-5`. A missing authored entry falls back to neutral wording about the matched cards only. It never falls back to the complete description or a substring/name heuristic.

```js
const pairKey = getMajorPairKey(matchedCards);
const partialText = triad.partialNarrative?.[pairKey]
  || `${matchedNames.join(' and ')} form a partial pattern; interpret only these drawn cards.`;
```

Complete and partial direct highlights explicitly qualify a possible shared theme, preserve positions/orientations and reject missing arc members as drawn evidence. The detector's complete-first order and the direct-highlight structural priority do not establish final GraphRAG relevance ranking.

## Prose boundaries

For Death plus The Star, discuss the relationship between change and hope in the actual spread roles. Do not infer that Temperance was skipped or that integration occurred quickly. For The Devil plus The Sun, discuss tension between attachment and clarity without inventing a Tower rupture. Even when all three members are present, the cards do not establish an addiction, breakup or other event without current user context.

Death–Star now uses the matched-only theme “Change accompanied by renewed possibility.” Other legacy authored phrases still require human editorial assessment. The 525 full/pair reference projection rows do not constitute blanket human approval of the 30 direct short pair wordings. Conditional wrappers and deterministic membership tests are not blanket approval of every phrase. The [projection review matrix](CANON_PROJECTION_REVIEW.md), [ledger](REMEDIATION_LEDGER.md) and [qualification status](QUALIFICATION_STATUS.md) retain the actual pending/approved state; do not infer approval from this reference.

## Pattern and deck projection

GraphRAG validates registered identity and authored content, projects the actual matched subset, then projects by selected deck before ranking. Unsupported anchors, unverifiable enrichment or unsafe deck projection are rejected. A partial arc receives only an explicit matching pair projection; no full-triad description or contextual variant may introduce its missing member. `candidateId` identifies pattern/context/subset, and `projectionId` adds version/deck. Original authored prose is preserved for review, while only projected title/theme/text/anchors enter scoring and generation.

RWS scene language must not be attributed to Marseille pips or Thoth artwork. Canonical catalog meaning remains authoritative; caller interpretations are separate untrusted input. The [runtime overview](README.md) describes ranking, allowances and final retention; the [reading input contract](../reading-context-inputs.md) describes source authority.

## Traditional background and qualification

The research foundations include Rachel Pollack's *Seventy-Eight Degrees of Wisdom*, Mary K. Greer's *Tarot for Your Self* and *Tarot Constellations*, Robert Place's *The Tarot: History, Symbolism, and Divination*, and Sallie Nichols' *Jung and Tarot*. They provide background for thematic reading practice, not evidence of personal events or provenance for a runtime quotation. Runtime passages are internally authored **Tableu Tarot Canon**; verified enrichment has separate source provenance.

Deterministic checks cover all 30 pair dispatches in either order/orientation, complete membership, duplicate slots, numeric keys, matched identities and projection rejection. Human review separately assesses recognizable meaning, conditional wording, absent-stage assumptions, deck fidelity and provenance. Generated-reading editorial review, subscription quality gates, live embedding behavior and deployment checks remain separate lanes.
