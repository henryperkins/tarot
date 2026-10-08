# Reading context fixes plan

> Status: proposed 2026-10-08; not yet approved for execution. Built from an evaluation of four journal readings (Oct 6–7, 2026) against the prompt pipeline. Run Phase 0 first: its answers can void or resize later tasks. Work on a branch in a worktree and land each task with its tests.

**Goal:** Readings follow their own prompt contract. Card notes match each card's orientation and position, decision readings don't invent the querent's options, memories personalize without turning into a formula, dates and card imagery are correct, and the checks notice a reading that misses its length band.

**Architecture:** Changes stay inside the existing prompt builders (`functions/lib/narrative/**`), card data (`functions/lib/imageryHooks.js`), personalization (`functions/lib/userMemory.js`, `functions/lib/userPersonalization.js`), the timing heuristic, the structural gate in `functions/api/tarot-reading.js`, the evaluator hint and the journal export (`src/lib/journalInsights.js`). New surface is limited to one optional request field (`decisionPaths`) and, if approved, one read of recent journal entries per reading.

**Tech stack:** Cloudflare Workers + D1, React/Vite, Node `node:test`.

**Evidence:** Prompts rebuilt with the repo's own builders for the four draws (Appendix B), the gate's metrics run on each narrative, astronomy-engine checks of the sky claims and a 5,000-draw simulation of the timing heuristic. Those working files lived in a session scratchpad and are not committed.

| # | When (local) | Spread | Problems traced to context |
|---|---|---|---|
| 1 | Oct 7, 8:48 PM | Decision, 5/5 reversed | Reversed Ace of Swords handed an upright "clarity" note; Path A's content invented |
| 2 | Oct 7, 8:12 AM | Five-card, wellbeing | A personal detail restated from memory; name never used |
| 3 | Oct 6, 10:28 PM | Decision | "Choose" notes stacked on the Path B card, then a strong tilt; three memory callbacks |
| 4 | Oct 6, 9:49 PM | Decision | "Reins" from the Chariot hook; reversed Two of Swords read as release; "Friday" new moon (Saturday, Oct 10); ~420 words |

## Global constraints

- Node 24. Every task runs `npm test` and `npm run lint`. Record unit, narrative-gate, deploy and live results separately.
- Prompt text changes need `npm run ci:narrative-check` on the owner's Claude subscription before merge. Don't lower thresholds; a local-composer pass doesn't prove a live provider.
- The first task that changes prompt text bumps `READING_PROMPT_VERSION` (`functions/lib/promptVersioning.js:17`, `1.2.0` → `1.3.0`) with a `VERSION_HISTORY` entry, so `eval_metrics` can compare before and after.
- New D1 columns use additive migrations, applied before the code that reads them.
- No production reads or writes without the owner's explicit OK. Fixtures use the four card draws with synthetic questions; don't commit the owner's questions, memories or readings.

## Review focus

- A reversed card never receives an upright-only note, in any context.
- Unnamed decision paths get no concrete content; named paths are sanitized like the question.
- Memory selection never drops a note the current question actually needs.
- Gate changes don't trigger provider fallbacks until the owner enables the floor.

## Phase 0: Settle the open questions (read-only, needs the owner's OK)

### Task 0: Pull the stored facts for the four readings

**Owner:** the owner, or Claude through the Cloudflare D1 connector once approved. **Size:** S.

- [ ] Run against `mystic-tarot-db` (for example `npx wrangler d1 execute mystic-tarot-db --remote --config wrangler.jsonc --command "…"`), replacing `<USER_ID>`:

