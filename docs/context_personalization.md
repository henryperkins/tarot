# Reading context and personalization

Type: implementation reference
Status: active reference
Last reviewed: 2026-10-22

Tableu combines current reader input, saved preferences and a small relevant set of remembered notes. Current input remains authoritative. The implementation is in [readingContextSources.js](../functions/lib/readingContextSources.js), [userPersonalization.js](../functions/lib/userPersonalization.js), [readingMemorySelection.js](../functions/lib/readingMemorySelection.js) and [userMemory.js](../functions/lib/userMemory.js).

This document describes the application contract. It does not require an external agent framework, automatic memory extraction, a new graph database, or a new memory schema.

## Current fields and precedence

Current question, general reflection, individual card reflections and named decision paths remain separate sources through topic selection, personal-detail matching and budget accounting. The accepted per-field limits are 2,000 question characters, 5,000 general-reflection characters, 2,000 per card reflection, 80 per path label and up to 78 cards. General notes do not consume a later card reflection's allowance.

A specific current question leads topic inference. Current reflections and decision labels can supply relevant subject matter or clarify an ambiguous question. Saved focus is used when current input supplies no usable topic. Current explicit preferences override older preferences and remembered communication styles. Sources are analyzed before the 8,000-character retrieval-query projection, so query truncation cannot silently promote stale saved interests over a relevant late card note.

Decision labels are optional A/B facts. Explicit labels override legacy labels inferred from the corresponding custom positions; explicit empty values clear that path. One-sided labels remain one-sided. Current labels participate in retrieval, memory selection and evaluator facts. Sanitized labels render inside untrusted JSON data boundaries. Their content cannot become prompt instructions or be reinterpreted as another path prefix during provider fallback.

The local fallback uses stable A/B position roles before folding card reflections into its notes section. This preserves each reflection without reintroducing a legacy option that an explicit label replaced or cleared. The normalized path facts supply the option names separately.

Language screening in both the reading route and local fallback includes the effective A/B labels. At the route, explicit and inferred labels in an unsupported language require evaluation; an unavailable evaluator blocks the reading. The local fallback rejects unsupported path languages. Cleared or replaced legacy labels do not participate in these checks. Raw-position crisis screening remains in place before normalization.

The full source fields remain available to narrative assembly independently of retrieval excerpts. Budget-truncated fields can retain complete JSON representations containing head/tail fragments and an omission marker. Source metadata distinguishes original, sanitized, eligible, included and represented lengths, sanitization changes, source-limit application, duplication and final budget loss. It contains no source text.

## Loading candidates and selecting notes

`resolveReadingPersonalizationContext` loads up to the store maximum of **100 global candidates** with `markAccess: false`. Candidate retrieval itself makes no access update. An older relevant note can therefore compete with recent unrelated notes. The existing unsafe-row retrieval filter retains private count-only diagnostics so candidate statistics still account for every fetched row.

Ordinary memory-list reads retain their separate access-stamp behavior. Their updates stay scoped to the owner and use bounded batches within D1's parameter limit. An access-write failure leaves successfully loaded notes available to the caller; it does not turn the list into an empty result. `markAccess: false` continues to skip those writes entirely.

`selectMemoriesForReading(candidates, { sources, displayName, limit, referenceTime })` is pure. It returns private `{ memories, selectedIds, stats }`, freezes the selected set and keeps it stable across attempts for that reading. Direct prompt builders run the same selector without database writes. Selection rejects malformed, unsafe, expired and non-global notes, ignores non-string keywords, and deduplicates IDs and normalized text.

Relevant life-context, theme, affinity and general notes require meaningful overlap with current sources. Unicode words and string keywords use the same tokenization. Saved focus cannot establish relevance or authorize a personal detail. At most one communication-style note without topic overlap is eligible; its style applies silently and remains subordinate to current explicit preferences.

The final cap is three. Eligible personal-detail notes rank first by distinct exact claim matches, then current-token overlap. Other notes rank by distinct meaningful overlap; communication status breaks a tie only in that general tier. Recency and stable ID break remaining ties. Zero, negative, fractional and other invalid caps select nothing.

## Personal details belong to a subject

An age/birthday note must match the same current detail about the same subject. All recognized details in a note must match; an additional unraised age rejects the entire note even when another detail, category or keyword is relevant.

| Current input | Stored note | Selection |
| --- | --- | --- |
| `I turn 42` | `I am 42 years old` | Eligible self detail |
| `My child turns 8` | `I am 8 years old` | Excluded: different subject |
| `Alice turns 42` | `Bob is 42 years old` | Excluded: different named person |
| `My birthday is approaching` | `My birthday is approaching; I am 42 years old` | Excluded: extra unraised age |
| `I turn 42; my child turns 8` | `I am 8 years old; my child is 42 years old` | Excluded: swapped owners |
| Question `I turn 42`; path `My child could move` | `My child turns 42` | Excluded: ownership cannot cross fields |
| `Bob turns 42` | `Alice & Bob turn 42` | Excluded: coordinated owners |
| `My 42-year-old partner wants a career change` | `I am 42 years old` | Excluded: the modifier does not establish self age |
| `Alice's 42-year-old partner wants a career change` | `Alice is 42 years old` | Excluded: the modifier does not establish the possessor's age |

The recognizer is conservative and clause-local. First-person and an unambiguous sanitized display-name alias map to self. Named people retain separate normalized names; a relation plus a name uses that person's name, including possessive birthday forms. Clear aliases such as kid/child, mom/mother and dad/father normalize together, while son/daughter and mother/parent remain distinct.

