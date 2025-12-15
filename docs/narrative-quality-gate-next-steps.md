# Narrative Quality Gate & Prompt/Spine Alignment — Next Steps

This document captures the **remaining hardening work** to make the runtime quality gate, narrative spine validation, and prompt contract more robust for GPT‑5 (Azure Responses), Claude, and the local composer.

It is intentionally practical: it lists **concrete implementation steps**, expected outcomes, and where in the codebase each concern lives.

---

## 1) Background: what we have today

### 1.1 Runtime flow (where issues are detected)
At runtime, `/api/tarot-reading`:
1. Runs spread analysis + context inference + optional GraphRAG/ephemeris enrichment.
2. Tries narrative backends in order (Azure GPT‑5 → Claude → local composer).
3. After each backend returns, it runs an **immediate structural quality gate** (coverage/hallucinations/spine) and rejects the backend output if it fails.
4. Optionally runs an **evaluation gate** (Workers AI eval) that can block a reading even after it passes the structural gate.

**Key code entrypoints**
- Runtime endpoint: `functions/api/tarot-reading.js`
- Spine validation: `functions/lib/narrativeSpine.js`
- Prompt builder: `functions/lib/narrative/prompts.js`
- Eval system + gate: `functions/lib/evaluation.js`

### 1.2 Recent fixes already in place (baseline improvements)
These fixes are considered “done” and should be treated as the baseline for future work:

1) **Spine header detection tightened**
- `CARD_HEADER_PATTERN` was too permissive and could treat generic colon-ended sentences as headers.
- It now has a ≤40 character limit and supports optional bold markers.

2) **Runtime quality gate now aligns with the prompt’s “loose spine” intent**
- The prompt explicitly allows non-card structural sections (Opening / Closing / Next Steps) to be different.
- The runtime gate now uses a completion ratio threshold rather than requiring all sections to be spine-complete.

3) **Prompt capture correctness**
- Prompts/usage are now associated with the request only after a backend passes the structural quality gate.
- This prevents storing the prompt from a backend attempt that was ultimately rejected and replaced (eg GPT‑5 rejected → local composer accepted).

---

## 2) Prompt ↔ Spine Contract (define it explicitly)

### 2.1 Why we need a formal contract
Right now the prompt says “loosely follow a story spine” and “use Markdown headings”, while the validator infers section boundaries and spine presence via heuristics.

A written contract makes the system robust by:
- Making prompt expectations explicit and testable.
- Making validator expectations explicit and stable.
- Preventing regressions when prompt wording changes.

### 2.2 Proposed contract (v1)
This is the minimum contract that should hold across all narrative providers.

#### A) Output format / sectioning
**Required**
- Output must be Markdown.
- Output must include at least **2** major section headers (Markdown headings or bold “header” lines).
- Prefer Markdown headings `###`.

**Allowed section boundary formats**
- Markdown headers: `##`, `###`, `####`, `#####`, `######`
- Bold-at-start-of-line headers (single line): `**Opening**`

**Recommended canonical headers (not strictly required in v1)**
- `### Opening`
- `### The Story` (or `### The Cards Speak`)
- `### Guidance`
- `### Gentle Next Steps`
- `### Closing`

**Validator mapping**
- Section detection is implemented by `validateReadingNarrative()` splitting on headings/bold header lines.

#### B) Card grounding / coverage
**Required**
- Each drawn card must be referenced by name at least once.
- High-weight positions (spread-dependent) must be explicitly referenced.
- The reading must not introduce cards that are not in the spread.

**Validator mapping**
- Coverage: `analyzeCardCoverage()` checks whether each provided card’s `card.card` string appears in text.
- Hallucinations: `detectHallucinatedCards()` scans for known card names and asserts they are in the drawn set (with “Fool’s Journey”/terminology exclusions and ambiguous-name context rules).

