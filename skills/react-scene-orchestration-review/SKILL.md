---
name: react-scene-orchestration-review
description: Use when reviewing React phase and state flow for scene orchestration bugs, especially effect dependencies, render-loop risks, Set vs array assumptions, and transition regressions in this repository.
---

# React Scene Orchestration Review

Use this skill for pull requests that touch scene lifecycle, derived state, or transition callbacks.

## Use This Skill When

- A change touches `src/hooks/useSceneOrchestrator.js` or scene wiring in `ReadingDisplay` and `SceneShell`.
- Review feedback mentions render loops, stale transitions, effect dependencies, or scene phase mismatches.
- A bug report says scene progression is stuck in one stage (`drawing`, `interlude`, `delivery`).

## Workflow

1. Load file scope first.
2. Follow the checklist in `references/operating-procedure.md`.
3. Validate with commands in `references/validation.md`.
4. Report findings in severity order using the output template below.

## Output Template

- `P1|P2|P3` - `file:line` - short title
- Why it is risky in this repo's scene flow
- Minimum safe fix
- Validation commands to rerun

If no issues are found, state that explicitly and list residual risks.

## References

- `references/repo-context.md`
- `references/review-patterns.md`
- `references/operating-procedure.md`
- `references/validation.md`
- `references/examples.md`