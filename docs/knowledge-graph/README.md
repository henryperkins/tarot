# Knowledge graph and reading context

Type: index
Status: active reference
Last reviewed: 2026-10-22

Tableu detects relationships among drawn cards and supplies supporting context to narrative generation. Canonical card identity, orientation, deck and spread position remain authoritative. A graph pattern cannot establish that an absent card was drawn or that an unprovided fact about a person is true.

The runtime passages are internally authored **Tableu Tarot Canon**, maintained in [knowledgeBase.js](../../functions/lib/knowledgeBase.js). Books cited in the pattern specifications are background reading, not the provenance of these passages. Do not describe a runtime passage as a quotation from a book or author.

## Two independent graph inputs

The generation prompt receives two graph-derived inputs. Each must be valid independently, and their retention is reported separately.

| Input | Construction | Final accounting |
| --- | --- | --- |
| Archetypal highlights | Pattern detection over the actual drawn cards, then canonical highlight generation for the selected deck | `sourceUsage.patterns.patternsProvided` and `patternsUsedInPrompt` |
| GraphRAG references | Detected graph keys → all eligible canon variants → deck projection → relevance scoring → selection → final prompt budget | `sourceUsage.graphRAG.mode`, passage counts and retained `passageIndices` |

Filtering passages cannot repair an incorrect highlight. Enhanced and direct user-prompt builders regenerate highlights from the actual cards and selected deck. Provider rebuilds count only highlight lines present in the final prompt. The local composer has its own accounting and does not claim reference use simply because patterns were detected.

A two-card partial triad uses its exact authored partial narrative. Its highlight names the two drawn cards and marks the arc as partial. The missing card can remain private pattern metadata; it is not drawn-card evidence. Full-pattern passages and journey references, when retained as background, include a guardrail against asserting undrawn cards. A summary reports pattern signals and retains that guardrail without claiming that any full passage survived.

## Current-source selection

[readingContextSources.js](../../functions/lib/readingContextSources.js) preserves field identity before topic analysis. Current fields are `question`, `reflections`, `card-0` through `card-77`, and `pathA`/`pathB`. Saved focus has separate `focus-*` IDs.

The topic selector analyzes each accepted field before constructing a bounded retrieval query. A specific current question leads. Current general/card reflections can supply or clarify the topic; named decision paths participate as current input. Saved focus is a fallback when current fields provide no usable topic. A relevant note on card 78 still participates when the general reflection already uses its own full allowance.

Accepted limits remain 2,000 characters for the question, 5,000 for general reflections, 2,000 per card reflection, 80 per decision label and 78 cards. These are per-field limits, not a shared reflection concatenation budget. Decision labels preserve A/B identity. Explicit labels take precedence over labels inferred from the corresponding custom positions; explicit empty values clear that path. Omitted and one-sided labels remain valid. The normalized internal path map is reused rather than repeatedly interpreting its text as another position prefix.

The retrieval query is a separate projection capped at **8,000 characters**, including labels and separators. It allocates question/path text and relevant excerpts, preserving offsets into original Unicode text. It does not replace the full current sources supplied to narrative generation. Query coverage reports lengths, omissions and bounded reasons; a source can influence topic selection yet be partly or wholly omitted from the smaller query.

## Candidate enumeration and final limits

[graphRAGCandidates.js](../../functions/lib/graphRAGCandidates.js) enumerates every eligible context variant of every triggered pattern before applying a presentation cap. Stable private identity combines pattern type, pattern ID, context variant and source tradition. One strongest variant per pattern survives; full-content deduplication and the relevance threshold then precede the final cap.

Semantic scoring, when enabled and available, embeds the bounded query and every projected candidate. It does not stop at twice the final allowance. The query vector is shared across batches of at most 100 texts. Scoring uses 30% lexical overlap and 70% cosine similarity. An invalid/missing vector makes that whole candidate ranking use one lexical scale; partial semantic and lexical scores are not mixed. Cache and batch counts describe the work performed without exposing embedding text or vectors.

| Spread | Plus/Pro final maximum | Free final maximum |
| --- | ---: | ---: |
| Single | 1 | 1 |
| Three-card | 2 | 1 |
| Five-card | 3 | 1 |
| Celtic Cross | 5 | 2 |
| Decision | 3 | 1 |
| Relationship | 2 | 1 |
| General/custom | 3 | 1 |

