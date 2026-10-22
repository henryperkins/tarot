# Knowledge graph and context qualification status

Recorded: 2026-10-22
Implementation branch: `codex/knowledge-graph-context-20261022`
Implementation base: `7164fc21c6c9e5988c0c4ac368f843cc5cd0c1df`
Reading prompt version: **1.3.0**
Evaluator version: **2.5.0**

**Code implementation and deterministic qualification are complete. Subscription-authenticated generated-reading qualification remains blocked and pending. Human editorial review of all 145 meaning-only canon projections remains pending.** Committing and pushing the implementation branch preserves these open requirements; it does not mark the implementation as fully qualified for release.

The [implementation plan](../superpowers/plans/2026-10-22-knowledge-graph-context-remediation.md) records the task requirements, completed work and remaining acceptance checks.

## PR #121 review fixes

The three code findings from the review of `cb4c0198` are resolved:

- Possessive age modifiers fail closed when their owner is unresolved, including `my 42-year-old partner`, `my partner's 42-year-old friend` and named possessives. Unit and real-route regressions cover both current-input and stored-note directions, provider prompt exclusion and absent access stamps. Explicit age predicates and birthdays remain supported.
- Both prompt builders honor the current and legacy graph flags before regenerating canonical highlights. Coverage includes flag precedence, disabled defaults, deck identity and provider budget rebuilds. The deterministic gate distinguishes disabled graphs from enabled graphs with no reference passages.
- Topic-neutral general and card notes remain eligible for bounded retrieval. The initial allocation shares the existing note allowance across all eligible notes; a maximum-card regression retains the late topical note alongside neutral constraints. Conflicting-topic, duplicate and inactive saved-focus exclusions remain covered.

That follow-up added 62 tests. Independent review approved those three fixes and the qualification-harness correction. A subsequent review of `513caa9b` identified two further P2 issues, addressed in the next fix wave:

- The local fallback resolves explicit and inferred decision labels before replacing custom positions with stable A/B roles. Those same roles now drive flattened card notes and usage accounting, so cleared or replaced options cannot return through a card reflection. Regressions cover both sides, original-card immutability, inferred labels, nondecision notes and reflection-length boundaries.
- Ordinary memory-list access updates use batches of at most 98 IDs, leaving two D1 bindings for the timestamp and owner. Each update failure is nonfatal to the successful read and emits a fixed warning without database details. SQLite-backed regressions exercise authenticated requests for 98, 99 and 100 notes, failed batches, monotonic stamps, owner/session filtering and the write-free candidate-loading path.

This second fix wave adds 28 tests, including four route subtests. Independent review approved both fixes and confirmed the reading-specific selected/retained access lifecycle remains intact.

The re-review of `7dec3846` identified two further P2 issues, addressed in the third fix wave:

- Bare age authorization now requires an age-compatible continuation. Known measurements remain ordinary context; unsupported numeric continuations stay ambiguous and cannot authorize an age or bypass stored-detail filtering. Numeric commas and mixed fractions remain intact through clause splitting, including the Unicode fraction slash produced by NFKC. Completed measurement predicates can still separate a later named or relationship age clause. Route regressions prove that older unraised age notes stay out of provider prompts and receive no access stamp.
- The reading route flattens decision-card notes with canonical A/B roles after raw crisis screening. Explicit clears and replacements therefore cannot reintroduce obsolete restricted-topic labels through a card-note prefix. Current questions, general/card notes and normalized or inferred path labels still trigger selective evaluation when appropriate. Direct requests and reading jobs share this behavior; original raw-position crisis screening and nondecision positions remain covered.

This third fix wave adds 48 tests, including twelve route/job subtests. Independent bounded review passes 215 focused tests and fifteen asserted route probes, with no significant issue remaining in these two corrections. The eleven measurement probes exclude the private age note and its access stamp; four named/relationship age controls retain their matching note. Earlier failed probes remain preserved alongside the final passing evidence.

These fixes preserve the frozen corpus and pending acceptance requirements. The older candidate previews do not qualify the updated implementation. The PR remains in draft while subscription qualification and human editorial review are pending.

## Passing local evidence

The following local checks cover the PR review fixes. Subscription gates and human editorial approval are separate from these results.

| Check | Recorded result |
| --- | --- |
| Root Node suite (`npm test`) | 4,852 passed, two skipped, zero failures |
| Worker knowledge graph suite | 47 passed, zero failures |
| Deterministic qualification corpus | 73 synthetic fixtures and 219 provider prompt builds |
| Authored archetypal patterns | All 30 partial pairs and ten complete arcs |
| Deck projection coverage | 145 canon passages across three decks: 435 projections |
| Budget/fallback boundaries | Twelve explicit boundaries, including graph disabled versus passages removed |
| Repository and changed-file ESLint | Zero errors and warnings |
| Build, maintained documentation links and diff check | Passed |
| Independent code review | Original whole-change review and all three fix-wave reviews approved; all seven reported PR code findings addressed |