#### C) Story spine semantics
**Required (v1)**
- At least one “card interpretation section” should contain detectable WHAT and at least one of WHY / WHAT’S NEXT.
- The reading should not be purely list-like without narrative structure.

**Non-required / allowed**
- “Opening” and “Closing” sections do not need explicit WHAT/WHY/WHAT’S NEXT markers.
- “Gentle Next Steps” may be bullet-focused.

**Validator mapping**
- Spine is computed per section via `analyzeSpineCompleteness()`.
- Current runtime gate uses a completion ratio across detected sections; this is explicitly “v1” and is expected to evolve (see Section 4).

#### D) Safety + agency language
**Required**
- No deterministic/fatalistic guarantees (no “you will definitely”, “guaranteed”, etc).
- Maintain agency language (choices/trajectories).
- No prohibited advice (medical, legal, financial directives).

**Validator mapping**
- Runtime structural gate does not deeply score tone; the evaluation gate covers safety/tone on a rubric and can block responses.
- Offline narrative gate checks deterministic/harsh language via scripts in `scripts/evaluation/`.

### 2.3 Prompt changes to better enforce the contract (recommended)
These are prompt-only changes (no code changes) that often reduce validator brittleness:
- Require at least 4 major headers (Opening / Cards / Guidance / Closing).
- Require that each card’s first mention appears in a sentence that includes either the position label or a “Card N:” prefix.
- Encourage explicit card headings for multi-card spreads:
  - `#### Card 1 — <Card Name>`
  - `#### Card 2 — <Card Name>`
  This dramatically reduces false “missing card” due to synonyms or paraphrases.

---

## 3) Data collection: sample GPT‑5 outputs (accepted + rejected)

### 3.1 Goal
Gather a small set of real GPT‑5 responses to answer:
- Which quality-gate check is failing most often?
- Are failures prompt-related, validator-related, or genuine model behavior issues?
- Are failures spread-specific (Celtic vs Relationship, etc.)?

### 3.2 What to collect
Collect 5–10 samples total:
- 3–5 that were **accepted** from GPT‑5.
- 3–5 that were **rejected** from GPT‑5 and fell back to another backend.

For each sample, capture:
- `requestId`
- `provider` (accepted provider)
- `backendErrors` (if any)
- `narrativeMetrics` (spine + coverage + hallucinations)
- `promptMeta` (GraphRAG, slimming, truncation)
- (Optional, dev only) redacted prompt + reading excerpt

### 3.3 How to classify each sample
Use the same logic as runtime:
- Hallucination count vs allowed threshold
- Coverage vs min threshold
- Missing high-weight positions
- Spine completion ratio
- “No narrative sections detected”

Summarize into a table with columns:
- spreadKey
- backendAttempt
- failedCheck(s)
- notes (eg “model output had no headings”; “coverage failed due to synonym”; etc.)

---

## 4) Spine gate hardening (replace ratio with section-aware logic)

### 4.1 Why the ratio approach is brittle
Section discovery depends on how many headings the model emits. A model that uses many small headings increases the denominator and makes the ratio harder to satisfy, even if card sections are good.

### 4.2 Proposed next gate design (v2): classify sections by header
Add a section classifier:
- “Opening-like”: header matches `opening`, `context`, `overview`
- “Card-like”: header matches `card`, `the story`, `the cards`, `nucleus`, `timeline`, `staff`, etc.
- “Action-like”: `next steps`, `practices`, `gentle next steps`
- “Closing-like”: `closing`, `recap`, `wrap-up`

Then enforce:
- Require **≥1 card-like section** to be spine-complete.
- Require **0 total sections** is still a hard fail.
- Opening/Closing are exempt from spine completeness checks.
- Next-steps sections are exempt from WHY but must include WHAT’S NEXT style language (optional).

### 4.3 Use spine hints when we have metadata
`analyzeSpineCompleteness()` supports `spineHints`. In local composer code paths, we can provide explicit hints for known section types (eg “opening should not require why/next”).

