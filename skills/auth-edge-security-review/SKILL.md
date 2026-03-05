---
name: auth-edge-security-review
description: Use when reviewing auth callbacks and edge API routes for state validation, randomness quality, rate limiting, token and cookie handling, and security-signal triage in this repository.
---

# Auth Edge Security Review

Use this skill for OAuth callback, session endpoints, and edge route hardening reviews.

## Use This Skill When

- PRs touch `functions/api/auth/*`, server auth integration, or auth/session user routes.
- Code scanning or bot reviews raise rate limit, randomness, injection, or callback-state issues.

## Workflow

1. Load context from `references/repo-context.md`.
2. Execute checklist in `references/operating-procedure.md`.
3. Run security-focused test commands in `references/validation.md`.
4. Report verified findings only; separate likely false positives from exploitable issues.

## Output Template

- `P1|P2|P3` - `file:line` - vulnerability class
- Threat scenario in this repo
- Verification status (`confirmed`, `needs proof`, `false positive likely`)
- Minimal fix and tests

## References

- `references/repo-context.md`
- `references/review-patterns.md`
- `references/operating-procedure.md`
- `references/validation.md`
- `references/examples.md`