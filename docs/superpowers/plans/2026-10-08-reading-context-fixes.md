# Reading context fixes plan

> Status: proposed 2026-10-08; not yet approved for execution. Built from an evaluation of four journal readings (Oct 6–7, 2026) against the prompt pipeline. Run Phase 0 first: its answers can void or resize later tasks. Work on a branch in a worktree and land each task with its tests.

**Goal:** Readings follow their own prompt contract. Card notes match each card's orientation and position, decision readings don't invent the querent's options, memories personalize without turning into a formula, dates and card imagery are correct, and the checks notice a reading that misses its length band.

**Architecture:** Changes stay inside the existing prompt builders (`functions/lib/narrative/**`), card data (`functions/lib/imageryHooks.js`), personalization (`functions/lib/userMemory.js`, `functions/lib/userPersonalization.js`), the timing heuristic, the structural gate in `functions/api/tarot-reading.js`, the evaluator hint and the journal export (`src/lib/journalInsights.js`). New request fields are optional `decisionPaths` and an independent `timezone`; older callers remain supported. If approved, continuity adds one bounded read of recent journal entries per reading.

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
- Each PR that changes prompt text bumps `READING_PROMPT_VERSION` (`functions/lib/promptVersioning.js:17`) once, with a `VERSION_HISTORY` entry: Phase 1 takes `1.2.0` → `1.3.0`, Phase 2 `1.4.0`, and so on. `eval_metrics` can then tell each change set apart.
- New D1 columns use additive migrations, applied before the code that reads them.
- No production reads or writes without the owner's explicit OK. Fixtures use the four card draws with synthetic questions; don't commit the owner's questions, memories or readings.

## Review focus

- A reversed card never receives an upright-only note, in any context.
- Unnamed decision paths get no concrete content; named paths are sanitized like the question.
- Personal details match the same subject in the current reading. Eligible detail notes rank ahead of general and style notes; the configured note cap still applies.
- Gate changes don't trigger provider fallbacks until the owner enables the floor.

## Post-merge review coverage

PR #103 merged this plan before its last seven review threads were addressed. The revisions below specify the fixes and regression cases; their task checkboxes remain open until implementation and validation.