An unnamed singular relation supports only a role-level match, not real-world identity. If any current source identifies multiple people in that role, its unnamed role claims authorize nothing. Only ambiguity/name-set metadata is merged across independently analyzed fields; detail owners are never transferred between fields. Explicit `other child`, plural/group relations and multiple names can establish ambiguity even in a field without an age or birthday. Stored-note multiplicity receives the same check.

Ambiguous pronouns, groups, unsupported ownership and unattributed stored fragments authorize nothing. A current standalone `Turning 42` may be self when it has no competing subject; the same unattributed stored fragment remains unknown. The supported age notations include `8 years old`, `42-year-old`, `42 y/o`, `aged 100` and `turning 42`; `turns 3 cards` is not an age. This bounded English recognizer may exclude unfamiliar phrasing. It does not claim general person recognition.

Possessive age modifiers such as `my 42-year-old partner`, `my partner's 42-year-old friend` and `Alice's 42 y/o partner` have unresolved ownership and are excluded in either current input or stored notes. They cannot authorize the possessor's age or borrow an owner from another field. Explicit predicates such as `my partner turns 42`, `Alice's 42` and `Alice's a 42-year-old reader` remain supported. Route regressions verify that excluded notes reach neither the provider prompt nor successful-use access stamps.

Explicit ages in days, weeks or months, including `8 months old` and `8-month-old`, are recognized as personal details but remain ambiguous in this year-based matcher. They cannot be treated as ordinary topical notes or converted into a year-age claim. Prefixed shorthand such as `turns 8` must have an age-compatible continuation; decimals, fractions and ranges cannot authorize an integer age. This includes `turns 8.5 months old`, `turns 8 & 1/2 months old` and `turns 8 to 9 months old`. Unsupported quantities such as `eight months old` and `8-and-a-half-month-old` also stay ambiguous. Ordinary durations such as `2 weeks into a career change` remain eligible as context.

Numeric commas and mixed fractions remain intact during clause splitting, including ampersands in `42 & 1/2 miles` and Unicode fractions. A measurement cannot become a bare age merely because its fraction contains a conjunction. Separate supported age clauses still retain their own subjects.

## Rendering and callback guidance

Selected notes render as complete delimited JSON data blocks with request-local `memory-0` through `memory-2` slots, category and category label. Database IDs are absent from prompts and public metadata. The private slot-to-ID map remains outside promptMeta/sourceUsage.

A dedicated parser validates complete memory blocks in the **final** prompt. A budget cut drops an incomplete block atomically rather than leaving untracked text. Candidate, selected and retained counts therefore describe different stages. A selected note can be removed by a provider budget without receiving an access stamp.

The prompt asks for at most one remembered callback, only when it changes how a card applies to the current question. Communication styles apply silently. Current question, notes, labels and preferences override older context. Personal details must not be restated unless the same current detail concerns the same subject. A note's presence in a model prompt establishes retained context, not proof that the model mentioned or substantively used it.

The existing follow-up memory Markdown formatter remains separate from these initial-reading blocks. This change does not introduce automatic memory creation or change the stored memory schema.

## Successful-use access updates

`markReadingMemoriesAccessed(db, userId, ids, accessedAt)` stamps only matching global, unexpired rows for the resolved user. It uses the accepted result's fixed completion timestamp, converted from epoch milliseconds to the store's epoch seconds, and a monotonic SQL maximum. A late retry cannot undo newer access. Statements stay within D1's parameter bound.

Finalization intersects retained request-local slots, the private map and the frozen selected IDs after final evaluation. Failed attempts, rejected output, cancelled jobs, blocked evaluations and safe fallback stamp nothing. A discarded provider's retention does not carry into the next provider or local composer. The local composer currently renders no memory notes and reports zero retained notes.

Durable jobs hold usage privately until their guarded accepted terminal `done` transition. Cancellation immediately before completion discards it. Status/SSE replay and late cancellation neither refresh nor reverse successful access. Live Codex streaming records acceptance after its final abort check and terminal enqueue. Access persistence failure remains nonfatal and retries persistence at most twice using the same completion time; it never generates another reading. The failure warning contains no note text, ID or database error payload.

The bounded retries run within the request/job lifetime; this implementation adds no durable retry queue. A process lost before persistence completes can leave an access stamp missing. Historical retrieval timestamps are not retrospectively repaired or treated as evidence of actual successful use.

## Telemetry and qualification

Ordinary telemetry uses bounded counts, recognized field IDs and allowlisted reasons. It excludes raw questions, notes, labels, names, memory objects/IDs and embedding inputs. Private `selectedIds`, `memoryRetention` and slot maps stay server-side. Public `sourceUsage.memories` reports `candidatesProvided`, `memoriesSelected` and `memoriesUsedInPrompt`; it contains no remembered prose. Internal prompt telemetry preserves candidate/selected/retained counts and bounded exclusion counts.

Graph references and direct archetypal highlights have separate final-retention accounting. See the [knowledge graph overview](knowledge-graph/README.md) for both paths, source-deck projection, candidate scoring, unchanged final passage limits and provider caps.

Prompt persistence remains opt-in (`PERSIST_PROMPTS=true`) and redacted. Complete memory JSON blocks redact independently of their surrounding heading. Authorized prompt debugging retains its existing restrictions. Do not use telemetry as a side channel for personal text.

The synthetic qualification corpus and `node scripts/evaluation/verifyNarrativePromptAssembly.js` exercise actual context preparation, safe memory selection, graph candidate selection and final prompt budgets. Server tests stub external services and use isolated SQL fixtures. Generated-reading usefulness, subscription narrative gates, any separately authorized Workers AI evaluation, deployment and live behavior require their own evidence.