These limits apply after candidate scoring. If relevance filtering removes every eligible pattern, the floor may retain one explicitly marked weak match. It is background about the spread, not evidence about the querent's circumstances or a basis for predictions. No query uses priority/context defaults without claiming measured semantic relevance. `DISABLE_QUALITY_FILTERING` keeps deterministic pattern priority and context defaults, skips embeddings and reports `bypassed`; it does not disable deck projection or provenance validation.

## Source tradition and deck projection

The base triad, journey, Major Arcana, dyad, suit-progression and court-lineage collections are RWS-sourced. Dedicated Thoth-suit and Marseille-numerology collections carry their own source traditions. The selected deck and a reference's source deck are different facts.

Each canon passage has authored `archetypalText`. Same-tradition generation can retain its authored quotation and supported visual anchors. Cross-deck generation uses the archetypal meaning projection and an empty visual-anchor list. The displayed authored quotation remains available separately. Cross-deck references identify their source tradition and state that its imagery is not evidence of the selected deck.

All 145 canon passages are projected against RWS, Thoth and Marseille in the deterministic gate. An unknown selected deck, unknown source tradition, or unverifiable cross-deck legacy prose cannot supply generation evidence. A legacy opaque `formattedBlock` can support only a qualified pattern summary when actual graph keys exist. It cannot establish quoted-passage provenance. No test-only projection bypass exists.

## Prompt retention, fallbacks and telemetry

Prompt slimming remains opt-in with `ENABLE_PROMPT_SLIMMING=true`; `DISABLE_PROMPT_SLIMMING=true` wins. The existing hard caps still apply without slimming: Claude 25,000 estimated tokens, OpenAI 20,000 and the default target 15,000. Modal has no application prompt cap.

`promptMeta.graphRAG.includedInPrompt` describes actual final inclusion, including summary-only inclusion. `passagesProvided` counts supplied references; `passagesUsedInPrompt` counts full retained passages. `parseStatus` and `referenceBlockClosed` distinguish a complete reference boundary from an absent/partial one. `sourceUsage.graphRAG.mode` is `full`, `summary` or `none`; only `full` can have retained passage indices. The indices address the original selected payload after budget ranking and support precise reader-facing quotation display.

Candidate counts distinguish discovered, projected, scored, deduplicated, threshold-rejected and finally selected references. Projection rejection and semantic fallback have separate bounded reasons. These counts do not prove useful generated prose. Current-context coverage, graph references, direct highlights and memories each have their own retention metadata.

A safe fallback exposes no source-usage attribution from discarded output. A local-composer result replaces prior provider retention; detected patterns or available passages alone do not establish reference use. Provider retries retain canonical cards and the frozen safe memory selection, while rebuilding and accounting for the actual final prompt.

Raw questions, reflections, labels, names, memory text/IDs and embedding inputs stay out of ordinary telemetry. Prompt persistence remains opt-in and redacted. Prompt debugging retains its existing authorization requirements. See [context and personalization](../context_personalization.md) for memory ownership and successful-use access updates.

## Pattern references and qualification

- [Qualification status](QUALIFICATION_STATUS.md): passing local checks and the pending subscription and editorial requirements.
- [Canon projection editorial checklist](CANON_PROJECTION_REVIEW.md): all 145 original/projection pairs awaiting human review.
- [Fool's Journey](FOOLS_JOURNEY.md): dominant Major Arcana stage.
- [Archetypal triads](ARCHETYPAL_TRIADS.md): ten complete arcs and thirty authored partial pairs.
- [Archetypal dyads](ARCHETYPAL_DYADS.md): supporting two-card relationships.
- [Suit progressions](SUIT_PROGRESSIONS.md): Minor Arcana developmental sequences.

Run `node scripts/evaluation/verifyNarrativePromptAssembly.js` for offline qualification, or add `--json` for the count/hash manifest. The gate uses the maintained synthetic corpus through real source preparation, pattern detection, complete candidate enumeration, projection, selection and final builders. It exercises provider budgets and fallback boundaries with external services stubbed. The eighteen paired case IDs, order and fixture bytes are frozen for a separate subscription quality comparison.

Deterministic assembly, generated-reading review, subscription narrative gates, any authorized real Workers AI retrieval lane, deployment and live proof are separate evidence. A passing assembly gate establishes these structural contracts; it does not establish that generated prose is useful or that a release is deployed.