```sql
-- Settings, model and inputs used, per entry (Oct 6–8 UTC)
SELECT datetime(created_at, 'unixepoch') AS created_utc, spread_key, provider, request_id,
       location_timezone,
       json_extract(user_preferences_json, '$.preferredSpreadDepth') AS depth,
       json_extract(user_preferences_json, '$.tarotExperience') AS experience,
       json_extract(source_usage_json, '$.userContext.usedInputs') AS used_inputs
FROM journal_entries
WHERE user_id = '<USER_ID>' AND created_at BETWEEN 1791244800 AND 1791504000
ORDER BY created_at;

-- Evaluator results for the same requests; reading_time is when each reading was generated
SELECT request_id, provider, eval_mode, overall_score, reading_prompt_version,
       unixepoch(created_at) AS reading_time,
       json_extract(payload, '$.eval.scores') AS scores
FROM eval_metrics
WHERE request_id IN ('<id1>', '<id2>', '<id3>', '<id4>');

-- Memories injected into one reading: run once per reading with its reading_time.
-- journal_entries.created_at is the save time, which can follow a chat that added notes.
SELECT category, text, keywords, datetime(created_at, 'unixepoch') AS created_utc
FROM user_memories
WHERE user_id = '<USER_ID>' AND scope = 'global'
  AND created_at < <READING_TIME>
  AND (expires_at IS NULL OR expires_at > <READING_TIME>)
ORDER BY created_at DESC LIMIT 8;
```

- [ ] Record the answers here and apply them:
  - **#4 depth.** If `short`, #4 was on target (decision quick band 400–550): drop the length finding and keep only "three next steps instead of one". If `standard` or null, #4 missed its band and becomes Task 12's real failing case.
  - **Provider.** If #3 and #4 weren't Claude, judge Phase 2 on the current provider only. The data findings (Tasks 2, 3 and 7) stand regardless.
  - **Name.** If `used_inputs` lacks `displayName` for #2 and #3, the "name never used" finding is void; Task 4 still fixes the conflicting close.
  - **Memories.** Confirm which stored notes produced the personal detail restated in #2 and #3 and the pattern-tracking callbacks, and whether any note mentions a workload (if so, drop that #4 finding). Use each reading's own result from the per-reading query, and keep the phrasing out of the repo when tuning Task 9's personal-detail filter. Memories deleted since won't appear, so the query can confirm a source but can't prove a note was absent.
- [ ] Ask the owner two things: did the 10:28 PM re-ask follow a thin first reading, and what would Path A and Path B have been? These feed Tasks 14 and 15.

## Phase 1: Data and wording fixes (small; can land together)

### Task 1: Regression test from the four draws (write first)

**Files:** new `tests/readingPromptInvariants.test.mjs`. **Size:** S.

- [ ] Build each draw from Appendix B with synthetic questions. Include "this week" in the questions for draws 3 and 4 so the forecast path runs:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAJOR_ARCANA } from '../src/data/majorArcana.js';
import { MINOR_ARCANA } from '../src/data/minorArcana.js';
import { SPREADS } from '../src/data/spreads.js';
import { performSpreadAnalysis } from '../functions/lib/spreadAnalysisOrchestrator.js';
import { buildEnhancedClaudePrompt } from '../functions/lib/narrative/prompts.js';

const CARDS = new Map([...MAJOR_ARCANA, ...MINOR_ARCANA].map((card) => [card.name, card]));

