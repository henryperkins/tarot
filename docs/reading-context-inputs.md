# Reading context input authority

The web API and MCP reading tools use the same reading request contract. `decisionPaths` accepts optional `a` and `b` strings of at most 80 characters. An empty string clears that path label; omission permits a legacy label from the second or third decision card position. Only one outer `Path A` or `Path B` prefix is removed. Other spreads ignore these fields and record `decisionPaths:not_applicable`. Original card positions remain the reading's stored identity; prompt presentation uses stable path roles.

Card identity, orientation and catalog meaning are resolved on the server. `meaning` in a resolved card is always the canonical upright or reversed catalog meaning. The catalog currently supplies orientation-aware meanings shared across supported decks; existing selected-deck semantic context and imagery restrictions still apply in prompt construction. A differing incoming meaning is sanitized and retained separately as `callerMeaning`, at most 1,000 characters. Catalog-identical meanings create no personal interpretation. Client-supplied `callerMeaning` cannot override this derivation. MCP forwards the original incoming `meaning` to the reading job, allowing the real route to repeat the same derivation safely; its private snapshot stores the canonical meaning and derived caller interpretation.

Caller interpretations are quoted as untrusted personal interpretation in provider prompts. Their final prompt retention is reported in `sourceUsage.userContext.fields['interpretation-0']` through `interpretation-77`, separately from card reflections. They never participate in topic classification, graph identity or factual memory authorization. Budget fitting preserves their serialized data boundaries, and redaction includes these interpretations. The deterministic local composer currently reports them as omitted with `not_used_by_backend`.

`useSavedMemories` is an optional boolean, defaulting to true when absent. Explicit false prevents candidate loading, selection and successful-use access writes, and reports `disabled_by_request`. It governs the current reading, independently of memory storage or follow-up capture. The signed-in preparation checkbox carries this choice into the job and its request identity; retries retain the choice, and beginning a new reading restores the checked default. Browser snapshots preserve the choice across restoration of an in-progress reading. No database migration is needed.

MCP supplied-card tools also accept each card's `userReflection` up to 2,000 characters. Drawing tools accept decision labels and memory reuse but no per-card reflection before the draw. General notes and raw/effective decision labels remain in private job snapshots. MCP journal saves preserve general notes in the existing reflections column, card reflections and caller interpretations in each stored card, and decision path raw/effective labels in the corresponding card's `decisionPath` metadata. Original positions are unchanged.


## Independent source limits and selection

Accepted limits apply independently: question 2,000 characters; general notes 5,000; each card reflection 2,000 across at most 78 cards; each decision label 80; sanitized focus list at most 12. Incoming meaning is at most 1,000 characters. The direct API validates before canonical resolution and requires a nonempty `meaning` plus exact `Upright`/`Reversed`; MCP permits omitted meaning and either normalized/lowercase orientation, then adapts into that direct-route contract. The draw API takes no supplied cards: its server-generated cards already include normalized orientations and catalog meanings. MCP schemas are strict, including unknown card/personalization properties. The direct request schema has existing preprocessing/catchall behavior; the nested decision object is strict on both surfaces. Reject null/nonstring/oversized explicit decision values and nonboolean memory reuse. Do not send private `ContextSelection`, `callerMeaning`, receipt or attempt fields as request authority.

[prepareReadingContextSources](../functions/lib/readingContextSources.js) prepares full accepted current sources before classification. The server resolves one version-1 private `ContextSelection` and passes it through analysis, prompt builders and fallback. Current question, relevant notes/card reflections and effective decision labels override saved interests and memory. Saved focus cannot authorize a personal fact. Client JSON cannot create an authoritative selection.

A separate retrieval projection has at most 8,000 characters including source labels; keyword ranking uses content-only text. Question-led note excerpts share 750 characters total. Mixed-topic notes contribute eligible topic spans, rather than unrelated text merely because the source also contains one matching sentence. Not every eligible note is guaranteed an excerpt. Classification coverage, topic eligibility, query excerpt coverage, selected references and final retained sources are different stages. Public context diagnostics expose fixed source IDs, lengths/counts, reason codes and categories; full source objects, query text and notes stay private.

