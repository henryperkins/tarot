# Reviews And Audits

Type: index
Status: active reference
Last reviewed: 2026-10-23

Point-in-time audits, reviews, and reconciliation records. These preserve the state and evidence of a review; they are not current plans. Active workstreams live in [superpowers](../superpowers/README.md).

| Document | Scope |
| --- | --- |
| [Codex narrative qualification](../evidence/codex-narrative-qualification-2026-10-23/README.md) | Fresh 11-case qualification for deployed commit 98106dd8 and the Codex runner startup repair. |
| [Frontend UI review](2026-frontend-ui-review.md) | Historical frontend architecture, UX, accessibility, and performance review. |
| [Design contract audit](design-contract-responsive-a11y-audit.md) | Responsive and accessibility snapshot against the design contract. |
| [Test coverage analysis](2026-test-coverage-analysis.md) | Historical coverage audit. |
| [Card reveal remediation plan](2026-card-reveal-remediation-plan.md) | Remediation plan retained with its review evidence. |
| [Astro reversal evaluation](2026-09-23-astro-reversal-evaluation.md) | Reversal flag evaluation and evidence. |
| [AI reliability release](2026-10-07-ai-reliability-release.md) and [verification](2026-10-07-ai-reliability-verification.md) | October reliability release record. |
| [Primary reconciliation](primary-reconciliation-20261017.md) | Branch reconciliation record for the October 17 primary checkout. |

## Status Convention

Use `Type: review` and `Status: historical snapshot` for a completed audit or review. A review never becomes an active plan; if follow-up work is needed, create or update a plan in [superpowers](../superpowers/README.md) and link back to the review.

Evidence folders:

- [Card inspection - 2026-10-17](card-inspection-20261017/README.md)
- [Tailwind 4 verification - 2026-10-17](tailwind4-20261017/README.md)
- [Astro reversal evidence](evidence/astro-reversal-2026-09-23/) and [production repair evidence](evidence/production-repairs-20261017/) are historical evidence bundles. New evidence belongs under [docs/evidence](../evidence/README.md); this root will be consolidated there.
