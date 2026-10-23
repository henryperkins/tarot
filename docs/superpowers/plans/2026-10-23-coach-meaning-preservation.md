# Coach Meaning Preservation Implementation Plan

> **For agentic workers:** Use focused test-first tasks and independent final review. Leave changes uncommitted and undeployed.

**Goal:** Keep AI refinement faithful to the current concern and exact stated timing, preserving the original whenever a suggested rewrite violates conservative constraints.

**Architecture:** Separate existing-question refinement from fresh generation in the existing Worker route. Add pure timing and content acceptance helpers, retaining provider-attempt accounting and owner/session protections. Validate actual Workers AI output through the candidate route without changing production.

**Tech Stack:** ESM, Cloudflare Worker/Workers AI, React context copy, Node tests.

**Spec:** `docs/superpowers/specs/2026-10-23-coach-meaning-preservation-design.md`

## Global constraints

- Preserve unrelated files, staging, branches and worktrees; use hash-verified isolated work.
- Exact current wording is the fallback. No grades or automated claim of semantic understanding.
- No commit, push, deployment, paid narrative API fallback or extra live experiments.
- Live sample: six fixed synthetic cases, one provider request per case, no automatic retry.

## Review focus

- Captured sister/silence output and shifted calendar boundaries must be rejected.
- Dropped negation or substantive anchors must not pass a superficial vocabulary check.
- Preserve literal timing through sanitization and output normalization.
- Rejection must retain billed inference provenance while releasing the daily feature reservation.
- Unsupported language/paraphrases should preserve input without fabricated confidence.

## Tasks

- [x] Write failing literal timing tests; implement `shared/coach/questionTiming.js`; verify focused GREEN.
- [x] Write failing captured-response route and content-preservation regressions; retain RED evidence.
- [x] Add a dedicated refinement prompt and conservative content acceptance helper. Preserve fresh-generation behavior.
- [x] Integrate rejection/forecast suppression and truthful status/accounting; verify focused GREEN.
- [x] Run focused route/helper/client regressions, changed-file lint, source checks, build and full unit suite once on final source.
- [x] Independently review source/accounting and resolve substantive findings before live sampling.
- [x] Run six fixed live synthetic cases against the candidate route/model; review raw and delivered wording separately.
- [x] Copy only task-owned files to primary after exact hashes; verify unrelated preservation and record results/limits.