async function buildDraw({ spreadKey, referenceTime, question, context, cards }) {
  const spreadInfo = SPREADS[spreadKey];
  // Appendix B marks reversed cards with R; unmarked cards are upright.
  const cardsInfo = cards.map(([name, mark], index) => {
    const base = CARDS.get(name);
    const orientation = mark === 'R' ? 'Reversed' : 'Upright';
    return {
      position: spreadInfo.positions[index],
      card: base.name,
      orientation,
      meaning: orientation === 'Reversed' ? base.reversed : base.upright,
      number: base.number,
      suit: base.suit || null,
      rank: base.rank || null,
      rankValue: base.rankValue ?? null
    };
  });
  const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
    userQuestion: question,
    referenceTime,
    subscriptionTier: 'pro',
    location: { timezone: 'America/Chicago' }
  });
  return buildEnhancedClaudePrompt({
    spreadInfo,
    cardsInfo,
    userQuestion: question,
    reflectionsText: '',
    themes: analysis.themes,
    spreadAnalysis: analysis.spreadAnalysis,
    context,
    deckStyle: 'rws-1909',
    ephemerisContext: analysis.ephemerisContext,
    ephemerisForecast: analysis.ephemerisForecast,
    transitResonances: analysis.transitResonances,
    budgetTarget: 'claude',
    personalization: { displayName: 'Alex' },
    memories: [{ category: 'communication', text: 'Enjoys spotting patterns across a spread.', keywords: ['patterns'] }],
    readingTime: referenceTime, // added by Task 3
    timezone: 'America/Chicago' // added by Task 3
  });
}
```

- [ ] Add one `it()` per invariant. Each starts as `{ todo: 'Task N' }` and becomes a real test when its task lands:
  1. No user prompt contains `reins` (Task 2).
  2. Each user prompt has exactly one `Close with` instruction (Task 4).
  3. A `**Reading Date**:` line appears in every user prompt (Task 3).
  4. #4's reversed Two of Swords block contains neither "removing the blindfold" nor "softens confusion", and #3's Lovers block contains no "choose what" (Task 7).
  5. Decision prompts carry the unnamed-paths rule (Task 8).
  6. The returning-querent block says "at most one remembered note" (Task 9).
  7. No prompt contains `Timing: Expect this to emerge` (Task 10).
- [ ] **Done when:** no todos remain and the file passes.

### Task 2: Correct the card imagery data

**Files:** `functions/lib/imageryHooks.js` (lines 405, 408–413, 433, 502), new `tests/imageryHooksCanon.test.mjs`. **Size:** S.

- [ ] The Chariot. The deck's own image (`public/images/cards/RWS1909_-_07_Chariot.jpeg`) shows no reins, and the sphinxes are seated:

```js
  7: { // The Chariot
    visual: "Armored figure in chariot, two sphinxes (black and white) resting before it, city behind, starry canopy above",
    upright: "Notice the Chariot's opposing sphinxes—mastery comes through directing contrary forces as one.",
    reversed: "The sphinxes face different ways; regain direction by clarifying where you're heading.",
    sensory: "Stillness before motion, will steering contrary forces, armored resolve"
  },
```

- [ ] Remove fate and "must" wording the prompt bans:
  - Lovers sensory: `"Magnetic pull, vulnerability exposed, the tremor of a values-led choice"`
  - Wheel sensory: `"Momentum shifting, the vertigo of change, cycles turning"`
  - Judgement reversed: `"The call sounds, but you hesitate; the inner critic delays an answer you already sense."`
- [ ] Test. Today it fails on exactly these four cards:

```js
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getImageryHook } from '../functions/lib/imageryHooks.js';

const FIXED_FATE = /\byou (?:must|should)\b|\bdestin(?:y|ed)\b|\bfate\b/i;

describe('major arcana imagery hooks', () => {
  it('keep agency language in every field', () => {
    for (let number = 0; number <= 21; number += 1) {
      for (const orientation of ['Upright', 'Reversed']) {
        for (const text of Object.values(getImageryHook(number, orientation))) {
          assert.doesNotMatch(text, FIXED_FATE, `card ${number} ${orientation}: ${text}`);
        }
      }
    }
  });

  it('show the Chariot without reins or harnessed sphinxes', () => {
    for (const orientation of ['Upright', 'Reversed']) {
      const text = Object.values(getImageryHook(7, orientation)).join(' ');
      assert.doesNotMatch(text, /\breins?\b|\bpull(?:s|ing)?\b/i);
    }
  });
});
```

- [ ] Optional: compare the other 21 Major hooks against their images for details the cards don't show.

### Task 3: Give the model the date

**Files:** `functions/lib/narrative/prompts/userPrompt.js` (after line 88); `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` (new `readingTime` and `timezone` params passed to `buildUserPrompt`); `functions/lib/narrativeBackends.js:709` (pass `payload.readingTime` and `payload.timezone`); `functions/api/tarot-reading.js` (narrativePayload near line 1166: `readingTime: new Date(startTime).toISOString()`, `timezone: sanitizedLocation?.timezone || null`); `functions/lib/ephemerisIntegration.js:177–186, 578–587`; `tests/ephemerisForecastEvents.test.mjs` (lines 112–151, 187). **Size:** S–M.

- [ ] Add a reading-date line in `userPrompt.js`:

```js
function formatReadingDate(readingTime, timezone) {
  const date = readingTime ? new Date(readingTime) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  const format = (timeZone) => new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
  if (timezone) {
    try {
      return format(timezone);
    } catch {
      // The request's timezone isn't validated; an unknown zone falls back to UTC.
    }
  }
  return `${format('UTC')} (UTC; the querent's local date may differ)`;
}

