# Knowledge graph and context qualification status

Recorded: 2026-10-22
Implementation branch: `codex/knowledge-graph-context-20261022`
Implementation base: `7164fc21c6c9e5988c0c4ac368f843cc5cd0c1df`
Reading prompt version: **1.3.0**
Evaluator version: **2.5.0**

**Code implementation and deterministic qualification are complete. Subscription-authenticated generated-reading qualification remains blocked and pending. Human editorial review of all 145 meaning-only canon projections remains pending.** Committing and pushing the implementation branch preserves these open requirements; it does not mark the implementation as fully qualified for release.

The [implementation plan](../superpowers/plans/2026-10-22-knowledge-graph-context-remediation.md) records the task requirements, completed work and remaining acceptance checks.

## Passing local evidence

The reviewed implementation passed the following checks before branch publication. Subscription gates and human editorial approval are separate from these results.

| Check | Recorded result |
| --- | --- |
| Root Node suite (`npm test`) | 4,714 passed, two skipped, zero failures |
| Worker knowledge graph suite | 47 passed, zero failures |
| Deterministic qualification corpus | 73 synthetic fixtures and 219 provider prompt builds |
| Authored archetypal patterns | All 30 partial pairs and ten complete arcs |
| Deck projection coverage | 145 canon passages across three decks: 435 projections |
| Budget/fallback boundaries | Eleven explicit boundaries |
| Repository and changed-file ESLint | Zero errors and warnings |
| Build, maintained documentation links and diff check | Passed |
| Independent whole-change code review | Approved; substantive code findings closed |

A separate real Workers AI lane validated nineteen finite embedding vectors of 1,024 dimensions from `@cf/baai/bge-m3`. Sixteen paired cases used semantic scoring; two accurately reported no eligible patterns or passages. This lane does not establish generated-reading usefulness, production latency or production cache behavior.

## Pending subscription qualification

- [ ] Pass `npm run ci:narrative-check` through the existing Claude subscription.
- [ ] Complete the frozen eighteen-pair quality comparison: eighteen baseline and eighteen candidate outputs, 36 outputs total.
- [ ] Review candidate readings against the actual inputs and the existing ethics, card-coverage and depth gates.

The narrative gate was attempted once with the existing personal Claude subscription, model `claude-opus-5-5`, effort `xhigh`. It stopped on its first sample because of the subscription usage limit. It has **not passed**. No paid API fallback was used.

The frozen baseline comparison attempted eighteen cases once and produced five readings and thirteen CLI failures. All failures remain recorded, with zero retries. Independent content review passed three available baseline outputs and failed two: one lost the named decision options, and one disclosed an irrelevant coastal-walk memory. Those two failures were not waived or omitted. All five available baseline outputs passed the saved structural/card-coverage checks, which did not detect those content failures.

Candidate narrative generation is **unrun**. Eighteen final candidate prompt previews and their source-usage metadata were captured without model inference. They are prompt-assembly evidence, not generated reading outputs. The 36-output paired quality comparison remains incomplete.

At the last read-only live usage check, **2026-10-22 at 17:24 UTC**, the subscription reported weekly use of 100%, with a reset at **2026-10-24T03:59:59.562918Z**. This records the observed blocker; it does not assume that future access is available. A later qualification run must retain the original failed records, record its own identity and attempts, and never overwrite or silently exclude failed cases.

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

No merge, deployment, migration or production-behavior qualification is established by this branch publication.