An earlier separate real Workers AI lane validated nineteen finite embedding vectors of 1,024 dimensions from `@cf/baai/bge-m3`. Sixteen paired cases used semantic scoring; two accurately reported no eligible patterns or passages. This lane predates the PR fixes and does not establish generated-reading usefulness, production latency or production cache behavior.

## Pending subscription qualification

- [ ] Pass `npm run ci:narrative-check` through the existing Claude subscription.
- [ ] Complete the frozen eighteen-pair quality comparison: eighteen baseline and eighteen candidate outputs, 36 outputs total.
- [ ] Review candidate readings against the actual inputs and the existing ethics, card-coverage and depth gates.

The original narrative-gate attempt used the existing personal Claude subscription, model `claude-opus-5-5`, effort `xhigh`, and stopped on its first sample because of the subscription usage limit. One attempt during each of the three review-fix waves also failed on its first sample with the Claude Code subscription request error. The third-wave attempt ran in an isolated source snapshot before the final numeric-boundary corrections; it does not qualify the updated source. Each attempt retains its own source identity and log. The latest read-only usage check confirmed the historical weekly limit below; this fix wave did not refresh that usage observation. The gate has **not passed**. No paid API fallback was used; the original sample, metric, review-queue and paired-comparison evidence remains unchanged.

The frozen baseline comparison attempted eighteen cases once and produced five readings and thirteen CLI failures. All failures remain recorded, with zero retries. Independent content review passed three available baseline outputs and failed two: one lost the named decision options, and one disclosed an irrelevant coastal-walk memory. Those two failures were not waived or omitted. All five available baseline outputs passed the saved structural/card-coverage checks, which did not detect those content failures.

Candidate narrative generation is **unrun**. Eighteen final candidate prompt previews and their source-usage metadata were captured without model inference. They are prompt-assembly evidence, not generated reading outputs. The 36-output paired quality comparison remains incomplete.

At the latest read-only live usage check, **2026-10-22 at 19:08 UTC**, the subscription reported weekly use of 100%, with a reset at **2026-10-24T04:00:00.344015Z**. The earlier 17:24 and 18:24 UTC observations remain preserved in their original evidence. These checks record the observed blocker; they do not assume that future access is available. A later qualification run must retain the original failed records, record its own source revision and attempts, and never overwrite or silently exclude failed cases.

## Pending human editorial review

- [ ] A human reviewer checks the semantic fidelity of all 145 meaning-only projections and records approval or corrections.

The [editorial checklist](CANON_PROJECTION_REVIEW.md) includes every original/projection pair and an unchecked review item for each passage. Agent authorship and independent agent reviews are complete. They do **not** satisfy the required human editorial review.

## Frozen qualification identity and local evidence

The paired case IDs, order and objects are frozen in [the synthetic fixture corpus](../../tests/fixtures/knowledge-graph-context-cases.json). The recorded identities are:

| Identity | SHA-256 |
| --- | --- |
| Fixture file bytes | `578e615034eaef0e188ae04986cfc9834b62c80943dae089873582cb0cd2ee29` |
| Canonical fixture JSON | `b0636009bccc517d71e9ebc3c07e2292c24945cf188667487226d170ffed9641` |
| Eighteen paired cases and order | `ae2ab4ee406b7b085d6e6f9887b32c7159bb9bf9522b1e33b7f040106acc1c95` |
| Canon/projection corpus | `77bc5a94ee589040318842e12174728403bb670bcfb73e9a71890a432a7f204f` |

The full qualification manifest, original failed attempts, synthetic generated readings, prompt previews, test logs and code-review reports are preserved locally under `.superpowers/sdd/2026-10-22-knowledge-graph-context-remediation/` in the implementation worktree. Exact source archives are preserved under `/home/ubuntu/.codex/artifacts/knowledge-graph-context-20261022/`. These local evidence files are not part of the Git publication; this status page, the fixture corpus and the human editorial checklist are tracked.

The fixture bytes, paired-case order and canon/projection corpus are unchanged by the PR fixes. Follow-up regression logs, local-check results and the fresh subscription observation are preserved in the `pr121-fixes-20261022-k3a3_5l4` directory beneath that artifact root. Original source archives and candidate previews predate these fixes and retain their original identities. Fresh generated-reading qualification must identify the updated implementation commit.

The subsequent two-P2 fix wave retains its own regression, verification, review and subscription evidence under `pr121-p2fixes-20261022-nlmsr0s2` beneath the same artifact root. Earlier failed attempts and their run identities remain intact.

The measurement and selective-evaluation corrections retain red/green regression logs, independent route probes, final source hashes, local checks and the isolated failed subscription attempt under `pr121-measurement-policy-fixes-20261022-24lxcpxf` beneath that artifact root. The source archives and all earlier failed or passing observations retain their original identities.

No merge, deployment, migration or production-behavior qualification is established by this branch publication.