// After the Question line:
const readingDate = formatReadingDate(promptOptions.readingTime, promptOptions.timezone);
if (readingDate) prompt += `**Reading Date**: ${readingDate}\n\n`;
```

- [ ] Without a timezone, the forecast keeps "in about N days" and adds the UTC date, e.g. `(in about 4 days; Sat, Oct 10 UTC)`. Set a `utcDateLabel` in `describeForecastEvent` when `timezone` is missing and append it in `describeEventTiming`. Update the forecast tests that expect no label.
- [ ] **Done when:** #4's rebuilt prompt says "Tuesday, October 6, 2026" and "New Moon in Libra (in 4 days; Sat, Oct 10)", an unknown timezone such as `Not/AZone` falls back to the UTC date with its caveat, and the forecast tests pass.

### Task 4: One closing instruction, and the same banned phrases as the evaluator

**Files:** `functions/lib/narrative/prompts/userPrompt.js:98` and `:280–281`. **Size:** S.

- [ ] Line 98: replace the Name Usage "Close with …" bullet with `- Use the name once or twice in total. You may open the closing choices sentence with it (for example, "Remember, ${displayName}, the choices you make…").`
- [ ] Line 281: `Never write “you should”, “you must” or “you need to”`. The evaluator already caps tone for "you need to" (`functions/lib/evaluation.js:910`).
- [ ] **Done when:** invariant 2 passes.

### Task 5: Honest provenance for reference passages

**Files:** `functions/lib/narrative/prompts/graphRAGReferenceBlock.js:160`; check the fixtures in `tests/promptEngineering.test.mjs:833–957`. **Size:** S.

- [ ] Replace "These passages provide archetypal context from respected tarot literature." with "These passages are Tableu's own tarot canon, written as background on these archetypes." Then add "Paraphrase; don't reuse their sentences."
- [ ] **Done when:** the GraphRAG tests pass.

### Task 6: Journal export fixes

**Files:** `src/lib/journalInsights.js:1097–1100` and `:1188`. Move the copy at `src/components/journal/entry-card/EntryCard.primitives.js:20–22` into a new `src/lib/timingProfileCopy.js` and import it in both places. Tests go in `tests/journalInsights.test.mjs`. **Size:** S.

- [ ] Frontmatter uses the local date, matching the header:

```js
function formatFrontmatterDate(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
```

- [ ] Key Themes prints `TIMING_PROFILE_COPY[themes.timingProfile]` instead of the raw slug.
- [ ] Test with `process.env.TZ = 'America/Chicago'`: an entry at `2026-10-08T01:48Z` exports `date: 2026-10-07` and contains no `developing-arc`.

## Phase 2: Prompt behaviour (narrative gate required)

### Task 7: Card notes that respect orientation and position

**Files:** `functions/lib/narrative/helpers.js` (`CARD_SPECIFIC_CONTEXT` at 172–222, `buildContextualClause` at 369–394, position intros at 822 and 850), new `tests/contextClauseOrientation.test.mjs`. **Size:** M.

- [ ] Resolve notes by orientation:

```js
function resolveCardSpecificClause(entry, cardInfo = {}) {
  if (!entry) return '';
  const reversed = String(cardInfo.orientation || '').toLowerCase() === 'reversed';
  // Plain-string entries describe the upright card, so a reversed card falls back to the generic lens.
  if (typeof entry === 'string') return reversed ? '' : entry;
  return (reversed ? entry.reversed : entry.upright) || '';
}
```

  In `buildContextualClause`, replace the `specificMap[cardName]` early return with:

```js
  const specific = resolveCardSpecificClause(CARD_SPECIFIC_CONTEXT[normalized]?.[cardName], cardInfo);
  if (specific) return specific;
```

- [ ] Rewrite the ten `decision` entries as `{ upright, reversed }` descriptions with no instructions (proposed copy in Appendix A). Entries for the other contexts stay plain strings and become upright-only.
- [ ] Make the position intros neutral:
  - line 850: `` `Here, ${card} ${orientation} offers a lens for weighing how each option fits.` ``
  - line 822: `` `As one possibility, Path A under ${card} ${orientation} outlines how this route may unfold.` ``
- [ ] Tests:
  - A reversed Two of Swords in the clarifier gets the reversed note.
  - A reversed Hermit in `love` context gets the generic Major lens, not the upright note.
- [ ] **Done when:** invariant 4 passes, and the narrative check shows no lens contradiction on Task 13's reversed-clarifier sample.

### Task 8: Decision readings don't invent the options

**Files:** `functions/lib/narrative/prompts/systemPrompt.js:100–115`, `functions/lib/narrative/prompts/cardBuilders.js:504–514`, `functions/lib/evaluation.js` (hint at 1027, user template, version at 26), and the evaluator version mentioned in `CLAUDE.md` and `docs/evaluation-system.md`. Optional labels also touch `shared/contracts/readingSchema.js:119`, `functions/lib/narrative/prompts/userContext.js:14`, `functions/api/tarot-reading.js` (narrative payload and `evalParams` in `finalizeReading`), `functions/lib/narrativeBackends.js` (line 709 and `generateReadingFromAnalysis`) and the local fallback builder `functions/lib/narrative/spreads/decision.js` (`buildDecisionReading`). **Size:** S for the rule, M for labels.

- [ ] Add a decision flow to the system prompt:

```js
  } else if (spreadKey === 'decision') {
    lines.push(
      '',
      'DECISION FLOW: Heart → Path A → Path B → Clarifier → Free will. Read each path through its card as the texture of that route, and give both paths comparable depth. If the cards favor one path, say so conditionally and name what would change it. For any path the querent has not named, do not assign concrete content (roles, employers, places, people); describe its energy and invite the querent to map it onto their real options.'
    );
  }
