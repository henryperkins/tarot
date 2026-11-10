# October 31 offline REL01 diagnosis, launcher correction and FRESH03 structural validation

The owner authorized diagnosis of REL01 and correction of launcher interruption and the FRESH03 structural flag in the isolated worktrees. This task generated **zero readings** and made no provider, authentication or embedding calls. Nothing was staged, committed, merged, pushed or deployed. Japanese prose quality alone remains waived; factual, agency, card, role, orientation, date, exclusion and other-language criteria remain in force.

The common correction is present in both `qualify/f3b-retrieval-only-20261031` and `qualify/narrative-grounding-20261031`, each still at HEAD `a030467351b2374a9c9a1d933eecc0498abcaca3`. The retrieval overlay's 1.6.2 narrative prompts and the separate narrative overlay's 1.6.10 prompts are unchanged by this task. The original complete candidate is untouched.

**F3b and the separate narrative content gate remain open/failed.** The [previous split record](GRAPHRAG_SPLIT_QUALIFICATION_2026-10-31.md), its REL01 judgment, the standard creative-project failure, interrupted attempts and all original captures remain immutable. The structural replay below is new offline evidence, not a replacement generation or an amendment of the historical content verdicts.

## REL01: observed failure and causal limit

Both arms have exactly the same question, cards, orientations, system prompt, shared narrative scaffold and first GraphRAG reference. Only the second reference block differs: the baseline integration-stage passage is replaced by the candidate Death/Temperance/Star triad.

The candidate triad begins “If a chapter is changing,” recommends considering a manageable practice, and explicitly says the cards do not establish that a transition is underway or predict how it unfolds. It does not assert an ongoing practice. The shared older scaffold already supplies Temperance's blending/integration vocabulary and calls it a live theme.

The candidate first offers a hypothetical practice, then says: “The patient blending you do now could open naturally into that calmer hope.” The baseline keeps “The skill you may be practicing now…”. The later candidate clause turns the earlier possibility into asserted present activity. That is the observed conditional-scope failure. The changed triad may influence topic selection, but one stochastic pair and shared scaffold wording cannot establish retrieval causation.

No narrative/prompt correction was made for REL01 under this diagnosis-only authorization. Its H1 failure stays in force. Any later causal comparison would need a declared paired batch and judgment rule that retains this failed first pair, rather than selecting a preferred replacement.

## FRESH03: structural correction with unchanged acceptance thresholds

The old validator required at least five whitespace-separated words in a sentence below a card-naming heading. Substantial Japanese paragraphs have no ASCII word separators. English-only structural-heading recognition also allowed Japanese introductory/synthesis headings to inflate the card-section denominator.

[`narrativeSpine.js`](../../functions/lib/narrativeSpine.js) now uses `Intl.Segmenter` word boundaries for Japanese/Chinese text, recognizes Japanese sentence punctuation and common Japanese structural headings, and excludes punctuation/emoji from word counts. The five-word minimum and route-local **75% card-section completion threshold remain unchanged**. A missing Segmenter retains conservative whitespace-based behavior. Card identity/coverage and all non-spine checks stay unchanged.

The exact saved FRESH03 candidate reading (`053de5b200d6e2421554f81ceb1bcbbc2e768ea65bf87be1417deda70294eddb`) changes from **1 complete / 4 detected card sections** to **3 / 3**, with four separate structural sections. This fixes the false structural flag without approving Japanese prose quality. Empty, short, punctuation-only, emoji-only and unanchored bodies retain negative coverage. Removing the present-card body produces 2/3 and still fails 75%; removing all card bodies produces 0/3 and fails.

An offline replay through the actual unchanged route-local quality function checked **35 saved semantic outputs and five saved standard outputs**. Stored old semantic metrics reproduced exactly. Only `FRESH03-candidate` changes its issue set; there are no new automated failures, and all five standard issue sets stay unchanged. Old thresholds and non-spine semantic metrics match exactly. The new source also runs in local workerd/Miniflare with the repository's `2025-11-24` compatibility date; Segmenter is available and the Japanese positive control completes. These checks do not judge content or claim universal language coverage.

## Launcher and capture lifecycle

The old split launcher ended with status 143 without its normal receipt, and detached descendants outlived their capture proxies. The exact source/sender of that historical signal is not established. Frozen historical tools are not edited.

The source-owned [qualification helpers](../../scripts/evaluation/qualification/README.md) accept an explicit evidence root and now:

- Install signal handling before reservation and cover the entire reserved lifecycle with terminal-receipt finalization, including interruption before a child starts.
- Use exclusive attempt reservations, preserve raw bytes before forwarding, retain failure/interruption outcomes and refuse retries or overwrites.
- Atomically check the lane's cap and reserve a slot under a shared lock, so distinct concurrent keys cannot consume the last slot twice. Failed/interrupted reservations remain counted.
- Track the owned Linux process family using child-subreaper adoption and PID start-time checks, including detached descendants. Cleanup does not select processes by name and leaves an unrelated sibling running.
- Observe provider exit while draining stdout, stop owned descendants holding the pipe open, and finish a bounded drain. Broken pipes and nested supervisor interruption preserve terminal evidence.
- Propagate signal interruptions through `/proc` inspection instead of swallowing them as ordinary disappearing-process errors; the capture loop also checks pending interruption state explicitly.

Model/effort/token settings, disabled tools, no-session-persistence checks, credential exclusions, frozen prompt hashes, plan membership, content halts and call ceilings remain enforced. SIGKILL, machine loss and filesystem failure cannot guarantee a terminal receipt; existing reservations still prevent automatic retry. The helpers do not replace the independent dispatch/content gates. Future authorized generation must freeze a fresh harness that binds these source helpers explicitly; the halted old evidence root must not be resumed in place.

One independent source review found three Important issues in the initial seven-file delta: startup receipt gaps, a concurrent cap race, and inherited-stdout blocking. All three were fixed with regressions that first failed against that revision. Broader verification then exposed the swallowed-interruption issue described above; it was also fixed and regression-tested. The final fixes were not independently re-reviewed. The reviewer found no new defect in the scoped FRESH03 change and explicitly declined to judge content causation, wider multilingual heuristics, the prior overlays, uncatchable termination, real-provider behavior or release readiness. Original review findings and later dispositions are stored separately.

## Offline verification

| Check | Retrieval worktree | Narrative worktree |
| --- | --- | --- |
| Credential-free root suite | 6,017 pass / 0 fail / 2 skips | 6,220 pass / 0 fail / 2 skips |
| Worker source suites | 70 pass | 70 pass |
| Prompt assembly (offline) | 874 fixtures / 2,541 builds | 874 fixtures / 2,541 builds |
| Frontend build | Pass | Pass |
| Shared changed-code ESLint / Python compilation | Pass; identical shared source in both trees | Same shared source |
| Focused structure/launcher checks | 52 pass, including 15 launcher/process checks | Identical source and tests; also included in the full suite |

Saved-output replay: 35 semantic outputs + 5 standard outputs, one corrected FRESH03 issue set and zero new flags. Independent validator controls and local workerd probe pass. Documentation link checks pass in both worktrees; the final `retrieval-docs.json` and `narrative-docs.json` receipts record them. Suites overlap and are not additive.

The first full retrieval suite on the intermediate launcher had one nested-capture failure; its log and receipt are retained. The final full suites use the corrected source. Changed-code ESLint initially found two empty cleanup catch blocks; explanatory comments resolved those. Source line endings in `narrativeSpine.js` remain as found, and whitespace checking accepts its existing CRLF convention. No `ci:narrative-check` command was run because it would generate new readings contrary to the current instruction.

## Preservation and evidence

The before/after inventories verify all **17 worktree HEADs, indexes/staged entries and 96 refs** unchanged. The **181 pre-existing dirty-file hashes outside the two owned status updates** are unchanged, including all 66 files in the original complete candidate and 46 other unrelated files. The journal performance test remains byte-identical (`ee8c106f1a650c194826f285a20cad0f49bc2d5c26d69867e3111255d5c6e2b1`). All **27,206 frozen split-evidence files** match their before-task hashes. The two status files retain their prior records below the new current section.

Evidence root: `/home/ubuntu/.local/state/tarot/f3b-offline-diagnostics-20261031T214735Z`.

- `diagnostics/REL01-diagnosis.json`, `REL01-diagnosis.md` and `REL01-prompt-diff.patch`: exact inputs, source/output hashes and diagnosis.
- `diagnostics/saved-output-quality-replay.json`, `worker-segmentation.json`: offline old/new route replay, negative controls and Worker runtime check.
- `review/`, `review-dispositions.json`: immutable independent review, local reproductions, later fix dispositions and limits.
- `final-source-manifest.json`, final check receipts/logs, `preservation-final.json`: tested source identities, verification and preserved state.
- `recovery/*-before/` and `recovery/*-after/`: full pending-work patches, file archives, hashes and reconstruction checks for each isolated worktree. Recoveries reconstruct outside Git; no branch or index mutation is needed to verify them.

The next content decision remains separate: REL01's unsupported current-practice assertion and the narrative lane's unsupported available-help claim are not cleared by these infrastructure/validator fixes. No remaining reading slots were started, and no content gate was weakened.
