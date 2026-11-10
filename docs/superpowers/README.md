# Workstreams

Type: index
Status: active reference
Last reviewed: 2026-10-23

Dated specs, implementation plans, and reviews for active and recently closed work. This is the canonical lifecycle for new workstreams. `docs/plans/` is a legacy archive and `docs/reviews/` holds point-in-time audits.

## Index

| Workstream | Spec | Plan | Review |
| --- | --- | --- | --- |
| Reading UI and aligner | [Imagery and motion](specs/2026-10-08-reading-imagery-motion.md) | [Intent closure](plans/2026-10-11-reading-intent-closure.md), [aligner release](plans/2026-10-11-reading-aligner-release.md), [post-reading model](plans/2026-10-11-reading-post-reading-model.md) | [Local acceptance](reviews/2026-10-11-reading-ui-acceptance.md), [aligner execution](reviews/2026-10-11-reading-aligner-release.md) |
| Header navigation | [Shared app navigation](specs/2026-10-21-shared-app-navigation-design.md) | [Final remediation](plans/2026-10-21-header-navigation-final-remediation.md), [Gate 2](plans/2026-10-21-header-navigation-gate2.md) | [Gate 1](reviews/2026-10-21-header-navigation-gate1-review.md), [Gate 2](reviews/2026-10-21-header-navigation-gate2-review.md), [Production acceptance](reviews/2026-10-21-header-navigation-production-acceptance.md) |
| Coach refinement | [Design](specs/2026-10-23-coach-refinement-design.md) | [Plan](plans/2026-10-23-coach-refinement.md) | [Review](reviews/2026-10-23-coach-refinement.md) |
| MCP journal | [Design](specs/2026-09-22-chatgpt-mcp-journal-design.md) | [Plan and runbook](plans/2026-09-23-chatgpt-mcp-journal.md) | - |
| Mobile card inspector | - | [Plan](plans/2026-10-18-mobile-card-inspector.md) | [Acceptance](reviews/2026-10-20-mobile-card-inspector-acceptance.md) |
| Journey P1 | - | [Plan](plans/2026-10-18-journey-p1.md) | - |
| Enrichment review fixes | - | [Plan](plans/2026-10-21-enrichment-review-fixes.md) | - |
| Account final remediation | - | [Plan](plans/2026-10-21-account-final-remediation.md) | - |
| Reading quality schedule | - | [Plan](plans/2026-10-17-reading-quality-schedule.md) | - |

## Status Convention

- New specs, plans, and reviews start with a metadata block immediately after the `H1`:
  `Type: spec|plan|review`, `Status: ...`, `Last reviewed: YYYY-MM-DD`.
- Use `Status: active` for work that is still being executed. Use `Status: historical reference` or `Status: closed` when the work is complete or superseded. Do not delete completed records.
- Older files that use `**Status:**` or `> Status:` remain valid; do not rewrite their history just to change the format.
- Use `YYYY-MM-DD-topic-design.md` for specs. Prefer `-plan` and `-review` suffixes for new paired work; older plans and reviews may share a stem because their folder distinguishes them.
- Put new evidence under [docs/evidence](../evidence/README.md), not beside the plan.
