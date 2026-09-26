---
description: Preview the prompt that would be sent to the LLM for a reading
argument-hint: "[spread: single|threeCard|celtic|...] [question]"
allowed-tools: Bash, Read, Grep
---

Build and inspect a sample reading prompt locally without calling a model. The preview uses fixture cards and local analysis; it does not reproduce a user's saved memories, live ephemeris, semantic embeddings, or production provider configuration.

## Arguments

Parse from $ARGUMENTS:
- **spread**: Spread type (single, threeCard, fiveCard, celtic, decision, relationship)
- **question**: The user's question (everything after spread type)

Example: `/tableu:prompt-preview threeCard What should I focus on this week?`

## Prompt Building Overview

The prompt is built by `buildEnhancedClaudePrompt()` in `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js`; `functions/lib/narrative/prompts.js` re-exports it.

It assembles these sections:

### 1. System Context
- Reader persona and voice
- Spread-specific interpretation guidelines
- Reversal framework (based on ratio and question keywords)

### 2. Cards Section
Built by spread-specific builders in `functions/lib/narrative/spreads/`:
- Card name, position, orientation
- Position meaning and roleKey
- Elemental dignities between adjacent cards

### 3. Spread Analysis
From `functions/lib/spreadAnalysis.js`:
- Element distribution (fire, water, air, earth)
- Major/Minor Arcana ratio
- Suit patterns and court card presence
- Reversal ratio and recommended framework

