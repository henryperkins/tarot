---
name: animated-ui-a11y-perf-review
description: Use when reviewing animated UI changes for performance, reduced-motion support, loading strategy, ARIA status semantics, and browser compatibility in this repository.
---

# Animated UI A11y Performance Review

Use this skill for cinematic UI, text reveal, color-script, and spread rendering changes.

## Use This Skill When

- PRs touch `StreamingNarrative`, `AtmosphericInterlude`, `SpreadTable`, `colorScript`, or animation CSS.
- Review comments mention reduced motion, JS animation overhead, eager image loading, or ARIA issues.

## Workflow

1. Read `references/repo-context.md` for hotspots.
2. Apply the checklist in `references/operating-procedure.md`.
3. Run command set in `references/validation.md`.
4. Produce findings using the output format below.

## Output Template

- `P1|P2|P3` - `file:line` - concise title
- User impact (perf, accessibility, browser behavior)
- Minimal repo-consistent fix
- Verification commands

If no findings exist, say so and call out residual test gaps.

## References

- `references/repo-context.md`
- `references/review-patterns.md`
- `references/operating-procedure.md`
- `references/validation.md`
- `references/examples.md`