| Finding | Plan disposition |
|---|---|
| [Timezone without coordinates](https://github.com/henryperkins/tarot/pull/103#discussion_r4217280664) | Task 3 adds independent browser/schema/API timezone handling. The old timezone-only location is rejected, not silently accepted. |
| [Reading date lost at the hard cap](https://github.com/henryperkins/tarot/pull/103#discussion_r4217335301) | Task 3 protects the date in both truncation branches and tests the real decision marker. |
| [Personal details about the wrong subject](https://github.com/henryperkins/tarot/pull/103#discussion_r4217335292) | Task 9 compares detail/subject pairs in both directions and rejects ambiguous ownership. |
| [Detail notes crowded out by general notes](https://github.com/henryperkins/tarot/pull/103#discussion_r4217332033) | Task 9 ranks eligible detail notes first and makes the cap's limit explicit. |
| [Labels missing from contextual sources](https://github.com/henryperkins/tarot/pull/103#discussion_r4217335305) | Tasks 8/9 carry labels through source precedence, retrieval, fallback and memory selection. |
| [Labels missing from provenance](https://github.com/henryperkins/tarot/pull/103#discussion_r4217335317) | Task 8 extends signals, bounded storage and UI summaries, checked after final truncation. |
| [Duplicate Marseille rank context](https://github.com/henryperkins/tarot/pull/103#discussion_r4217335328) | Task 16 suppresses overlapping generic highlights/keys and deduplicates before passage caps. |

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
       json_extract(source_usage_json, '$.userContext.providedInputs') AS provided_inputs,
       json_extract(source_usage_json, '$.userContext.usedInputs') AS used_inputs
FROM journal_entries
WHERE user_id = '<USER_ID>' AND created_at BETWEEN 1791244800 AND 1791504000
ORDER BY created_at;

-- Evaluator results for the same requests. metrics_written is when this row was
-- written, just after generation finished.
SELECT request_id, provider, eval_mode, overall_score, reading_prompt_version,
       unixepoch(created_at) AS metrics_written,
       json_extract(payload, '$.eval.scores') AS scores
FROM eval_metrics
WHERE request_id IN ('<id1>', '<id2>', '<id3>', '<id4>');

-- When each reading started generating. Rows exist only for readings after
-- migration 0035; for older readings use metrics_written as reading_time.
SELECT request_id, MIN(started_at) / 1000 AS reading_time
FROM inference_attempts
WHERE request_id IN ('<id1>', '<id2>', '<id3>', '<id4>')
GROUP BY request_id;

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
  - **#4 depth.** `source_usage_json` is recorded when the reading runs but says only whether a depth was sent, not which one. `user_preferences_json` is snapshotted when the entry is saved, so it shows the depth used only if the preference didn't change in between.
    - If `depth` isn't in `provided_inputs`, the default standard band applied: #4 missed it and becomes Task 12's real failing case.
    - If a depth was sent, use the saved `short` or `standard` once the owner confirms the setting didn't change before saving. `short` means #4 was on target (decision quick band 400–550): drop the length finding and keep only "three next steps instead of one". `standard` means it missed its band, as above.
    - If the saved depth is null or the owner can't confirm it, leave the length finding open.
  - **Provider.** If #3 and #4 weren't Claude, judge Phase 2 on the current provider only. The data findings (Tasks 2, 3 and 7) stand regardless.
  - **Name.** If `used_inputs` lacks `displayName` for #2 and #3, the "name never used" finding is void; Task 4 still fixes the conflicting close.
  - **Memories.** Confirm which stored notes produced the personal detail restated in #2 and #3 and the pattern-tracking callbacks, and whether any note mentions a workload (if so, drop that #4 finding). Use each reading's own result from the per-reading query, and keep the phrasing out of the repo when tuning Task 9's personal-detail filter. Memories deleted since won't appear, so the query can confirm a source but can't prove a note was absent. When `metrics_written` stands in for the start time, a note saved in the few seconds between generation and that write also can't be ruled out.
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
      number: base.number ?? null,
      suit: base.suit || null,
      rank: base.rank || null,
      rankValue: base.rankValue ?? null
    };
  });
  const analysis = await performSpreadAnalysis(spreadInfo, cardsInfo, {
    userQuestion: question,
    referenceTime,
    subscriptionTier: 'pro',
    timezone: 'America/Chicago' // independent of coordinates; added by Task 3
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

**Files:** new `shared/readingTime.js`; `shared/contracts/readingSchema.js`; `src/contexts/ReadingContext.jsx` (request payload); `functions/api/tarot-reading.js` (request normalization, analysis options and `narrativePayload`); `functions/lib/spreadAnalysisOrchestrator.js` (forecast timezone); `functions/lib/narrativeBackends.js` (forwarding); `functions/lib/narrative/prompts/userPrompt.js`, `buildEnhancedClaudePrompt.js` and `truncation.js`; `functions/lib/ephemerisIntegration.js`; new `tests/readingDateContext.test.mjs`, existing `tests/readingSchema.test.mjs`, `tests/readingJob.test.mjs`, `tests/promptContextRetention.test.mjs` and `tests/ephemerisForecastEvents.test.mjs`. **Size:** M.

**Interfaces:** `normalizeReadingTimezone(value) -> string | null` in `shared/readingTime.js`; optional request `timezone: optionalCleanString(64)`; `performSpreadAnalysis` consumes `options.referenceTime` and new `options.timezone`; the narrative payload and both prompt builders consume `readingTime` (ISO timestamp) and `timezone` (validated zone or null).

- [ ] Write timezone propagation tests first. The current schema requires both coordinates in `location`, so a timezone-only location is rejected before sanitization; it is not an accepted request whose timezone silently disappears. Keep that coordinate contract and add the independent top-level field.
- [ ] Implement `normalizeReadingTimezone`: accept only a nonempty string of at most 64 characters, trim it, and validate/canonicalize it with `new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone`. Return null for empty, non-string, overlong or unknown values; never use the Worker's ambient timezone.
- [ ] The browser sends its validated `Intl.DateTimeFormat().resolvedOptions().timeZone` as top-level `timezone` even when location is disabled or geolocation permission is denied. Failure to obtain it leaves the field absent. This requires no coordinate lookup or additional permission.
- [ ] Normalize the timezone before the coordinate guard in `tarot-reading.js`: the valid top-level value wins, otherwise use a valid `rawLocation?.timezone` for older callers, otherwise null. `sanitizedLocation` continues to require coordinates. Verify that both direct readings and the `startReadingJob` schema round trip retain the new field.
- [ ] Compute `readingTime = new Date(startTime).toISOString()` once. Pass it as `referenceTime` to spread analysis and as `readingTime` to the narrator; pass the same independent timezone to both. In `spreadAnalysisOrchestrator.js`, use `options.timezone` for forecast labels, falling back to validated `options.location?.timezone` for legacy direct callers. Coordinate-dependent calculations still require a valid location.
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
      // Defensive fallback for callers that bypass request normalization.
    }
  }
  return `${format('UTC')} (UTC; the querent's local date may differ)`;
}

// After the Question line:
const readingDate = formatReadingDate(promptOptions.readingTime, promptOptions.timezone);
if (readingDate) prompt += `**Reading Date**: ${readingDate}\n\n`;
```

- [ ] Whenever a valid `readingTime` was supplied, protect its exact trusted `**Reading Date**:` line during truncation. Extract it as a separate section before allocating context or cards, reserve its measured token cost, and restore it before derived card prose. Carry it through both the `<user_context>` reconstruction and the recursive `contextAllocated` branch; putting it only in `introRemainder` loses it after cards exhaust the budget. Account for it in the final hard-cap check too. If the date alone cannot fit, throw `RangeError('Reading date exceeds prompt budget.')` before invocation; the normal narrative-backend error path handles that attempt. Check that the final prompt still contains the exact protected date, and throw a `RangeError` before invocation if it is missing or if the final total exceeds the provider cap. Legacy direct builder calls without a valid `readingTime` keep their existing behavior. Do not call a provider with a dateless forecast or an over-cap prompt.
- [ ] Without a timezone, the forecast keeps "in about N days" and adds the UTC date, e.g. `(in about 4 days; Sat, Oct 10 UTC)`. Set a `utcDateLabel` in `describeForecastEvent` when the normalized timezone is missing and append it in `describeEventTiming`. Update the forecast tests that expect no label.
- [ ] **Done when:**
  - at `2026-10-07T02:49:00Z`, a request with only top-level `timezone: 'America/Chicago'` and no location says "Tuesday, October 6, 2026" and "New Moon in Libra (in 4 days; Sat, Oct 10)";
  - location-disabled and permission-denied browser requests still send the zone; the direct route and queued job preserve it;
  - valid top-level timezone overrides a conflicting location zone; older coordinate-bearing requests still use their valid location zone; missing or unknown zones fall back to UTC with its caveat;
  - a long forecast prompt using the real `**DECISION / TWO-PATH STRUCTURE**` marker retains the exact date under a 400-token hard cap, along with usable question context and the provider's total cap; repeat with and without `<user_context>` fields;
  - an impossibly small date budget rejects that provider attempt before any provider call, and all forecast tests pass.

### Task 4: One closing instruction, and the same banned phrases as the evaluator

**Files:** `functions/lib/narrative/prompts/userPrompt.js:98` and `:280–281`. **Size:** S.

- [ ] Line 98: replace the Name Usage "Close with …" bullet with `- Use the name once or twice in total. You may open the closing choices sentence with it (for example, "Remember, ${displayName}, the choices you make…").`
- [ ] Line 281: `Never write “you should”, “you must” or “you need to”`. The evaluator already caps tone for "you need to" (`functions/lib/evaluation.js:910`).
- [ ] **Done when:** invariant 2 passes.

### Task 5: Honest provenance for reference passages

**Files:** `functions/lib/narrative/prompts/graphRAGReferenceBlock.js:160`; check the fixtures in `tests/promptEngineering.test.mjs:833–957`. **Size:** S.

- [ ] Replace "These passages provide archetypal context from respected tarot literature." with "These passages are Tableu's own tarot canon, written as background on these archetypes." The same line already says not to quote them verbatim.
- [ ] **Done when:** the GraphRAG tests pass.

### Task 6: Journal export fixes

**Files:** `src/lib/journalInsights.js:1097–1100` and `:1188`. Move `TIMING_SUMMARIES` from `src/components/journal/entry-card/EntryCard.primitives.js:19–23` into a new `src/lib/timingProfileCopy.js` and import it in both places. Tests go in `tests/journalInsights.test.mjs`. **Size:** S.

- [ ] Frontmatter uses the local date, matching the header:

```js
function formatFrontmatterDate(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
```

- [ ] Key Themes replaces its `Timing:` line, which prints the raw slug, with the matching `TIMING_SUMMARIES` entry; each entry already starts with "Timing:".
- [ ] Note: `journalInsights.js` runs only in the browser (nothing under `functions/` imports it), so the local date getters use the querent's own timezone.
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

**Files:** `functions/lib/narrative/prompts/systemPrompt.js:100–115`, `functions/lib/narrative/prompts/cardBuilders.js:504–514`, `functions/lib/evaluation.js` (hint at 1027, user template, version at 26), and the evaluator version mentioned in `CLAUDE.md` and `docs/evaluation-system.md`. Optional labels also touch:

- `shared/contracts/readingSchema.js:119`;
- `functions/api/tarot-reading.js` (sanitizing at the request boundary, context sources, the crisis check at line 910, the eval-gate policy calls at 488 and 1143, the narrative payload, and `evalParams` in `finalizeReading`);
- `functions/lib/narrativeBackends.js` (line 709 and `generateReadingFromAnalysis`);
- `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` and `userPrompt.js` (forwarding);
- `functions/lib/contextDetection.js` (`buildContextInferenceInput` and `resolveContextSelection`) and `functions/lib/spreadAnalysisOrchestrator.js` (retrieval);
- `functions/lib/narrative/prompts/userContext.js` (`prepareUserContext`, `parseUserContext` and `summarizeUserContext`);
- `functions/lib/narrative/sourceUsage.js`, `shared/readingSourceUsage.js` and `src/components/reading/complete/sourceUsageSummary.js`;
- `functions/lib/narrative/prompts/truncation.js:465–490` (hard-cap rebuild);
- `functions/lib/promptEngineering.js:410` (`buildReadingRedactionOptions`, called at `tarot-reading.js:460` and `narrativeBackends.js:746`) and the `buildPromptEngineeringPayload` call at `tarot-reading.js:596`;
- the local fallback builder `functions/lib/narrative/spreads/decision.js` (`buildDecisionReading`);
- tests in `tests/contextDetection.test.mjs`, `tests/readingContextPrecedence.test.mjs`, `tests/localComposerContextPriority.test.mjs`, `tests/promptContextRetention.test.mjs`, `tests/sourceUsageSummary.test.mjs` and the request/evaluation suites.

**Size:** S for the rule, M for labels.

**Interfaces for labels:** `decisionPaths` uses `{ a?, b? }` at the request and builder boundaries; prompt context and usage fields use `pathA`/`pathB`. Extend `prepareUserContext(userQuestion, reflectionsText, cardsInfo, inputStats = {}, decisionPaths = {})` with the fifth argument, preserving the existing input-stat argument. Forward labels through both builders and their direct-call fallback preparation; each prepared path field uses the 80-character limit and its original/sanitized lengths. Keep identical A/B labels as separate sources because their path identities differ.

- [ ] Add a decision flow to the system prompt:

```js
  } else if (spreadKey === 'decision') {
    lines.push(
      '',
      'DECISION FLOW: Heart → Path A → Path B → Clarifier → Free will. Read each path through its card as the texture of that route, and give both paths comparable depth. If the cards favor one path, say so conditionally and name what would change it. If a path has no label, use the question\'s wording when it names that option. For an option named nowhere, do not assign concrete content (roles, employers, places, people); describe its energy and invite the querent to map it onto their real options.'
    );
  }
```

- [ ] Sanitize the labels once, at the request boundary in `tarot-reading.js`, with the same cleaning and injection filtering as the question (max 80 characters). The model prompt, the evaluator and the local fallback then all receive the same safe values; `optionalCleanString` alone only trims, drops empty strings and rejects values over the limit; it filters nothing.
- [ ] Treat sanitized labels as current context throughout the pipeline. Add `decisionPaths` to `contextSources`, `buildContextInferenceInput` and `resolveContextSelection`; forward that object to spread analysis, prompt-builder retrieval and the local composer's context selection. Source precedence is a specific question, then reflections, then labels, then saved focus. A generic question such as "Which path fits?" must not suppress career evidence in "Accept the promotion". Use labels to break a current-source topic tie only after reflections; they never redirect a clearly specific question.
- [ ] Build the GraphRAG query from the current question, relevant reflections and both labels, with a separately bounded share for labels so a long question/reflection cannot consume it. Include saved focus only when current sources contain no usable topic. Extend every current-topic check, including `generateReadingFromAnalysis`'s `hasCurrentTopic`, to recognize `decisionPaths`; otherwise the fallback can still reintroduce saved focus. Task 9 consumes these same labels for memory relevance and personal-detail matching.
- [ ] Screen the labels like the question. The crisis check (`detectCrisisSignals`, line 910) and both `buildSelectiveEvalGatePolicy` calls read only the question and reflections today. Without the labels, crisis language placed only in a path label would skip the support response and reach the narrator as a choice to weigh, and a sensitive topic named only there wouldn't force the eval gate.
- [ ] Forward `decisionPaths` through `buildEnhancedClaudePrompt` (a new parameter) and `buildUserPrompt` into `buildDecisionPromptCards`, which renders each path on its own because both labels are optional:

```js
// Labels are optional and already sanitized. Never pass undefined to renderUserContext:
// JSON.stringify(undefined) returns undefined, so its .replace throws.
const describePath = (source, label) => (label ? renderUserContext(source, label) : 'no separate label');
out += `**Paths**: Path A: ${describePath('pathA', decisionPaths?.a)}; Path B: ${describePath('pathB', decisionPaths?.b)}.\n`;
```

- [ ] Make `parseUserContext` recognize `pathA` and `pathB` (its source pattern becomes `question|reflections|card-\d+|pathA|pathB`), and have `truncateUserPromptSafely` restore them after hard-cap truncation. Today that step strips every line holding a `<user_context>` block and rebuilds every source other than the question and reflections as `Reflection for card N`; `pathA` would come back as card 1. Give the paths their own branch that re-renders the single `**Paths**:` line, using "no separate label" only for a genuinely missing one. A provided label wholly omitted for budget says "label omitted for budget"; partial labels retain their `<user_context>` representation and both path identities. Preserve Task 3's reading date when rebuilding the line.
- [ ] Record text-free label provenance end to end. Add `pathA` and `pathB` to `USER_CONTEXT_FIELD_CONFIG` in `functions/lib/narrative/sourceUsage.js`, `USER_INPUT_KEYS` and the `fields` allowlist in `shared/readingSourceUsage.js`, and the source-usage summary's input labels and "Your question & notes" group. Capture original nonempty input lengths in `userContextInputStats.pathA`/`.pathB` before instruction filtering, then sanitized and included lengths and the existing omission/truncation flags for each label; never store its text in telemetry. Record provided/eligible signals before rendering, then compute used signals and field counts from the final prompt after all budget reductions. A supplied label filtered to empty uses `sanitized_empty`; a supplied label omitted for budget uses `removed_for_budget`; an absent label is not provided. A partial representation is used only when it retains usable text. Carry these bounded flags/counts through the response, evaluation record and journal snapshot. The local composer reports a label as used only when its rendered decision section includes it.
- [ ] Extend the request schema: `decisionPaths: z.object({ a: optionalCleanString(80), b: optionalCleanString(80) }).optional()`.
- [ ] Give the evaluator the same facts. Pass the sanitized labels, or at least which paths were named, through `evalParams` into the evaluator's user template. Append to the decision hint: "If the querent did not name a path, treat concrete content assigned to it as a coherence flaw." Bump `EVAL_PROMPT_VERSION` to `2.5.0`.
- [ ] Carry the labels through the local fallback: `generateReadingFromAnalysis` passes them to `buildDecisionReading`, which uses them in place of the generic Path A and Path B wording.
- [ ] Add both labels to the redaction sources. Stored prompts already replace every `<user_context>` block, but a name that appears only in a label ("Take Alice's offer") and is echoed by the reading would otherwise be stored unredacted.
  - `buildReadingRedactionOptions` takes the labels as extra text sources, as it does memories. Its result supplies the evaluation payload's redaction names.
  - `finalizeReading` also passes that result (`readingRedactionOptions`) to `buildPromptEngineeringPayload` as `redactionOptions`. Today that call builds its options from the question, reflections and personalization alone, so with `PERSIST_PROMPTS` on, a name found only in a label or a memory survives redaction. Memory text is plain prompt text, not a `<user_context>` block, so it reaches the stored prompt as well as the response.
- [ ] **Done when:**
  - invariant 5 passes;
  - injection strings in labels are filtered;
  - crisis language in a label alone returns the crisis response, and a sensitive topic in a label alone forces the eval gate;
  - a request naming only Path A renders A's label and "no separate label" for B;
  - a question that names both options, sent with empty fields, gets those options mapped rather than treated as unnamed;
  - rebuilt label blocks keep Path A/Path B identities under hard-cap truncation, including one-sided labels; wholly omitted labels have an honest budget placeholder and usage reason;
  - a vague question with career labels and unrelated saved focus selects current career context, keeps the labels in its retrieval query, and selects a career memory; a specific question still wins over conflicting labels, and the local fallback suppresses unrelated saved focus;
  - retained, partially retained, wholly omitted, sanitized-empty, missing and one-sided labels have matching provided/used flags and bounded field counts after `sanitizeSourceUsage`, persist into evaluation/journal snapshots, and display accurately in the usage summary; arbitrary telemetry keys and raw label text remain excluded;
  - the evaluator receives the labels;
  - the local fallback keeps labeled paths;
  - a name that appears only in a label is redacted from the stored evaluation payload and, with `PERSIST_PROMPTS=true`, from the persisted response;
  - the narrative check's decision samples assign no concrete content to unnamed paths.

### Task 9: Memories that personalize without becoming a formula

**Files:** `functions/api/tarot-reading.js` (select candidates with the current inputs before building the payload), `functions/lib/userMemory.js` (new subject/detail extraction and selection; access stamping at 376), `functions/lib/userPersonalization.js:27, 236–245` (load every retained global memory for readings; the store keeps at most 100, and `getMemories` sorts by recency before its `LIMIT`), `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` (apply the same selector for direct callers before rendering), `functions/lib/narrative/prompts/userPrompt.js:37–47`, `tests/userMemory.test.mjs`. **Size:** M.

**Interfaces:**

- `extractPersonalDetailClaims(text, { displayName = '', source = 'memory' } = {}) -> { hasPersonalDetails, ambiguous, claims }`, where each claim is `{ kind: 'age' | 'birthday', value: number | null, subjectKey: string }`; birthdays use null. `source` is `question`, `reflections`, `pathA`, `pathB` or `memory`; the selector passes it explicitly for each field. `hasPersonalDetails` stays true whenever age/birthday text is detected, even when no owner can be resolved. `claims` contains only unambiguously attributed details, while `ambiguous` records any additional unsupported ownership. This pure helper is implemented and tested in `userMemory.js` before the selector.
- `selectMemoriesForReading(memories, { userQuestion = '', reflectionsText = '', decisionPaths = {}, displayName = '', limit = 3 } = {}) -> memory[]`. The builder supplies the already sanitized labels from Task 8 and the querent's display name. Missing labels work before Task 15 is enabled. No new stored-memory schema is required.

- [ ] Replace the whole-note relation-token subset check with detail/subject pairs. Extract claims separately from each question, reflection and path label, then compare the union with each memory's claims. Never join fields before attributing a detail: a child mentioned in one label must not become the owner of an age in another. A personal-detail memory must have at least one supported claim, no ambiguous claim, and an exact `(kind, value, subjectKey)` match for every claim in this reading, regardless of category or keyword overlap. Ambiguous current claims authorize nothing; other unambiguously attributed claims in the same field can still match.
- [ ] Make subject attribution conservative and local to the clause containing each detail:
  - Canonical `self` covers explicit first person (`I`, `me`, `my birthday`), `the user`/`the querent`, and an unambiguous mention of the supplied display name. A standalone current-input fragment such as "Turning 42" is self only when its source is not `memory` and there is no other possible subject in that fragment; an unattributed stored fragment such as "Turning 42" stays unknown.
  - Explicit possessive relations get distinct keys (`relation:child`, `relation:partner`, `relation:mother`, etc.). Normalize grammatical variants and clear aliases (`kid`/`child`, `mom`/`mother`, `dad`/`father`); do not collapse `son` with `daughter`, `mother` with `parent`, or all relatives into a single other-person key. Named subjects use a case-normalized `name:<name>` key in both texts; a relation plus an explicit name uses the name key. A different named person never matches merely because both have the same role.
  - Bind an age to its governing subject and a birthday to its possessive owner, including "my child's birthday" and "Alice's birthday". Keep claims separate across clauses: "I turn 42; my child turns 8" yields two different pairs. A relation mentioned in an unrelated clause does not change a self-owned detail.
  - Return `ambiguous: true` when a personal detail has no supported owner, has competing owners, or refers to an unnamed plural/group whose members cannot be distinguished. Exclude that entire personal-detail memory. Never treat the absence of a relation word as proof of self ownership. Do not resolve ambiguous third-person pronouns from other fields or saved notes.
  - An unnamed singular relation can match only the same unambiguous relation in the current reading. This is a role-level match, not proof of a person's identity; exclude it when either text identifies multiple people in that role. Record this limit in the tests rather than claiming general person recognition.
- [ ] Recognize ages of one to three digits in "8 years old", "42-year-old", "42 y/o", "aged 100" and "turning 42", plus birthdays. "Turns 3 cards" is not an age. A birthday-only question does not authorize an age-bearing note; a note that contains two ages must match both owners and values, not just one shared number. Tune supported phrasing with Task 0 without committing real personal text.
- [ ] Select and rank only after the privacy filter:
  1. Eligible personal-detail notes come first, regardless of general-note token overlap or communication category. Within this tier rank by the number of distinct matched claims, then relevant token overlap, then stable input order.
  2. Other notes require overlapping nontrivial tokens from the current question, reflections or labels, except communication-style notes, which may be selected with zero overlap and are applied silently. Tokenize text and string keywords identically with lowercased `[a-z][a-z'-]{3,}` words, deduplicate them, and ignore `about, been, from, have, into, just, right, that, their, there, they, this, what, when, which, will, with, would, year, years, your`. Keywords may improve relevance but cannot establish detail ownership.
  3. Within that general tier rank by token overlap, using communication category only to break a tie, then stable input order. Apply a nonnegative integer cap last (default three); zero returns none, and an invalid limit returns none. Ignore malformed memory rows and non-string keywords instead of throwing. If more matching-detail notes exist than the cap, retain the highest-ranked ones. Do not promise to retain an unlimited number of needed notes.
- [ ] Add usage rules to `buildReturningQuerentContext`:

```js
    '- Mention at most one remembered note, and only when it changes how a card applies to the current question.',
    '- Apply Communication Style notes silently; do not narrate them (avoid "since you like…").',
    '- Do not restate personal details unless this reading raises the same detail about the same person; the question, reflections and named paths all count as current input.',
```

- [ ] Separate candidate loading from access stamping: add `markAccess` to `getMemories` (default true for existing callers), and have `resolveReadingPersonalizationContext` pass `markAccess: false` for its reading-candidate load. The reading route selects with the sanitized current inputs, stamps only those returned IDs using a user-scoped update, and forwards that same selected set. Direct prompt-builder callers apply the same pure selector without a database write. Rejected private notes and crowded-out candidates receive no access stamp.
- [ ] **Done when:** the extractor and selector tests cover all rows below with synthetic text; assert both the admitted and excluded notes, not just the count:

| Current reading | Stored note | Expected |
|---|---|---|
| "I turn 42 this year" | "I am 42 years old" | Admit |
| "I turn 42 this year" | "I am 8 years old" / "I am aged 100" | Exclude, even with other shared words |
| "My child turns 8" | "I am 8 years old" | Exclude (inverse direction) |
| "I turn 42" | "My child turns 42" | Exclude |
| "My birthday is approaching" | "My partner's birthday is approaching" | Exclude |
| "My partner's birthday is approaching" | "My birthday is approaching" | Exclude (inverse direction) |
| "My birthday is approaching" | "My birthday is approaching" | Admit |
| "My birthday is approaching" | "My birthday is approaching; I am 42 years old" | Exclude the additional unraised age |
| "My child's birthday is approaching" | "My child's birthday is approaching" | Admit |
| "My kid turns 8" | "My child is 8 years old" | Admit canonical relation alias |
| "Alice turns 42" | "Bob is 42 years old" | Exclude distinct names |
| "My child Alice turns 8" | "My child Bob is 8 years old" | Exclude same role, different names |
| "I turn 42", display name Alex | "Alex is 42 years old" | Admit known self alias; without that display name, exclude |
| "My children turn 8" | "My child is 8 years old" | Exclude ambiguous plural ownership |
| "Alice's birthday is approaching" | "ALICE's birthday is approaching" | Admit same normalized name |
| "I turn 42; my child turns 8" | "I am 8 years old; my child is 42 years old" | Exclude swapped owners |
| "I turn 42; my child turns 8" | "I am 42 years old; my child is 8 years old" | Admit both matching pairs |
| "I turn 42; my child visits" | "I am 42 years old" | Admit; an unrelated relation is not the detail's owner |
| A personal detail appears only in a sanitized Path A label | A note matching that detail and its owner | Admit; labels are current input |
| Question "I turn 42"; Path A "My child could move" | "My child turns 42" | Exclude; subjects are not borrowed across fields |
| No personal detail in question/reflections/labels | Any age/birthday note, including a communication note | Exclude |
| "My birthday is approaching" | "Their birthday is approaching" / unattributed or ambiguous owner | Exclude |
| "Turning 42" (current question) | "Turning 42" (unattributed stored note) | Exclude; source-aware attribution is required |
| No supported age claim; only "turns 3 cards" | An age note | Exclude |
| "I am a 42-year-old reader" / "I am 42 y/o" | "I am aged 42" | Admit equivalent age notation |
| Career label, vague question, unrelated saved focus | Relevant career note | Admit through the label; saved focus does not drive selection |

- [ ] Also test that one eligible detail note beats three high-overlap general notes and three communication notes; four eligible detail notes retain the best three deterministically; zero-relevance general notes are excluded; zero/invalid-limit, empty-input and malformed-row cases are safe; and only selected IDs receive access stamps.
- [ ] Task 13's narrative sample seeded with Task 1's synthetic note ("Enjoys spotting patterns across a spread.") shows at most one callback and no "since you like".

### Task 10: A timing line that carries information

**Files:** `functions/lib/pacingHeuristics.js:101–144`, `functions/lib/narrative/prompts/userPrompt.js:162–172`, a new test. **Size:** S.

- [ ] Compare suffix-free labels on both sides. The set lists the two Celtic positions with a `(Card N)` suffix and `src/data/spreads.js` has none, so they never match today; strip a trailing `(Card N)` from each set entry and from each card's position before comparing. Then count every card, weighting named future positions ×2, and keep the 0.55 share threshold.
- [ ] Render the prompt line only for `near-term-tilt` and `longer-arc-tilt`. The journal keeps its existing copy.
- [ ] **Done when:** a five-card draw can return a tilt (a 5,000-draw run returned `developing-arc` for 100% of five-card draws and 73% of decision draws), a Celtic draw counts its Near Future and Outcome cards as named positions, and invariant 7 passes.

### Task 11: Plain-language lens, no talk about the notes

**Files:** `functions/lib/narrative/helpers.js:1093–1095` (the `formatReversalLens` reminder), `functions/lib/narrative/prompts/systemPrompt.js:39–53`. **Size:** S.

- [ ] Reversal block: `- Describe this lens in plain language; don't name it (avoid phrases like 'the Blocked Energy lens').`
- [ ] CORE PRINCIPLES: `- Don't refer to your notes as text (avoid 'folded into this card' or 'the meaning says').`

## Phase 3: Checks

### Task 12: Length telemetry, then an optional floor

**Files:** `functions/api/tarot-reading.js:305–387` (`evaluateQualityGate`; pass `personalization`), `functions/lib/narrative/styleHelpers.js:214` (`resolveNarrativePreferenceContract`), the telemetry schema. **Size:** M.

- [ ] Add `wordCount`, `lengthBand` and `lengthRatio` (`wordCount ÷ band.min`) to `qualityMetrics`, using the depth-aware band (decision bands: quick 400–550, standard 700–900).
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
- [ ] On the two new samples, compare path balance, lens consistency, memory callbacks and "chapter" endings across three runs. The runner generates each sample once per run and overwrites its output, so run `node scripts/evaluation/runNarrativeSamples.js --sample <id> --sample <id> --out <file>` three times, with a different `--out` file each time. This also tests the evaluation's causal claims.

## Phase 4: Practiced-reader features (owner decisions first)

### Task 14: Continuity across recent readings

**Files:** new `functions/lib/recentDraws.js`, `functions/api/tarot-reading.js`, `functions/lib/narrative/prompts/userPrompt.js` (after the memory block), tests. **Size:** M–L.

- [ ] Scope: model prompts only. The local composer bypasses `buildUserPrompt`, so a fallback reading carries no continuity note; that's acceptable for the last-resort path, and a test confirms it still renders.
- [ ] Read up to 5 of the user's journal entries from the last 7 days (`spread_key`, `question`, `cards_json`, `request_id`). Skip a row whose `cards_json` is over 16 KB before parsing it (a real ten-card entry is about 2 KB), and use at most the spread's card count from the rest. `saveAppJournalEntry` caps neither the array nor its size, and these rows are parsed on every reading.
- [ ] Time each entry by when it was generated, not when it was saved. Normal saves don't send `timestampMs`, so `created_at` is the moment someone clicked Save, possibly hours later. A reading can have several attempts, so aggregate first (`MIN(started_at) / 1000` per `request_id` where `task = 'reading'`, as in Task 0; `started_at` is in milliseconds) and join that, giving each entry one row before ordering by generation time and applying the limit. Fall back to `unixepoch(eval_metrics.created_at)` (that column is a datetime string, as Task 0's `metrics_written` handles), then to `created_at`, so every candidate is in Unix seconds.
- [ ] Treat those rows as untrusted. `saveAppJournalEntry` (`functions/lib/journalEntries.js`) stores `question` and `cards_json` from the client without the reading request's sanitizer or a length cap, so a crafted saved question could otherwise inject instructions into later readings.
  - Compare stored questions on the server only; the block below doesn't include their text.
  - If stored text ever reaches the prompt, sanitize it through the same pipeline as the current question (`prepareUserContext` limits plus injection filtering) and render it inside a `<user_context source="recent-question">` boundary.
  - Check stored card names, positions and orientations (`Upright` or `Reversed` only) against the canonical deck and the spread definition before rendering them.
  - Stored text rendered in a `<user_context>` block also needs parser and truncation support: add `recent-question` to `parseUserContext`'s source pattern and give it its own rebuild branch in `truncateUserPromptSafely`, as Task 8 does for path labels. Otherwise a hard-cap truncation drops it, or rebuilds it as a card reflection.
- [ ] Detect a repeated question with its own query across the whole 24-hour window (normalized text), not just among the five rows above, so a busy day can't hide the repeat.
- [ ] Detect cards that recur, especially in the same position.
- [ ] Add a prompt block:

```text
**Recent Draws** (continuity only):
- Judgement appeared yesterday in "What to remember about your free will" (Upright); today it sits there Reversed.
- This question was also asked 39 minutes ago.
Mention at most one of these, only if it deepens this reading. Acknowledge a repeat question gently and never treat a new draw as correcting the earlier one.
```

- [ ] Decide the default: on, opt-in or off.

### Task 15: Let the querent name both paths

**Files:** `src/components/QuestionInput.jsx` (or `ReadingPreparation.jsx`), `src/contexts/ReadingContext.jsx` (request payload), `shared/coach/spreadQuestions.js:105` (hint), additive migration `migrations/0036_add_decision_paths.sql` (`decision_paths_json TEXT`), `src/hooks/useSaveReading.js` (journal save request), `functions/lib/journalEntries.js` (insert), the readers with their own column lists and row decoders (`functions/api/journal.js`, `functions/api/journal/[id].js`, `functions/api/journal/search.js`), and every export that prints entries: `src/lib/journalInsights.js` (Markdown, "Path A: … / Path B: …"), `src/lib/pdfExport.js` (the in-app PDF behind `AccountPage.jsx` and `ReadingJourney/sections/ExportSection.jsx`) and the server PDF `functions/api/journal-export/index.js`. **Size:** M.

- [ ] Show two optional inputs (up to 80 characters each) only for the decision spread, and send them as `decisionPaths` (Task 8).
- [ ] Carry the labels through the journal: send them from `useSaveReading.js`, store them in `journalEntries.js`, and select and decode them in each reader above. A deep-linked entry (`/api/journal/:id`) replaces the cached copy, and server search lists its own rows in place of the cache, so a reader that drops the labels loses them from what the journal shows and exports. Print them in every export.
- [ ] Validate the labels in `saveAppJournalEntry` with the same cleaning, injection filtering and 80-character limit as the reading request. `POST /api/journal` takes them straight from the client, without passing through `tarot-reading.js`.
- [ ] Test that a decision entry keeps its labels after a reload, a deep link and a search; that the Markdown, in-app PDF and server PDF exports print them; and that a direct journal save with an over-long or injected label is rejected or cleaned.
- [ ] Point the coach hint at the new fields. If a decision question names no options and the fields are empty, show a non-blocking nudge.

### Task 16: Notice repeated numbers

**Files:** `functions/lib/knowledgeGraph.js` (detector and highlights), `src/data/knowledgeGraphData.js` (rank themes), `functions/lib/knowledgeBase.js` (passages, per CLAUDE.md), `functions/lib/graphContext.js` (`buildGraphKeys`) and `functions/lib/graphRAG.js` (`retrievePassages`); tests in `tests/graphContext.test.mjs`, `tests/graphRAG.test.mjs` and `tests/graphRAGPatternCoverage.test.mjs`. **Size:** M.

**Interfaces:** generic `repeatedRanks` graph keys are an array of unique numeric Minor ranks 1–10; `getPassagesForPattern('repeated-rank', rank)` supplies their passages. Existing `marseilleRanks` and `marseille-numerology` passages keep their deck-specific meaning.

- [ ] Flag two or more numbered Minor cards of the same rank (#4 drew two Twos in a decision spread) with a short highlight such as "Two Twos: pairs, balance and choice are in the foreground." Validate canonical Minor rank/suit data; a Major numbered II and court cards do not count as numeric pip-rank repeats.
- [ ] Reuse deck-specific detection when it already covers that rank. `detectMarseillePipPatterns` produces `numerologyClusters`, `buildGraphKeys` exposes them as `marseilleRanks`, and retrieval already emits a `marseille-numerology` passage. Suppress the generic detector's highlight and graph key for each covered rank; do not suppress other distinct patterns in that draw.
- [ ] Make the generic passages reachable through a `repeatedRanks` dispatch in `retrievePassages` and a `repeated-rank` branch in `getPassagesForPattern`. Defensively deduplicate there too: when both generic and Marseille keys name the same rank, retain the Marseille passage and discard the generic one before scoring/sorting and `maxPassages`. Normalize numeric rank keys so `2` and `'2'` cannot bypass this check. Repeated copies of a key produce at most one passage.
- [ ] **Done when:**
  - a Rider-Waite draw with two Twos gets one generic highlight and one reachable generic passage in the prompt reference block;
  - the same Marseille draw gets one deck-specific highlight and one Marseille passage, with no generic duplicate;
  - mixed generic/Marseille keys, duplicate keys and numeric/string keys still yield one rank passage before a small passage cap, leaving room for an unrelated eligible pattern;
  - a single Two, a Major II paired with a Minor Two, and repeated courts do not generate a numeric repeated-rank passage; existing Thoth and Marseille pattern tests pass.

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
3. Phase 1 (Tasks 2–6) as one PR, with its prompt version bump.
4. Baseline narrative check (Task 13).
5. Phase 2 (Tasks 7–11) as one PR, with its own version bump.
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