### 4. Optional Knowledge Graph Context
From `functions/lib/knowledgeGraph.js` and `functions/lib/graphRAG.js` when graph context is supplied:
- Detected patterns (triads, dyads, Fool's Journey stage)
- Retrieved passages from the knowledge base
- Archetypal narratives

This section is optional. Local analysis uses deterministic keyword and regular-expression matching; it does not generate semantic embeddings or a precomputed semantic/GraphRAG passage payload. If no GraphRAG payload is supplied, the preview has no precomputed semantic retrieval result, and absent metadata is not evidence that semantic retrieval ran.

### 5. User Question & Reflections
- Original question
- Per-card reflections (if provided)
- Vision insights (if physical deck was used)

### 6. Personalization (if authenticated)
From `user_memories` table:
- Past themes and patterns
- Communication preferences
- Life context

## Generate Sample Prompt

Run this from the repository root with Node 24. Replace the two shell arguments with the requested spread and question using proper shell quoting; keep the quoted heredoc unchanged. The example draws the first cards from `MAJOR_ARCANA` as fixtures and uses the real spread positions and card meanings. Use supplied cards instead when the user provides them.

```bash
node --input-type=module - threeCard 'What should I focus on this week?' <<'NODE'
import { SPREADS } from './src/data/spreads.js';
import { MAJOR_ARCANA } from './src/data/majorArcana.js';
import * as analysis from './functions/lib/spreadAnalysis.js';
import { buildEnhancedClaudePrompt } from './functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { estimateTokenCount } from './functions/lib/narrative/prompts/budgeting.js';

const [spreadKey = 'threeCard', ...questionWords] = process.argv.slice(2);
if (!Object.hasOwn(SPREADS, spreadKey)) {
  throw new Error(`Unknown spread: ${spreadKey}`);
}
const spread = SPREADS[spreadKey];
const userQuestion = questionWords.join(' ') || 'What should I focus on this week?';
const spreadInfo = { key: spreadKey, name: spread.name };
const cardsInfo = MAJOR_ARCANA.slice(0, spread.count).map((card, index) => ({
  card: card.name,
  number: card.number,
  position: spread.positions[index],
  roleKey: spread.roleKeys[index],
  orientation: index % 3 === 2 ? 'Reversed' : 'Upright',
  meaning: index % 3 === 2 ? card.reversed : card.upright
}));
const analyzers = {
  single: analysis.analyzeSingleCard,
  threeCard: analysis.analyzeThreeCard,
  fiveCard: analysis.analyzeFiveCard,
  celtic: analysis.analyzeCelticCross,
  decision: analysis.analyzeDecision,
  relationship: analysis.analyzeRelationship
};
const themes = await analysis.analyzeSpreadThemes(cardsInfo, {
  deckStyle: 'rws-1909', userQuestion, env: {}
});
const { systemPrompt, userPrompt, promptMeta } = buildEnhancedClaudePrompt({
  spreadInfo,
  cardsInfo,
  userQuestion,
  themes,
  spreadAnalysis: analyzers[spreadKey](cardsInfo),
  context: 'general',
  deckStyle: 'rws-1909',
  budgetTarget: 'claude',
  promptBudgetEnv: {},
  enableSemanticScoring: false
});
const systemTokens = estimateTokenCount(systemPrompt);
const userTokens = estimateTokenCount(userPrompt);
const tokenEstimate = { system: systemTokens, user: userTokens, total: systemTokens + userTokens };
console.log(JSON.stringify({ spreadInfo, cardsInfo, systemPrompt, userPrompt, promptMeta, tokenEstimate }, null, 2));
NODE
```

The local sample's analysis uses deterministic keyword and regular-expression rules. With `env: {}` and semantic scoring disabled, it does not load provider configuration, generate embeddings, or supply a precomputed semantic/GraphRAG passage payload. If a caller supplies `themes.knowledgeGraph` with retrieved passages, the builder can consume that separate payload; local keyword matches alone are not semantic retrieval. For a particular provider, inspect its assembly in `functions/lib/narrativeBackends.js` and pass the applicable budget/context values before comparing outputs.

## Analyze the Result

- Read positions and role keys from the selected `SPREADS` entry in `src/data/spreads.js`.
- Read reversal selection in `functions/lib/spreadAnalysis.js:selectReversalFramework()`.
- Read `promptMeta.sourceUsage?.graphRAG` for whether GraphRAG was requested, used, or skipped. Read `promptMeta.graphRAG?.includedInPrompt` only when GraphRAG metadata is present; that field is authoritative for full or summary injection. An absent value means no GraphRAG metadata was produced, not that passages were injected.
- When GraphRAG metadata exists, inspect `passagesProvided`, `passagesUsedInPrompt`, `truncatedPassages`, and semantic-scoring metadata.
- Use `tokenEstimate` for heuristic token counts, and `promptMeta.slimmingSteps`, `truncation` and `hardCap` for changes made during assembly. `promptMeta.estimatedTokens` can be null when no slimming or truncation ran. The estimator and provider budgets live in `functions/lib/narrative/prompts/budgeting.js`; these are estimates, not provider usage counts.

## Live Reading Tests

`POST /api/tarot-reading` generates a real reading and can call paid generation/evaluation services. It is not a prompt-only preview. For an explicitly requested integration test, use the complete `spreadInfo`, `userQuestion` and `cardsInfo` request in the evaluation skill's `references/troubleshooting.md`.

Raw prompts are returned only when `includePromptDebug: true`, `PROMPT_DEBUG_ENABLED`, and service authentication with owner access are all present; see `resolvePromptDebugAccess()` in `functions/api/tarot-reading.js`. Ordinary local requests do not return prompts. `VERBOSE_PROMPT` is not a supported logging flag.

## Key Files to Examine

For understanding prompt structure:

| File | Purpose |
|------|---------|
| `functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js` | Prompt assembly and slimming |
| `functions/lib/narrative/prompts/systemPrompt.js` | System instructions |
| `functions/lib/narrative/prompts/userPrompt.js` | Cards and user context |
| `functions/lib/narrative/prompts/budgeting.js` | Token estimates and budgets |
| `functions/lib/narrative/spreads/*.js` | Spread-specific card formatting |
| `functions/lib/spreadAnalysis.js` | Analysis and reversal framework |
| `functions/lib/knowledgeGraph.js` | Pattern detection |
| `functions/lib/graphRAG.js` | Passage retrieval |
| `functions/lib/graphContext.js` | Context assembly |
| `src/data/spreads.js` | Spread definitions |
| `src/data/knowledgeGraphData.js` | Pattern definitions |

## Output

Display:
1. Spread structure and positions
2. What analysis sections would be included
3. GraphRAG status and provenance when metadata is available; otherwise report `metadata_absent` rather than claiming retrieval or `not_requested` semantics
4. Estimated token count range
5. Any slimming that might occur

Offer to show specific sections in detail.