For LLM outputs, we generally don’t have metadata; classification-by-header is the correct approach.

---

## 5) Card coverage hardening (reduce false “missing card” failures)

### 5.1 Problem
Current coverage checks are string-based: if the exact `card.card` name doesn’t appear, it’s considered missing.

This fails when:
- The model uses deck-specific synonyms (“Justice” vs “Adjustment” for Thoth).
- The model uses shorthand (“Ace of Cups” vs “Ace of Cups (upright)” etc).
- The model includes formatting/punctuation variations.

### 5.2 Proposed fix: canonicalize for coverage checks
For coverage (not hallucination), use a canonical normalization:
- Convert drawn cards to canonical deck-aware key (where possible).
- Expand acceptable match patterns per card:
  - canonical name
  - deck alias (Thoth / Marseille)
  - optional leading “The” for majors
  - case-insensitive, punctuation-tolerant boundaries

Important: hallucination detection should remain strict (don’t loosen hallucination rules until you are confident the false positives are real).

---

## 6) Telemetry and diagnosability improvements

### 6.1 Goal
When GPT‑5 fails the quality gate, we should be able to answer “why” without reproducing locally.

### 6.2 Add explicit per-backend attempt telemetry (dev-safe)
For each backend attempt:
- Store `backend.id`
- Store `qualityIssues` list (the exact strings produced by the gate)
- Store a short redacted reading excerpt (first ~500–1,000 chars)
- Store `promptMeta` + GraphRAG alerts + token usage (if available)
- Store the final decision: accepted/rejected

**Privacy rule**
- Never store raw prompts/readings in production unless redacted and explicitly enabled by env flags.

### 6.3 Alerting/monitoring ideas
Add log-based alerts on:
- `Backend azure-gpt5 failed quality gate`
- `no narrative sections detected`
- repeated hallucination failures
- GraphRAG omissions/truncation (already supported by GraphRAG alerts)

---

## 7) Regression tests with captured GPT‑5 fixtures

### 7.1 What we want to lock in
Add fixture-based tests that ensure:
- A real GPT‑5 output that we consider “good” passes spine/coverage/hallucination checks.
- A real GPT‑5 output that we consider “bad” fails for the expected reason.
- Colon-ended sentences do not trigger false “card headers”.
- The section parser recognizes the expected heading patterns.

### 7.2 Fixture hygiene
- Redact user content (names, dates, phone numbers).
- Keep only the minimal excerpt necessary to reproduce the validator behavior.
- Store fixtures in a `tests/fixtures/` folder with clear naming:
  - `gpt5-accepted-threecard-1.txt`
  - `gpt5-rejected-no-headings-1.txt`

---

## 8) Documentation integration plan

### 8.1 Where this doc should be referenced
Add a short “See also” link in:
- `docs/narrative-builder-and-evaluation.md`
- `docs/evaluation-system.md`

### 8.2 What documentation should explicitly state
- There are *two* gates:
  - Runtime structural gate (fast, deterministic)
  - Optional eval gate (semantic rubric, safety/tone)
- What constitutes a “valid” narrative output format (Prompt ↔ Spine Contract)
- How to debug GPT‑5 rejections, including where telemetry is stored and what to look for

---

## 9) Suggested execution order (recommended)
1. Write Prompt ↔ Spine contract into the prompt text (stronger structure requirements).
2. Implement section-aware spine gate (v2).
3. Canonicalize coverage checks (without weakening hallucination rules).
4. Add per-backend attempt telemetry.
5. Add regression fixtures.
6. Update the main narrative/evaluation docs to link here.

---

## Appendix: Quick glossary
- **Structural quality gate**: deterministic checks (sections/spine/coverage/hallucinations) executed immediately after each backend returns, before accepting.
- **Eval gate**: optional semantic scoring (tone/safety/coherence) that can block even structurally-valid readings.
- **Spine completeness**: heuristics that detect WHAT / WHY / WHAT’S NEXT within each section.
