# GraphRAG F1 continuation: lexical support for supplemental Majors

Date: 2026-10-24. **The four blockers from the [legacy-default record](GRAPHRAG_TASK9_LEGACY_DEFAULT_2026-10-24.md) are closed: two by correction, two by owner rulings.** This is a qualification record, not a release record. It covers no merge of the remediation branch, no deployment and no live production verification.

## Owner rulings

The owner replied "Proceed" to five proposals made after an independent verification of the legacy-default record:

1. **Approve the F1 lexical-support rule.** A per-card Major passage that only a multi-Major spread makes eligible (priority 7) counts as relevant only when the question shares at least one of its terms. Embedding similarity alone keeps it below the threshold. This amends the plan's F1 contract, which let a "demonstrably more relevant" per-card reference win on any evidence.
2. **Descope F3b from this release.** Its acceptance predicate covers only `REL02`, the Japanese paraphrase. Every `REL02` candidate has zero lexical overlap (k = 0), so any composition of k and cosine ranks those candidates by cosine alone. The relevant Death–Star dyad (0.528) loses both slots to the journey stage (0.534) and the Death–Temperance dyad (0.533). A redesigned formula would fail the same way, so F3b needs a different mechanism. The restored legacy formula matches production behavior.
3. **Accept S02 and S09 as not attributable to the remediation.**
   - S09's baseline and candidate prompts differ only by one summary label ("2 Major Arcana archetype(s)") and the envelope markers. "A recovery measured in seasons rather than days" has no source in either prompt.
   - S02's unsupported "You've already done the hard, gentle work" has no source in the newly selected Hermit passage.
   - Both match the shared tendency, recorded in both arms, to presuppose personal history. That tendency belongs to the reading-interpretation remediation, not to GraphRAG.
4. **Generate two subscription readings,** S01 and S08 on the F1 tree. These are the only paired prompts the rule changes.
5. **Ship the evaluator corrections to `master` separately.** This was done as PR #125, merge commit `3c37bdcc`. Production Worker `0819b46b` (from `70ecff1f`) was not redeployed.

## Source changes

| Commit | Change |
| --- | --- |
| `3c511ede` | `classifyCardMentions` excludes any card match that *overlaps* a terminology span. Previously it excluded only matches that started inside one, so "the Fool" in "the Fool's Journey" was counted as an undrawn Fool. This also affected the production quality gate, where it used up the per-spread hallucination allowance. The narrative evaluator now treats "doesn't offer guaranteed footing", "without a guaranteed outcome" and similar phrases as negated, while positive guarantees stay flagged. |
| `0a65047b` | `selectPassageCandidates` holds a supplemental Major without lexical support (k = 0) below the threshold. When nothing passes, the weak floor prefers a pre-existing candidate. Unchanged: single-Major priorities, priority-only and bypassed retrieval, the `0.3 * k + 0.7 * s` formula and the 0.3 threshold. |

## Relevance

The replay ran offline on the frozen `@cf/baai/bge-m3` vectors from Task 9, with zero vector misses and no network. It covered the full discovery, projection and retrieval pipeline of production baseline `7cd329a5` and of the F1 tree.

| Case | Production baseline relevant hits | F1 relevant hits | New false positives |
| --- | --- | --- | --- |
| REL01 | 1 | 1 | 0 |
| REL02 | 0 | 0 | 0 |
| REL03 | 1 | **2** (The Emperor, k = 0.125) | 0 |
| REL04 | 0 | 0 | **0** (The Lovers, k = 0, cosine 0.468, now held below the threshold) |
| REL05 | 2 | 2 | 0 |
| REL06 | 3 | 3 | 0 |
| REL07 | 2 | 2 | 0 |
| REL08 | 1 | 1 | 0 |
| REL09 | 0 | 0 | 0 |
| REL10 | 0 | 0 | 0 |

