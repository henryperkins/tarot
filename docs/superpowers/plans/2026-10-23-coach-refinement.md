# Coach Refinement Implementation Plan

> **For agentic workers:** Use focused implementation tasks with test-first verification and a fresh final review. Work is uncommitted unless the user requests Git publication.

**Goal:** Preserve the reader's concern through an explicit review flow with gentle framing feedback and recoverable edits.

**Architecture:** Extend the existing coach context with a fourth review step, original/prior wording and explicit regeneration. Keep generation and framing utilities separate from UI; add safe template-save undo in storage. Maintain the current theme and modal primitives.

**Tech Stack:** React, Vite, Cloudflare Worker, Node tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-coach-refinement-design.md`

## Global Constraints

- Exact current wording takes precedence over defaults and recommendations.
- No automatic rewriting of manually edited/selected wording; original and prior version recoverable.
- No grades or compulsory timeframe; uncertain/unsupported language receives no assessment.
- Only review applies text; preserve existing ownership and cancellation protections.
- No live model calls, commit, push, deployment, or unrelated-file edits.

## Review Focus

- Owner changes and restored drafts must not mix original/current wording between accounts.
- Settings changes during AI requests must cancel stale output without losing the editor.
- Conservative English detection must abstain on Spanish, mixed/uncertain text and proper-name-only input.
- Template undo must refuse concurrent changes and surface storage failures.
- Footer release at enlarged text must preserve a readable editor, focus and reachable actions.

## Tasks

### 1. Framing and response boundary (delegated)

Files: new `src/lib/questionFraming.js`, `tests/questionFraming.test.mjs`; `src/lib/intentionCoach.js`, matching utility tests.

Interface: `getQuestionFramingSuggestions(text): string[]` returns at most two suggestions, never grades, and abstains on unsupported/uncertain language. `buildCreativeQuestion` accepts optional `questionText` as explicit refinement input and retains subject/timeframe in its prompt. Invalid non-string API questions use local fallback.

- [x] Add meaningful failing tests for guarantee/guaranteed, Spanish, uncertainty, optional timeframe, valid output, malformed response shape and refinement input.
- [x] Observe RED, implement, verify GREEN.

### 2. Truthful template replacement and safe undo (delegated)

Files: `src/lib/coachStorage.js`, `tests/coachStorage.test.mjs`.

Interface: successful `saveCoachTemplate` additionally returns `replacedTemplate` and `undoToken: {before, after}` when replacing an entry. `undoCoachTemplateSave(token, userId)` returns normal success/templates or a safe error; it restores `before` only if current storage equals `after`.

- [x] Add failing tests for ninth save, same-name replacement, exact undo, concurrent-change refusal and persistence failure.
- [x] Observe RED, implement, verify GREEN.

### 3. Session, explicit review and edit protection (parent)

Files: `src/TarotReading.jsx`, coach context/view/panels, `coachConstants.js`, `coachDraft.js`, focused tests and coach E2E suites.

- [x] Add browser acceptance tests first; observe failures against existing behavior.
- [x] Pass current question into the coach; add step 3 review, original/prior recovery and Start fresh.
- [x] Make setting/detail changes non-destructive for selected/manual wording; explicit generation uses current wording, and radio arrows select.
- [x] Put editor/guidance first on review, advanced controls afterward, focus heading/question on entry, and release oversized footer into flow.
- [x] Wire truthful replacement status and Undo in the library; remove duplicate recent-question helper.
- [x] Update existing tests for the intentional four-step/wording changes; run focused suites.

### 4. Integrated verification and review

- [x] Run full `npm test`, build, changed-file lint, a11y checks, and Impeccable detector.
- [x] Run coach/refinement/question/modal E2E coverage on Chromium and mobile WebKit; retain failure evidence.
- [x] Obtain fresh independent code review of concurrency/recovery; resolve substantive findings.
- [x] Copy only task-owned files into primary checkout after hash checks; verify unrelated baseline hashes remain unchanged.
- [x] Verify guest and real active-Pro browser states, both themes and compact enlarged text; logout and stop owned services.
- [x] Record exact results and limits. Leave implementation uncommitted and undeployed.

Completed locally. Exact evidence and qualifications: `docs/superpowers/reviews/2026-10-23-coach-refinement.md`. No Git publication or deployment.
