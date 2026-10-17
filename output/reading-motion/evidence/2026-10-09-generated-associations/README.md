# Fresh reading and semantic annotation experiment

Evaluated 2026-10-09T12:32:55.756Z. Completed 15/15 independent generation cases, including 2 Spanish readings. Actual models: claude-opus-5-5. Requested effort: xhigh.

Documents: [unaltered generated fixture](../../fixtures/generated-gesture-readings.json). Machine-readable evaluation: [summary.json](summary.json).

Each subscription-only request generated its reading and annotations together in a fresh, tool-free Claude session. Inputs supplied synthetic questions, optional reflections, spread positions/orientations, and supported artwork IDs/terms. They did not supply recorded reading prose, regex patterns, authored EXAMPLES, or prior critique. The raw model results and prompts are preserved in the per-case JSON files. No reading or annotation was repaired after generation.

Structural validation accepted 247/247 supplied annotations. Accepted kinds: identity 49, literal 90, interpretation 82, balance 9, relationship 17. Exact supplied personal-context references: 31.

The conservative fallback matched 60/92 model-annotated literal references at overlapping source quotes with the same card and detail. This denominator is model-provided, not independent human ground truth; it is a mechanism comparison, not a measured semantic-accuracy score. Interpretive returns in these documents come from the model's explicit associations, not memorized regex phrases.

| Case | Language | Accepted / supplied | Errors | Fallback literal overlap |
| --- | --- | --- | --- | --- |
| [new-home-rhythm](new-home-rhythm.json) | en | 12 / 12 | 0 | 3 / 4 |
| [creative-boundaries](creative-boundaries.json) | en | 15 / 15 | 0 | 3 / 5 |
| [fair-leadership](fair-leadership.json) | en | 15 / 15 | 0 | 6 / 6 |
| [first-small-step](first-small-step.json) | en | 18 / 18 | 0 | 4 / 6 |
| [community-project](community-project.json) | en | 21 / 21 | 0 | 6 / 8 |
| [gentle-departure](gentle-departure.json) | en | 16 / 16 | 0 | 6 / 6 |
| [uncertain-choice](uncertain-choice.json) | en | 16 / 16 | 0 | 6 / 6 |
| [friendship-repair](friendship-repair.json) | en | 13 / 13 | 0 | 3 / 6 |
| [rest-and-courage](rest-and-courage.json) | en | 16 / 16 | 0 | 1 / 6 |
| [changing-routine](changing-routine.json) | en | 25 / 25 | 0 | 7 / 10 |
| [shared-resources](shared-resources.json) | en | 17 / 17 | 0 | 4 / 6 |
| [speaking-clearly](speaking-clearly.json) | en | 15 / 15 | 0 | 5 / 6 |
| [slow-recognition](slow-recognition.json) | en | 16 / 16 | 0 | 6 / 6 |
| [ritmo-compartido](ritmo-compartido.json) | es | 16 / 16 | 0 | 0 / 5 |
| [voz-creativa](voz-creativa.json) | es | 16 / 16 | 0 | 0 / 6 |

The compiler checks exact quotes, card occurrence ownership, supported artwork IDs, nonoverlap, prior literal references, and supplied-context quotations. It does not judge whether a reading is helpful, whether a painted detail is described accurately, or whether an interpretive connection is forced. Human review, browser behavior, and production provider integration remain separate evidence. This experiment does not cover all 78 cards or prove a streaming provider contract.

The first two attempts failed before inference because the Claude CLI rejected JSON Schema draft 2020-12. The generator now serializes the same Zod contract as draft 7. Those failures are retained under priorAttempts; no API fallback was used.

Regenerate new missing cases: `node scripts/evaluation/generateGestureReadings.mjs` (subscription required). Retry recorded generation failures explicitly with `--retry-failed`. Revalidate existing unchanged documents without inference: `node scripts/evaluation/generateGestureReadings.mjs --evaluate-only`.