`verifyGraphRAGRelevance.js` reports no new false positives and no recall or cap regressions. It still returns `failed_acceptance_criteria` solely because `REL02` fails the zero-overlap predicate, which ruling 2 descoped. `REL01`–`REL10` had been seen before this rule was written, so they are regression evidence, not a held-out test.

## Paired and standard outputs

Offline probes on a verified export of `0a65047b` (3,468 tracked blobs, zero mismatches) show that the F1 tree changes only two paired prompts compared with the evaluated candidate `a510194c`:

- **S01** (Hermit / Hanged Man / Moon, "Any guidance?") gets the complete "Inner Work Arc" triad back in place of the Moon's single-card passage. The Hermit passage stays because it shares "guidance" with the question.
- **S08** (Death / Temperance / Star, Spanish interview question) gets the Death–Star dyad back in place of the Star's single-card passage, which is the baseline selection.

The other ten paired prompts and all eleven standard `ci:narrative-check` prompts are byte-identical. Their saved outputs stay valid, and reuse was asserted by prompt hash.

The budget (two outputs, at most four attempts) was declared before inference. S01 and S08 were generated once each through the existing Claude subscription: `claude-opus-5-5`, effort `xhigh`, 32,000 output tokens. That was 2 attempts, 0 failures, 0 replacements, no paid API fallback and no live embeddings.

| Gate (fixed evaluator from `0a65047b`) | Samples | Result |
| --- | --- | --- |
| F1 paired set (S01 and S08 new, ten reused) | 12 | Pass, 0 flags, 100% spine and card coverage |
| Baseline paired set | 12 | Pass, 0 flags (previously failed on the Fool's Journey false positive) |
| Standard `ci:narrative-check` outputs | 11 | Pass, 0 flags (previously failed on the negated-guarantee false positive) |

`npm run ci:narrative-check` was not rerun because its prompts are byte-identical on this source. Its saved outputs were re-scored instead.

**Output review (agent review, not human approval).**
- Both new readings cover every card in position, use correct RWS imagery, give useful optional steps and keep agency. S08 answers in Spanish, uses the supplied interview-this-week reflection, and says only the reader knows what ended.
- S01 explicitly connects all three cards ("withdraw, release, then walk through fog") through the restored triad.
- Both repeat the shared grounding tendency already present in their earlier baseline and candidate outputs:
  - S01 asserts "You've done the thinking and stepped back".
  - S08 reads an ending into the past Death card and asks "why you're seeking this change".
- Neither reading has a grounding failure that is new relative to its pair.

## Verification

| Check on `0a65047b` | Result |
| --- | --- |
| `npm test`, credential-free environment | 5,878 passed, 2 skipped, 0 failed |
| Worker graph and spread suites | 64 passed |
| Prompt assembly (`verifyNarrativePromptAssembly.js`) | Passed: 874 fixtures, 2,541 provider builds |
| Editorial generator (`buildCanonProjectionReview.js --pipeline`) | Reproduces the committed 1.6.0 artifacts byte for byte: 191 groups accepted, 0 pending |
| ESLint and whitespace on changed files | Passed |
| New regression tests | Fail on the previous source, pass on this source |

Latency was not remeasured. The rule changes selection only: it embeds the same candidates as `a510194c`, and the earlier Task 9 latency evidence still applies with its stated limitations.

## Evidence

- Continuation lane: `~/.cache/tarot-graphrag-remediation-20261024/task9-f1-continuation/`. It holds the budget, verified tree export, probes, attempt ledger, prompts, outputs, metrics and gate logs.
- Offline replay and re-scoring artifacts, with a README: `~/tableu-evidence-archive/graphrag-f1-lexical-support-2026-10-24/`.
- The legacy-default evidence and its archive are unchanged.

## Remaining before release

1. Merge the remediation branch.
2. Deploy with `npm run deploy`, which runs fresh release QA on the subscription-authenticated host.
3. Verify the active Worker, assets and a representative signed-in reading.

F3b and the shared history-presupposition tendency remain open as separate work.