```

- [ ] Add a paths line to the decision block in `cardBuilders.js`, handling each path on its own because both labels are optional:
  - Sanitize each label in `prepareUserContext` like the question (max 80 characters).
  - A label that survives sanitizing renders with `renderUserContext('pathA', …)` or `renderUserContext('pathB', …)`.
  - A missing or emptied label renders as "not named". Never call `renderUserContext` with `undefined`: `JSON.stringify(undefined)` returns `undefined`, so its `.replace` throws.
  - With neither label: `**Paths**: The querent has not named Path A or Path B.`
- [ ] Extend the request schema: `decisionPaths: z.object({ a: optionalCleanString(80), b: optionalCleanString(80) }).optional()`.
- [ ] Give the evaluator the same facts. Pass the sanitized labels, or at least which paths were named, through `evalParams` into the evaluator's user template. Append to the decision hint: "If the querent did not name a path, treat concrete content assigned to it as a coherence flaw." Bump `EVAL_PROMPT_VERSION` to `2.5.0`.
- [ ] Carry the labels through the local fallback: `generateReadingFromAnalysis` passes them to `buildDecisionReading`, which uses them in place of the generic Path A and Path B wording.
- [ ] **Done when:**
  - invariant 5 passes;
  - injection strings in labels are filtered;
  - a request naming only Path A renders A's label and marks B "not named";
  - the evaluator receives the labels;
  - the local fallback keeps labeled paths;
  - the narrative check's decision samples assign no concrete content to unnamed paths.

### Task 9: Memories that personalize without becoming a formula

**Files:** `functions/lib/userMemory.js` (new `selectMemoriesForReading`; access stamping at 376), `functions/lib/userPersonalization.js:27, 236–245` (load up to 30 candidates for readings), `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` (select before rendering), `functions/lib/narrative/prompts/userPrompt.js:37–47`, `tests/userMemory.test.mjs`. **Size:** M.

- [ ] Select by relevance, not recency:

```js
// Tune this to the real phrasing found in Task 0.
const PERSONAL_DETAIL_PATTERN = /\b(?:\d{2}\s*(?:years?\s*old|y\/?o)|age[ds]?\s*\d{2}|turn(?:ed|ing|s)?\s+\d{2}|birthday)\b/i;
const tokensOf = (text = '') => new Set(String(text).toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []);

