# Knowledge graph runtime reference

Type: index
Status: active reference
Last reviewed: 2026-10-23

Tableu detects patterns among the cards actually drawn and can provide internally authored reference passages. This is a compiled pattern registry, not a graph database or general semantic corpus search. Current implementation and qualification are separate: consult the [remediation ledger](REMEDIATION_LEDGER.md) and [qualification status](QUALIFICATION_STATUS.md) before making release claims.

## Two runtime paths

**Direct pattern highlights** come from [knowledgeGraph.js](../../functions/lib/knowledgeGraph.js) and [graphContext.js](../../functions/lib/graphContext.js). They cover Major journeys, complete/partial triads, dyads, suit progressions, courts and deck-specific patterns. Their structural priority selects at most five highlights. Membership uses canonical card identity; prose remains subordinate to the actual spread positions and orientations. A complete arc does not establish chronology or prove a life event. For Death and The Star alone, a safe reading discusses transformation and hope without inventing Temperance's integration stage.

**GraphRAG passages** come from the authored [knowledge base](../../functions/lib/knowledgeBase.js), registered partial projections and approved enrichment. [Candidate collection](../../functions/lib/graphRAGCandidates.js) enumerates every eligible registered variant. [Pattern/deck projection](../../functions/lib/graphRAGProjection.js) validates matched subsets, removes unsupported anchors and applies the selected deck before [ranking](../../functions/lib/graphRAG.js). Only validated projected title, theme, text and anchors reach scoring or prompt formatting. Original authored text remains review/provenance material. `candidateId` distinguishes pattern/context/matched subset; `projectionId` adds projection version and selected deck.

The direct path's structural ordering is not GraphRAG's final relevance order. A relevant partial passage can outrank a complete arc. Invalid projection is omitted before ranking and cannot re-enter through a weak-match floor or quality-filtering bypass.

## Drawn-card facts and context authority

Total Major slots, unique Major identities, journey membership, triad membership and matched slot indices are separate facts. Duplicate cards in separate roles retain their original slot identities but cannot manufacture a third distinct triad member. Major counts remain available even without a dominant journey stage or other pattern. Request-level deck selection takes precedence; display aliases do not change canonical membership.

Current question, general notes, card reflections and effective decision labels are classified in full within their independent accepted limits. They override saved interests and memories. One private server-created `ContextSelection` carries the decision through analysis, retrieval, provider attempts and fallback. A separate query projection is bounded to 8,000 characters; question-led note excerpts share 750 characters. Mixed notes contribute only eligible topic spans. Classification coverage, query coverage and final reading inclusion are distinct. See the [reading input and source-use contract](../reading-context-inputs.md).

The catalog resolves canonical upright/reversed meanings. MCP accepts optional incoming `meaning`; the direct API retains its required nonempty compatibility field and exact `Upright`/`Reversed` orientations. A differing incoming meaning is derived into separate `callerMeaning`, never canonical authority or factual memory authorization. Explicit decision labels use wire keys `a`/`b`; empty strings clear labels, omission can use a legacy position label, and original card positions remain unchanged.

## Ranking, limits and flags

Normal ranking orders by relevance, context compatibility, structural priority and stable identity. Full normalized text controls deduplication; a duplicate variant does not prevent that pattern's next eligible variant from competing. Threshold filtering, the explicit one-best weak floor and final allowances follow global consideration. Priority/bypass paths use structural ordering and deterministic context/default variants without nominal relevance scores.

| Spread | Paid allowance (Plus and Pro) | Free allowance |
| --- | ---: | ---: |
| single | 1 | 1 |
| threeCard | 2 | 1 |
| fiveCard | 3 | 1 |
| celtic | 5 | 2 |
| decision | 3 | 1 |
| relationship | 2 | 1 |
| general | 3 | 1 |

These are final passage allowances, independent of candidate enumeration and the direct-highlight maximum of five. Invalid/zero explicit passage limits perform no embedding work.

Mode precedence is graph-disabled, quality-filtering bypass, semantic, keyword, then priority. GraphRAG flags preserve disabled defaults; explicit semantic-off makes zero embedding calls. Bypass retains card/deck/provenance/data-safety validation and final caps while bypassing relevance, threshold and deduplication work.

Semantic scoring uses `0.3 * keyword + 0.7 * cosine` only when every required vector is real, finite, nonzero and dimension-compatible. Failure, missing binding, cancellation or timeout falls back comparably across the complete eligible set; pseudo-vectors never qualify as semantic. The compiled registry budget is 1,000 passages. Overflow embeds no first-N subset and uses whole-set keyword fallback. Retrieval has one 3,000 ms work deadline, batches of at most 100 texts and at most two concurrent batches. Ignored-abort late responses cannot write the cache. The cache remains 100 entries, so a repeat is not necessarily a warm full corpus. These are implementation bounds, not measured live latency or quality guarantees. See [provider reference](../provider-reference.md).

## Attribution and final inclusion

Runtime canon references are attributed to **Tableu Tarot Canon**, internally authored; traditional books cited in the research documents are background, not quoted runtime sources. Verified enrichment provenance remains distinguishable. No pattern establishes an undrawn card, foreign deck scene or unprovided personal event.

Public additive `sourceUsage` describes the accepted backend's final input, or deterministic text actually rendered. It establishes inclusion, never model attention, factual accuracy or usefulness. Discovered/projected/scored/selected counts are not retained counts. Summary-only references contribute zero full passages; unknown legacy counts remain unknown. Opaque legacy reference blocks without verified registry provenance are omitted. UI/journal references use final retained indices and projected identities; the earlier five-passage context-independent retrieval is a preview.

Provider attempts retain independent usage. Rejected attempts and canned safety replacements cannot lend their source-use claims to accepted text. Normal reasoning-aware local composition does not render graph references or direct pattern highlights and reports `not_used_by_backend`; lower-level no-reasoning builders may synthesize safe patterns actually rendered. Debug reference appendices do not establish normal reading use.

Memory candidates are bounded to 100, selected slots to three, and complete retained prompt blocks to three. Selection freezes before budgeting. Initial-reading access timestamps record successful server acceptance of retained complete blocks, not retrieval or client observation. Durable jobs atomically persist a private receipt and replay only its DB update; direct persistence remains best effort. The [input contract](../reading-context-inputs.md) documents privacy, cancellation and rollback limits.

## Research and review references

- [Fool's Journey](FOOLS_JOURNEY.md): Major stage background.
- [Archetypal triads](ARCHETYPAL_TRIADS.md): all ten active triads and matched-only pair dispatch.
- [Archetypal dyads](ARCHETYPAL_DYADS.md): two-card research background.
- [Suit progressions](SUIT_PROGRESSIONS.md): Minor pattern background.
- [Canon projection review](CANON_PROJECTION_REVIEW.md): actual projection rows and human verdicts. Agent checks do not supply human approval.
- [Narrative architecture](../architecture/narrative-architecture.md): accepted-attempt flow.

Release, live Workers AI, owner-subscription generation, human editorial approval and deployment remain independently evidenced lanes. Old qualification counts and failed attempts retain their historical source identities.