## Memory selection and initial-reading access

Initial readings load at most 100 current owner/global/unexpired candidates without stamping retrieval access. The conservative selector retains at most three relevant, compatible memories, freezes that selection before provider budgeting, and omits unsupported factual, conflicting, wrong-subject or ambiguous claims. Communication preferences can be applied silently; current inputs override remembered context and prompt guidance permits at most one relevant remembered note to be mentioned.

Compatibility checks have bounded vocabulary, subject and numeric-claim rules. They are not a general health classifier, multilingual factual verifier or guarantee that every unsupported claim will be recognized. Conservative omission and human/generated-output review remain necessary. Other memory-list and follow-up callers retain their existing access semantics.

Selected memories become complete request-local `memory-0` through `memory-2` blocks. Budgeting retains or removes a whole block; slot-to-memory-ID mappings remain server-private. Only complete blocks retained by the accepted attempt can authorize an initial-reading `last_accessed_at` update. Rejected provider attempts, gate replacements, crisis responses, cancelled-before-acceptance jobs and budget-omitted memories stamp nothing. A normal reasoning local composition renders no memories and has no such access effect.

Direct responses dispatch optional idempotent persistence after final server acceptance and the last abort check. This is best effort and can be lost on process termination. Client receipt/observation is not the acceptance criterion. Optional DB failure does not replace an accepted reading.

Durable jobs persist successful terminal result, event, fixed expiry and private accepted-attempt identity together with a **separate private `readingMemoryReceipt` storage key in one transaction**. Cancellation observed before the transaction's acceptance guard wins. An overlapping cancellation after that guard cannot undo the accepted transaction; public `done` and DB stamping wait for durable completion. This is a logical acceptance boundary, not a promise that every cancellation before physical storage acknowledgment wins.

Restart replay validates principal, job/run, request and accepted-attempt identities and replays only the idempotent DB update with original `completedAt`; it never generates a new reading. At most three persisted rounds, each with up to two immediate DB attempts, bound retries to six attempts. Alarm retry delays are 5 and 30 seconds. Receipt retries never extend the original one-hour web or 24-hour MCP retention; purge removes both private keys. Exhaustion leaves optional accounting incomplete, with fixed diagnostics. Owner/global/current-expiry predicates and monotonic timestamps protect deleted, expired or changed-owner rows. Existing D1 timestamps are reused; no schema migration is introduced.

## Accepted-attempt source usage

Additive public `sourceUsage` reports final accepted backend input or deterministic content actually rendered. It proves inclusion, never model attention/reliance, accuracy or usefulness. Each provider attempt has its own metadata; a rejected attempt's retained blocks cannot be inherited by a later provider or canned safety replacement. Consumer absence means unknown/omitted safely, not successful use.

`sourceUsage.memories` contains only `requested`, `used`, `candidatesProvided` (0–100), `memoriesSelected` (0–3), `memoriesUsedInPrompt` (0–3) and fixed `skippedReason`. Pattern/reference discovery, projection, scoring and selection counts remain distinct from final retention. `sourceUsage.userContext.used` includes retained caller interpretations even when they are the only retained personal context; they remain separate from canonical meaning, reflections, classification and memory authorization.

Full verified GraphRAG reference blocks have final selected indices and projected identities; summary-only legacy material counts as zero full passages. Unknown legacy counts remain unknown; absent/incomplete blocks have distinct parse outcomes. Unverified opaque legacy blocks are omitted with `unverified_reference_provenance`. Intermediate `budgetTrimmedTo` is not a final retained count. UI and journal source displays use the accepted attempt's final indices; an earlier context-independent five-passage lookup remains a preview.

Normal reasoning-aware `local-composer` does not render direct highlights, GraphRAG references, memories or caller interpretations and reports `not_used_by_backend`. Lower-level no-reasoning builders may render safe pattern synthesis and report only actual rendered inclusion. An explicit debug appendix does not turn references into normal reading use. Claude/OpenAI retain soft budgets, opt-in slimming and estimated hard caps of 25,000/20,000 tokens. Modal's uncapped application policy does not verify serving window, tokenizer, reserve or truncation capacity.