export function selectMemoriesForReading(memories, { userQuestion = '', reflectionsText = '', limit = 3 } = {}) {
  if (!Array.isArray(memories) || memories.length === 0) return [];
  const currentText = `${userQuestion} ${reflectionsText}`;
  const currentTokens = tokensOf(currentText);
  const allowPersonalDetails = PERSONAL_DETAIL_PATTERN.test(currentText);
  return memories
    .filter((memory) => allowPersonalDetails || !PERSONAL_DETAIL_PATTERN.test(memory?.text || ''))
    .map((memory, index) => {
      const terms = new Set([...(memory.keywords || []).map((keyword) => keyword.toLowerCase()), ...tokensOf(memory.text)]);
      const overlap = [...terms].filter((term) => currentTokens.has(term)).length;
      return { memory, index, score: overlap * 2 + (memory.category === 'communication' ? 1 : 0) };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ memory }) => memory);
}
```

- [ ] Add usage rules to `buildReturningQuerentContext`:

```js
    '- Mention at most one remembered note, and only when it changes how a card applies to the current question.',
    '- Apply Communication Style notes silently; do not narrate them (avoid "since you like…").',
    '- Do not restate personal details such as age unless the querent raised them in this reading.',
```

- [ ] If `last_accessed_at` drives pruning, stamp it only on the selected memories.
- [ ] **Done when:**
  - unit tests cover ranking, the cap and the personal-detail filter;
  - a narrative sample seeded with Task 1's synthetic note ("Enjoys spotting patterns across a spread.") shows at most one callback and no "since you like".

### Task 10: A timing line that carries information

**Files:** `functions/lib/pacingHeuristics.js:101–144`, `functions/lib/narrative/prompts/userPrompt.js:162–172`, a new test. **Size:** S.

- [ ] Strip the trailing `(Card N)` suffix before matching named positions; the Celtic labels in `src/data/spreads.js` never match today. Then count every card, weighting named future positions ×2, and keep the 0.55 share threshold.
- [ ] Render the prompt line only for `near-term-tilt` and `longer-arc-tilt`. The journal keeps its existing copy.
- [ ] **Done when:** a five-card draw can return a tilt (a 5,000-draw run returned `developing-arc` for 100% of five-card draws and 73% of decision draws) and invariant 7 passes.

### Task 11: Plain-language lens, no talk about the notes

**Files:** `functions/lib/narrative/helpers.js:1093–1095` (the `formatReversalLens` reminder), `functions/lib/narrative/prompts/systemPrompt.js:39–53`. **Size:** S.

- [ ] Reversal block: `- Describe this lens in plain language; don't name it (avoid phrases like 'the Blocked Energy lens').`
- [ ] CORE PRINCIPLES: `- Don't refer to your notes as text (avoid 'folded into this card' or 'the meaning says').`

## Phase 3: Checks

### Task 12: Length telemetry, then an optional floor

**Files:** `functions/api/tarot-reading.js:305–387` (`evaluateQualityGate`; pass `personalization`), `functions/lib/narrative/styleHelpers.js:214` (`resolveNarrativePreferenceContract`), the telemetry schema. **Size:** M.

