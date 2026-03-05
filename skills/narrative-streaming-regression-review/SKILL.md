---
name: narrative-streaming-regression-review
description: Use when reviewing narrative streaming, scene handoff, and source-usage telemetry changes to catch regressions in reveal pacing, completion signaling, and metadata consistency.
---

# Narrative Streaming Regression Review

Use this skill for streaming narrative behavior, mobile suppression paths, and narrative backend metadata changes.

## Use This Skill When

- PRs touch `StreamingNarrative`, `ReadingDisplay`, or `functions/lib/narrativeBackends.js`.
- Review notes mention typing effect behavior, timeouts, mobile performance, or source-usage telemetry.

## Workflow

1. Read local architecture in `references/repo-context.md`.
2. Apply checklist in `references/operating-procedure.md`.
3. Run validation matrix in `references/validation.md`.
4. Output findings using the template below.

## Output Template

- `P1|P2|P3` - `file:line` - regression class
- User-visible symptom
- Root-cause logic path
- Minimum safe fix
- Validation commands

If nothing breaks, state "no findings" and mention remaining risk areas.

## References

- `references/repo-context.md`
- `references/review-patterns.md`
- `references/operating-procedure.md`
- `references/validation.md`
- `references/examples.md`