A synthetic bounded usage example (no production observation):

```json
{
  "memories": {
    "requested": true,
    "used": true,
    "candidatesProvided": 12,
    "memoriesSelected": 2,
    "memoriesUsedInPrompt": 1,
    "skippedReason": null
  },
  "graphRAG": {
    "used": true,
    "candidatesDiscovered": 20,
    "candidatesProjected": 18,
    "candidatesScored": 18,
    "finalSelectedCount": 3,
    "retainedPassageCount": 1,
    "passagesUsedInPrompt": 1,
    "passageIndices": [1],
    "scoringMethod": "keyword",
    "selectedDeck": "thoth-a1"
  }
}
```

Public metadata, ordinary logs and telemetry contain no memory IDs/text, questions, notes, path labels, names, embedding inputs/vectors, credentials, receipt contents or private run/attempt mappings. Fixed public field IDs such as `question`, `card-0` and `interpretation-0` identify slots, not personal identities. Protected opt-in prompt debugging follows its separate authorization and sanitization contract. MCP intentionally returns its compact outcome/theme surface rather than the web API's full source-use metadata; see [MCP contract](integrations/openai/chatgpt-mcp.md).

## Compatibility, release and rollback checklist

The [ledger](knowledge-graph/REMEDIATION_LEDGER.md) and [qualification status](knowledge-graph/QUALIFICATION_STATUS.md) are the evidence authorities. Documentation and prompt version changes must freeze before final deterministic qualification; historical candidate results cannot qualify a new source identity. The following is a checklist for separately authorized release stages, not evidence that any stage happened:

1. Freeze reviewed executable source, reading/evaluator versions, fixture order, corpus/projection hashes and reference time. Record deterministic tests, human editorial verdicts, subscription narrative gate, bounded baseline/candidate outputs, live Workers AI measurements and Modal serving limits as separate lanes with failures preserved. Human approval remains a human action.
2. Review the final diff, text-free telemetry examples and known limits. Commit, push, merge, plugin publication and deployment require the applicable authorized stage. Local source checks do not establish live OAuth, model quality or release readiness.
3. Before deployment, preserve exact previous release source/manifest and observe active Worker version/traffic, actual GraphRAG/semantic flags and AI binding. Committed Wrangler settings establish intent only. Run required local release checks and `npm run deploy` on the subscription-authenticated host. GitHub Actions billing is unavailable; Actions success is not a prerequisite. Hosted Workers Builds needs its own private subscription gateway.
4. Verify the new active Worker version/traffic and live assets independently of Git publication. Then perform only authorized controlled direct and job readings against known deployed source, assessing context provenance, retained references/memories, accepted provider/fallback, errors and latency separately. Add MCP live parity only when included in that lane's authorization.
5. Choose a recorded, tested compatible rollback identity. Added response fields can be ignored, but older request parsers may reject/strip decision labels or `useSavedMemories:false`, silently changing behavior. Check opt-out, explicit clears and catalog/caller meaning authority with the paired client/server.
6. Drain and verify pending receipts before rollback, or target a reviewed receipt-aware Worker. Old envelope rewrites cannot overwrite the separate receipt key directly, but can erase run/accepted-attempt identity; later strict replay must then reject the unverifiable receipt. Old code does not retry receipts, and old retention cleanup can delete them. Arbitrary old-version rollback therefore cannot promise pending access accounting. Record any unavoidable loss; never weaken matching guards or regenerate a reading to recover it. Previously committed timestamps remain valid historical acceptance and cannot be undone by reverting code.
7. Monitor unresolved receipt failures, empty projections, unexpected zero-Major counts, fallback rates and context-source drift using bounded counts and fixed reasons. Preserve original expiry and ensure old/new status, SSE, MCP snapshots and journal paths never expose private receipt identities.