- [ ] Add `wordCount`, `lengthBand` and `lengthRatio` to `qualityMetrics`, using the depth-aware band (the quick decision band is 400–550).
- [ ] Resolve the band from the same inputs the prompt used: `personalization` plus the accepted attempt's `variantPromptOverrides`, whose `lengthModifier` changes the target. Passing the already-resolved band into `evaluateQualityGate` is simplest, so generation and validation can't disagree.
- [ ] Behind `QUALITY_GATE_LENGTH_FLOOR` (default off), add a quality issue when `wordCount < 0.75 × band.min`. A quality issue hands the reading to the next provider, so enable it only after a week of telemetry shows how often it fires.
- [ ] **Done when:** telemetry is recorded, and #4's text gives about 0.60 against the standard band and 1.05 against the quick band.

### Task 13: Narrative-gate coverage for these failure modes

**Files:** `scripts/evaluation/runNarrativeSamples.js` (`SAMPLE_DEFINITIONS` and `generateSampleImpl`). **Size:** S.

- [ ] Add two samples, each with a synthetic question:
  - a decision spread with unnamed paths and a reversed Two of Swords clarifier (draw #4);
  - a five-card wellbeing spread (draw #2), seeded with Task 1's synthetic memory note.
- [ ] Forward `sample.memories` into the `narrativePayload` built in `generateSampleImpl`. It forwards `personalization` but not memories today, so without this every run takes the no-memory path and can't test Task 9.
- [ ] Run `npm run ci:narrative-check` before Phase 2 as a baseline, and again after. Record the SHA, backend and flagged samples.
- [ ] On the two new samples (3 runs each), compare path balance, lens consistency, memory callbacks and "chapter" endings. This also tests the evaluation's causal claims.

## Phase 4: Practiced-reader features (owner decisions first)

### Task 14: Continuity across recent readings

**Files:** new `functions/lib/recentDraws.js`, `functions/api/tarot-reading.js`, `functions/lib/narrative/prompts/userPrompt.js` (after the memory block), tests. **Size:** M–L.

- [ ] Read up to 5 of the user's journal entries from the last 7 days (`created_at`, `spread_key`, `question`, `cards_json`).
- [ ] Treat those rows as untrusted. `saveAppJournalEntry` (`functions/lib/journalEntries.js`) stores `question` and `cards_json` from the client without the reading request's sanitizer or a length cap, so a crafted saved question could otherwise inject instructions into later readings.
  - Compare stored questions on the server only; the block below doesn't include their text.
  - If stored text ever reaches the prompt, sanitize it through the same pipeline as the current question (`prepareUserContext` limits plus injection filtering) and render it inside a `<user_context source="recent-question">` boundary.
  - Check stored card names and positions against the canonical deck and the spread definition before rendering them.
- [ ] Detect the same question within 24 hours (normalized text), and cards that recur, especially in the same position.
- [ ] Add a prompt block:

```text
**Recent Draws** (continuity only):
- Judgement appeared yesterday in "What to remember about your free will" (Upright); today it sits there Reversed.
- This question was also asked 39 minutes ago.
Mention at most one of these, only if it deepens this reading. Acknowledge a repeat question gently and never treat a new draw as correcting the earlier one.
```

- [ ] Decide the default: on, opt-in or off.

### Task 15: Let the querent name both paths

**Files:** `src/components/QuestionInput.jsx` (or `ReadingPreparation.jsx`), `src/contexts/ReadingContext.jsx` (request payload), `shared/coach/spreadQuestions.js:105` (hint), additive migration `migrations/0036_add_decision_paths.sql` (`decision_paths_json TEXT`), `src/hooks/useSaveReading.js` (journal save request), `functions/lib/journalEntries.js` (insert), `functions/api/journal.js` (rows decoded for the app), `src/lib/journalInsights.js` (export "Path A: … / Path B: …"). **Size:** M.

- [ ] Show two optional inputs (up to 80 characters each) only for the decision spread, and send them as `decisionPaths` (Task 8).
- [ ] Carry the labels through the journal: send them from `useSaveReading.js`, store them in `journalEntries.js`, and decode them in `functions/api/journal.js`, so the export still has them after a reload.
- [ ] Point the coach hint at the new fields. If a decision question names no options and the fields are empty, show a non-blocking nudge.

### Task 16: Notice repeated numbers

**Files:** `functions/lib/knowledgeGraph.js` (detector), `src/data/knowledgeGraphData.js` (rank themes), `functions/lib/knowledgeBase.js` (passages, per CLAUDE.md). **Size:** M.

- [ ] Flag two or more Minor cards of the same rank (#4 drew two Twos in a decision spread) with a short highlight such as "Two Twos: pairs, balance and choice are in the foreground."

## Decisions for the owner

1. OK to run Task 0's read-only queries, or will you run them?
2. Path labels: new inputs (Task 15), or the prompt rule only (Task 8)?
3. Memory budget: three notes, with style notes applied silently?
4. Recent-draw continuity: on by default, opt-in or off?
5. Length floor: telemetry only, or enforce after a week?
6. Drop the default timing line from prompts?

## Suggested order

1. Task 0.
2. Task 1.
3. Phase 1 (Tasks 2–6) as one PR, with the prompt version bump.
4. Baseline narrative check (Task 13).
5. Phase 2 (Tasks 7–11) as one PR.
6. Narrative check again.
7. Task 12 telemetry.
8. Phase 4 once the decisions above are made.

## Appendix A: Proposed decision-context notes

| Card | Upright | Reversed |
|---|---|---|
| two of swords | For this decision, this points to a stalemate held by not looking; what is already known may sit behind the blindfold. | For this decision, avoidance may be holding the stalemate in place; notice what feels easier not to look at yet. |
| seven of cups | For this decision, many options may blur together; what is real and actionable matters more than what dazzles. | For this decision, the haze of options may be clearing, or one fantasy may be quietly steering the choice. |
| justice | For this decision, this centers fair weighing and owning the consequences of the choice. | For this decision, the weighing may be tilted by a bias or an avoided consequence. |
| the hanged man | For this decision, a pause and a new angle may reveal what rushing would miss. | For this decision, the pause itself may be stuck; waiting can start to stand in for choosing. |
| the chariot | For this decision, this shows drive ready to commit once the direction is clear. | For this decision, drive may be split between competing aims; direction comes before commitment. |
| wheel of fortune | For this decision, timing and outside conditions are part of the picture. | For this decision, timing may feel out of step; part of the answer may be what can wait. |
| six of wands | For this decision, this shows confidence and readiness to stand behind the choice openly. | For this decision, a need for outside approval may be weighing on the choice. |
| four of cups | For this decision, disengagement may be hiding an option already on offer. | For this decision, interest may be returning; an overlooked option could come back into view. |
| ace of swords | For this decision, this brings clarity: one plain truth can cut through the noise. | For this decision, clarity may be clouded by overthinking or mixed information; one plain statement of what matters can help. |
| the lovers | For this decision, values alignment is central: which option fits who you are. | For this decision, values and desire may be pulling apart; notice where an option asks you to trade one for the other. |

## Appendix B: The four draws (fixtures; use synthetic questions)

Reference times assume US Central; Task 0 confirms the stored timezone.

| # | Spread | Context | Reference time (UTC) | Cards in position order (R = reversed) |
|---|---|---|---|---|
| 1 | decision | decision | 2026-10-08T01:48:00Z | Ace of Swords R, The Hierophant R, The Moon R, Knight of Wands R, Judgement R |
| 2 | fiveCard | wellbeing | 2026-10-07T13:12:00Z | Seven of Wands R, The Fool R, Eight of Cups R, Five of Swords, Four of Wands |
| 3 | decision | decision | 2026-10-07T03:28:00Z | Nine of Wands, Knight of Cups R, The Lovers, Eight of Cups R, Six of Pentacles R |
| 4 | decision | decision | 2026-10-07T02:49:00Z | Two of Pentacles R, Queen of Wands, The Chariot R, Two of Swords R, Judgement |
