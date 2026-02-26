---
description: Preview the prompt that would be sent to the LLM for a reading
argument-hint: [spread: single|threeCard|celtic|...] [question]
allowed-tools: Bash, Read, Grep
---

Preview the complete prompt that would be sent to Claude/GPT for generating a tarot reading, without actually calling the LLM.

## Arguments

Parse from $ARGUMENTS:
- **spread**: Spread type (single, threeCard, fiveCard, celtic, decision, relationship)
- **question**: The user's question (everything after spread type)

Example: `/tableu:prompt-preview threeCard What should I focus on this week?`

## Prompt Building Overview

The prompt is built by `buildEnhancedClaudePrompt()` in `functions/lib/narrative/prompts.js`.

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

### 4. Knowledge Graph Context
From `functions/lib/knowledgeGraph.js` + `graphRAG.js`:
- Detected patterns (triads, dyads, Fool's Journey stage)
- Retrieved passages from knowledge base
- Archetypal narratives

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

To see an actual prompt structure, read the spread-specific builder:

```bash
# For three-card spread
cat functions/lib/narrative/spreads/threeCard.js

# For Celtic Cross
cat functions/lib/narrative/spreads/celtic.js
```

## Analyze Prompt Components

### Check what would be included for a spread:

1. **Spread definition:**
```bash
grep -A 20 "key: '$1'" src/data/spreads.js
```

2. **Position meanings:**
```bash
grep -A 30 "positions:" src/data/spreads.js | grep -A 30 "$1"
```

3. **Reversal framework selection logic:**
Read `functions/lib/spreadAnalysis.js:selectReversalFramework()`

4. **GraphRAG passage retrieval:**
Read `functions/lib/graphRAG.js:retrievePassages()`

## Estimate Token Count

The prompt builder estimates tokens and may slim sections to fit budget:

```javascript
// From prompts.js
estimateTokenCount(text) // ~4 chars per token estimate

// Budget targets:
// - claude: ~8000 tokens soft cap
// - gpt: ~6000 tokens soft cap
```

Check current budget settings:
```bash
grep -E "PROMPT_BUDGET|TOKEN" wrangler.jsonc
```

## Live Preview (Requires Dev Server)

If wrangler dev is running, you can trace prompt building:

```bash
# Start dev server with verbose logging
VERBOSE_PROMPT=true npm run dev:workers

# Make a test request
curl -X POST http://localhost:8787/api/tarot-reading \
  -H "Content-Type: application/json" \
  -d '{
    "question": "$2",
    "spread": "$1",
    "cardsInfo": [
      {"card": "The Fool", "position": "Present", "orientation": "upright"},
      {"card": "The Magician", "position": "Challenge", "orientation": "upright"},
      {"card": "The High Priestess", "position": "Advice", "orientation": "reversed"}
    ]
  }'
```

The logs will show prompt construction details.

## Key Files to Examine

For understanding prompt structure:

| File | Purpose |
|------|---------|
| `functions/lib/narrative/prompts.js` | Main prompt builder |
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
3. Whether GraphRAG passages would be retrieved
4. Estimated token count range
5. Any slimming that might occur

Offer to show specific sections in detail.
