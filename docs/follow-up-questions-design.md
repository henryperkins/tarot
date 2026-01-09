# Follow-Up Questions Feature Design

## Overview

This document explores approaches for enabling users to ask questions about their personalized tarot reading after it's generated.

---

## Narrative Builder Architecture Insights

Analysis of [`functions/lib/narrative/prompts.js`](../functions/lib/narrative/prompts.js) reveals the prompt engineering system that can inform follow-up design:

### Story Spine Pattern
The narrative builder uses a WHAT/WHY/WHAT'S NEXT story spine (lines 721-727):
```javascript
// CORE PRINCIPLES
'- In each section, loosely follow a story spine: name what is happening (WHAT),
    why it matters or how it arose (WHY), and what might be next in terms of
    options or small steps (WHAT'S NEXT).'
```

**Follow-Up Implication**: Follow-up responses should maintain this spine structure, extending the original narrative's trajectory rather than starting fresh.

### Personalization Systems
The builder supports extensive personalization (lines 111-122):
```javascript
const TONE_GUIDANCE = {
  gentle: `Use warm, nurturing language...`,
  balanced: `Be honest but kind...`,
  blunt: `Be direct and clear...`
};

const FRAME_GUIDANCE = {
  psychological: `Interpret through Jungian archetypes...`,
  spiritual: `Embrace intuitive, mystical language...`,
  mixed: `Blend psychological insight with spiritual symbolism...`,
  playful: `Keep it light, fun, and exploratory...`
};
```

**Follow-Up Implication**: Follow-ups MUST inherit the user's `readingTone` and `spiritualFrame` preferences to maintain consistency.

### Depth Profiles
The system supports depth preferences via `getDepthProfile()`:
- **Standard**: Concise, focused responses
- **Deep**: Longer, more layered interpretations with esoteric detail

**Follow-Up Implication**: Deep preference users may want multi-turn exploration; standard users want quick clarifications.

### GraphRAG Integration
Traditional wisdom passages are injected via GraphRAG (lines 831-883):
```javascript
if (includeGraphRAG && isGraphRAGEnabled(options.env) && themes?.knowledgeGraph?.graphKeys) {
  // Retrieve and format passages
  const retrievedPassages = retrievePassages(activeThemes.knowledgeGraph.graphKeys, { ... });
}
```

**Follow-Up Implication**: Follow-up endpoint should have access to the same GraphRAG payload to maintain interpretive consistency.

### Spread-Specific Context
Each spread type has unique position relationships:
- **Celtic Cross**: Nucleus → Timeline → Consciousness → Staff flow
- **Three-Card**: Past → Present → Future causality
- **Relationship**: You/Them/Connection interplay

**Follow-Up Implication**: Position-aware follow-ups ("Tell me more about the Challenge card") require spread metadata.

---

## Journal Data Integration for Contextual Follow-Ups

Analysis of [`functions/api/journal.js`](../functions/api/journal.js) and [`functions/lib/coachSuggestion.js`](../functions/lib/coachSuggestion.js) reveals rich historical data that could dramatically enhance follow-up conversations.

### Available Journal Data Per Entry

```javascript
// From journal_entries table
{
  id, created_at,
  spread_key, spread_name,
  question,                    // Original user intention
  cards_json,                  // Full card array with positions
  narrative,                   // Complete AI reading
  themes_json,                 // GraphRAG themes, elemental counts
  reflections_json,            // Per-card user reflections
  context,                     // love/career/self/spiritual
  provider,                    // azure/claude/local
  deck_id,                     // Deck style used
  request_id,                  // API correlation
  extracted_steps,             // AI-extracted actionable guidance
  step_embeddings,             // 768-dim vectors for semantic search
  extraction_version,          // Coach extraction version
  location_latitude/longitude/timezone  // (if consented)
}
```

### Coach Extraction System

The [`coachSuggestion.js`](../functions/lib/coachSuggestion.js) system already extracts actionable steps:

```javascript
// From coachSuggestion.js lines 26-40
const EXTRACT_STEPS_SYSTEM = `You extract actionable next steps from tarot reading narratives.

Rules:
- Extract 1-5 concrete, actionable steps the reading suggests
- Look for sections like "Gentle Next Steps", "Suggestions", "Moving Forward"
- Convert to first-person imperatives ("Set...", "Practice...", "Journal about...")
`;
```

This means every saved journal entry has:
1. **Extracted Steps**: Normalized action items from the reading
2. **Step Embeddings**: 768-dimensional vectors via `@cf/baai/bge-base-en-v1.5`

### Benefits of Journal Integration

| Feature | Value for Follow-Ups |
|---------|---------------------|
| **Pattern Recognition** | "This is the 4th time The Tower has appeared in your readings this month..." |
| **Semantic Search** | Find past readings with similar themes via embedding similarity |
| **Recurring Card Analysis** | "You've asked about career 6 times - here's what the cards have consistently said..." |
| **Progress Tracking** | "Last month you drew The Hermit for introspection - how did that inner work unfold?" |
| **Cross-Reading Synthesis** | Connect dots across multiple readings for deeper insight |
| **Step Follow-Through** | "You were guided to set boundaries - did you take that step?" |

### Journal-Aware Follow-Up Prompt Enhancement

```javascript
// Proposed enhancement to follow-up prompt builder
function buildJournalAwareFollowUpContext(env, userId, currentReading, followUpQuestion) {
  // 1. Find semantically similar past readings
  const questionEmbedding = await generateEmbeddings(env, [followUpQuestion]);
  const similarEntries = await findSimilarJournalEntries(env, userId, questionEmbedding, {
    limit: 3,
    minSimilarity: 0.7
  });
  
  // 2. Check for recurring cards
  const currentCards = currentReading.cardsInfo.map(c => c.card);
  const cardHistory = await getCardFrequencyForUser(env, userId, currentCards);
  
  // 3. Find thematically related past guidance
  const relatedSteps = await findRelevantExtractedSteps(env, userId, followUpQuestion);
  
  return {
    similarReadings: similarEntries,
    recurringCards: cardHistory,
    relatedGuidance: relatedSteps
  };
}
```

### Example Journal-Enhanced Follow-Up

**User asks**: "What should I focus on with the reversed Queen of Swords?"

**Without journal context**:
> "The reversed Queen of Swords suggests examining where communication may be blocked or overly critical..."

**With journal context**:
> "The reversed Queen of Swords has appeared in 3 of your last 5 readings, always in positions related to self-expression. In your October reading about career, this card suggested setting clearer boundaries with colleagues. In your November self-reflection spread, it pointed to internal self-criticism.
>
> The pattern suggests an ongoing journey with communication and self-compassion. Today's appearance in the Challenge position echoes those earlier readings - perhaps there's an invitation to notice where the sharp-tongued inner critic is blocking your authentic voice. What did you discover from those previous boundary-setting suggestions?"

### Embeddings Search Implementation

```javascript
// functions/lib/journalSearch.js (proposed)

/**
 * Find journal entries semantically similar to a query
 */
export async function findSimilarJournalEntries(env, userId, queryEmbedding, options = {}) {
  const { limit = 3, minSimilarity = 0.65 } = options;
  
  // Fetch recent entries with embeddings (already loaded in journal.js)
  const entries = await env.DB.prepare(`
    SELECT id, question, narrative, extracted_steps, step_embeddings, created_at
    FROM journal_entries
    WHERE user_id = ? AND step_embeddings IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(userId).all();
  
  // Compute cosine similarity with query
  const scored = entries.results.map(entry => {
    const embeddings = JSON.parse(entry.step_embeddings);
    const maxSim = Math.max(...embeddings.map(emb => cosineSimilarity(queryEmbedding, emb)));
    return { ...entry, similarity: maxSim };
  });
  
  return scored
    .filter(e => e.similarity >= minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
```

---

## Current Architecture Analysis

### Reading Generation Flow

1. **Intention Setting**: User crafts question via `GuidedIntentionCoach` or `QuickIntentionCard`
2. **Card Draw**: Cards dealt and revealed through `ReadingContext` state
3. **Narrative Generation**: POST to `/api/tarot-reading` with spread info, cards, question, reflections
4. **Display**: `ReadingDisplay.jsx` renders narrative via `StreamingNarrative.jsx`

### State Available Post-Reading (from `ReadingContext.jsx`)

```javascript
// Core reading state
personalReading     // Generated narrative object { raw, normalized, paragraphs, hasMarkdown }
reading             // Array of card objects with position, name, orientation, meaning
userQuestion        // Original user intention
reflections         // Per-card user reflections { [index]: string }

// Analysis state
themes              // { suitCounts, elementCounts, reversalCount, knowledgeGraph }
analysisContext     // Detected context (love/career/self/spiritual)
emotionalTone       // Derived emotion for TTS { emotion, confidence }
readingMeta         // { requestId, provider, spreadKey, spreadName, graphContext, ephemeris }
spreadAnalysis      // Position relationships, elemental dignities
```

### Existing UI Patterns

- **`GuidedIntentionCoach`**: Full modal for crafting intentions with topic selection, history
- **`coachStorage.js`**: Persists question history in localStorage
- **`FeedbackPanel`**: Rating mechanism (not conversational)
- **No existing chat/conversation infrastructure**

---

## Proposed Approaches

### Approach 1: Suggested Follow-Up Questions (Quick Win)

Generate 2-3 contextual follow-up questions based on the reading that users can tap to explore further.

**Implementation**:
```jsx
// src/components/FollowUpSuggestions.jsx
const suggestions = useMemo(() => {
  const items = [];
  
  // Reversed card exploration
  const reversedCards = reading.filter(c => c.isReversed);
  if (reversedCards.length > 0) {
    items.push({
      text: `What does ${reversedCards[0].name} reversed suggest I work on?`,
      type: 'reversal'
    });
  }
  
  // Position-specific (for Celtic Cross)
  if (readingMeta.spreadKey === 'celtic') {
    items.push({
      text: 'How do the crossing and outcome cards connect?',
      type: 'position'
    });
  }
  
  // Action-oriented
  items.push({
    text: 'What's the single most important action I should take?',
    type: 'action'
  });
  
  return items.slice(0, 3);
}, [reading, readingMeta]);
```

**Pros**: Simple UX, guided exploration, low implementation cost
**Cons**: Limited flexibility, doesn't address specific user curiosity

---

### Approach 2: Free-Form Chat Panel (Full Feature)

Add a chat interface below the narrative for open-ended follow-up questions.

**New API Endpoint**: `POST /api/reading-followup`

```javascript
// functions/api/reading-followup.js
export const onRequestPost = async ({ request, env }) => {
  const { requestId, followUpQuestion, conversationHistory } = await request.json();
  
  // Retrieve original reading context from METRICS_DB
  const readingContext = await env.METRICS_DB.get(`reading:${requestId}`);
  if (!readingContext) {
    return jsonResponse({ error: 'Reading not found' }, { status: 404 });
  }
  
  // Build follow-up prompt with full reading context
  const prompt = buildFollowUpPrompt({
    originalReading: readingContext.narrative,
    cardsInfo: readingContext.cardsInfo,
    userQuestion: readingContext.userQuestion,
    themes: readingContext.themes,
    followUpQuestion,
    conversationHistory
  });
  
  // Use same backend chain as tarot-reading
  const response = await generateFollowUpResponse(env, prompt);
  
  return jsonResponse({
    response,
    turn: conversationHistory.length + 1
  });
};
```

**Frontend Component**: `FollowUpChat.jsx`

```jsx
function FollowUpChat({ requestId, reading, personalReading, themes }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const askFollowUp = async (question) => {
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    
    const response = await fetch('/api/reading-followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        followUpQuestion: question,
        conversationHistory: messages
      })
    });
    
    const data = await response.json();
    setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    setIsLoading(false);
  };
  
  return (
    <div className="follow-up-chat">
      <HelperToggle title="Ask a follow-up question">
        {messages.map((msg, i) => (
          <ChatMessage key={i} {...msg} />
        ))}
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="What else would you like to know?"
        />
        <button onClick={() => askFollowUp(input)}>Ask</button>
      </HelperToggle>
    </div>
  );
}
```

**Pros**: Full flexibility, natural conversational UX
**Cons**: Higher complexity, requires conversation state, more API cost

---

### Approach 3: Hybrid (Recommended)

Combine suggested questions with free-form input for the best of both worlds.

```jsx
function FollowUpSection({ requestId, reading, personalReading, themes, readingMeta }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [customQuestion, setCustomQuestion] = useState('');
  
  const suggestedQuestions = useMemo(() => 
    generateContextualSuggestions(reading, themes, readingMeta), 
    [reading, themes, readingMeta]
  );
  
  if (!personalReading || personalReading.isError) return null;
  
  return (
    <div className="mt-6 border-t border-secondary/30 pt-6">
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-accent hover:text-main"
      >
        <ChatCircle className="w-5 h-5" />
        <span>Have a question about your reading?</span>
      </button>
      
      {isExpanded && (
        <div className="mt-4 space-y-4">
          {/* Suggested questions */}
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => askFollowUp(q.text)}
                className="px-3 py-1.5 text-sm rounded-full border border-accent/30 
                           hover:border-accent hover:bg-accent/10 transition"
              >
                {q.text}
              </button>
            ))}
          </div>
          
          {/* Conversation history */}
          {messages.length > 0 && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {messages.map((msg, i) => (
                <div key={i} className={msg.role === 'user' ? 'text-right' : ''}>
                  <p className={`inline-block px-3 py-2 rounded-lg ${
                    msg.role === 'user' 
                      ? 'bg-primary/20 text-main' 
                      : 'bg-surface-muted text-muted'
                  }`}>
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          )}
          
          {/* Free-form input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customQuestion}
              onChange={e => setCustomQuestion(e.target.value)}
              placeholder="Or ask your own question..."
              className="flex-1 px-4 py-2 rounded-lg border border-secondary/40 
                         bg-surface/80 focus:border-accent focus:ring-1 focus:ring-accent"
            />
            <button
              onClick={() => askFollowUp(customQuestion)}
              className="px-4 py-2 bg-accent text-surface rounded-lg hover:bg-accent/90"
            >
              Ask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Suggested Question Generation Logic

```javascript
// src/lib/followUpSuggestions.js

export function generateContextualSuggestions(reading, themes, readingMeta) {
  const suggestions = [];
  const spreadKey = readingMeta?.spreadKey || 'general';
  
  // 1. Reversed card exploration
  const reversedCards = reading.filter(c => c.isReversed);
  if (reversedCards.length === 1) {
    suggestions.push({
      text: `What does ${reversedCards[0].name} reversed want me to understand?`,
      type: 'reversal',
      priority: 1
    });
  } else if (reversedCards.length > 1) {
    suggestions.push({
      text: 'What pattern do the reversed cards reveal together?',
      type: 'reversal',
      priority: 1
    });
  }
  
  // 2. Spread-specific questions
  const spreadQuestions = {
    celtic: [
      'How do the crossing and outcome cards connect?',
      'What does the subconscious foundation reveal?'
    ],
    threeCard: [
      'How does the present card bridge past and future?',
      'What action bridges where I am and where I\'m heading?'
    ],
    relationship: [
      'How can I better understand the other person\'s perspective?',
      'What shared ground do these cards suggest?'
    ],
    decision: [
      'Which path aligns more with my values?',
      'What factor should weigh most in my choice?'
    ]
  };
  
  if (spreadQuestions[spreadKey]) {
    suggestions.push({
      text: spreadQuestions[spreadKey][0],
      type: 'spread',
      priority: 2
    });
  }
  
  // 3. Elemental imbalance
  if (themes?.elementCounts) {
    const dominant = Object.entries(themes.elementCounts)
      .sort(([,a], [,b]) => b - a)[0];
    if (dominant && dominant[1] >= 3) {
      suggestions.push({
        text: `What does the strong ${dominant[0]} energy suggest I need?`,
        type: 'elemental',
        priority: 3
      });
    }
  }
  
  // 4. Major Arcana emphasis
  const majorCards = reading.filter(c => c.number <= 21 && c.number >= 0);
  if (majorCards.length >= 3) {
    suggestions.push({
      text: 'What life lesson do these Major Arcana cards emphasize?',
      type: 'archetype',
      priority: 2
    });
  }
  
  // 5. Action-oriented (always include)
  suggestions.push({
    text: 'What\'s the single most important thing I should focus on?',
    type: 'action',
    priority: 4
  });
  
  // Sort by priority and take top 3
  return suggestions
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);
}
```

---

## Backend: Follow-Up Prompt Engineering

```javascript
// functions/lib/followUpPrompt.js

export function buildFollowUpPrompt({
  originalReading,
  cardsInfo,
  userQuestion,
  themes,
  followUpQuestion,
  conversationHistory = []
}) {
  const cardSummary = cardsInfo
    .map(c => `${c.position}: ${c.card} (${c.orientation})`)
    .join('\n');
  
  const systemPrompt = `You are a thoughtful tarot reader continuing a conversation about a reading you've given.

READING CONTEXT:
- Original question: ${userQuestion || 'Open reflection'}
- Spread: ${themes?.spreadKey || 'general'}
- Cards drawn:
${cardSummary}

ORIGINAL NARRATIVE (excerpt):
${originalReading?.substring(0, 1500)}...

GUIDELINES:
- Reference specific cards and their positions when relevant
- Stay grounded in the reading already given—don't introduce new cards
- Keep responses focused and under 200 words
- Use second person ("you") and maintain warm, supportive tone
- If asked about timing, be honest that tarot offers trajectories, not dates
- If the question is outside the reading's scope, gently redirect`;

  const userPrompt = conversationHistory.length > 0
    ? `Previous exchanges:\n${conversationHistory.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nNew question: ${followUpQuestion}`
    : followUpQuestion;

  return { systemPrompt, userPrompt };
}
```

---

## Implementation Phases

### Phase 1: Suggested Questions (1-2 days)
1. Create `src/lib/followUpSuggestions.js` with context-aware generation
2. Add `FollowUpSuggestions` component below narrative in `ReadingDisplay.jsx`
3. Each suggestion re-triggers narrative generation with modified question

### Phase 2: Chat Backend (2-3 days)
1. Create `functions/api/reading-followup.js` endpoint
2. Update `ReadingContext` with follow-up state
3. Add conversation turn limits (3-5 turns) and rate limiting

### Phase 3: Chat UI (2-3 days)
1. Build `FollowUpChat.jsx` component with hybrid UX
2. Integrate into `ReadingDisplay.jsx` after narrative
3. Add loading states, error handling, mobile optimization

### Phase 4: Polish & Telemetry (1-2 days)
1. Persist follow-up turns to journal (optional)
2. Add telemetry for follow-up usage patterns
3. A/B test suggested question effectiveness

---

## Usage Considerations

### Rate Limiting
- Follow-up turns should count against reading limits OR have separate budget
- Suggested: 3 free follow-ups per reading, then prompt upgrade

### Tier Differentiation
| Tier | Follow-Ups per Reading |
|------|------------------------|
| Free | 1 |
| Plus | 3 |
| Pro  | Unlimited (within session) |

### State Persistence
- Follow-up messages NOT persisted by default (ephemeral)
- Option to "Save this exchange" to journal entry

---

## Files to Create/Modify

### New Files
- `src/components/FollowUpSection.jsx` - Main UI component
- `src/lib/followUpSuggestions.js` - Question generation logic
- `functions/api/reading-followup.js` - Backend endpoint
- `functions/lib/followUpPrompt.js` - Prompt engineering

### Modified Files
- `src/components/ReadingDisplay.jsx` - Add FollowUpSection
- `src/contexts/ReadingContext.jsx` - Add follow-up state
- `tests/followUpSuggestions.test.mjs` - Unit tests

---

## Open Questions

1. **Should follow-ups count against reading quota?** 
   - Recommendation: Separate budget, 1-3 per reading depending on tier

2. **Persist to journal?**
   - Recommendation: Optional "save exchange" button, not automatic

3. **Voice narration for follow-ups?**
   - Recommendation: Yes, reuse existing TTS infrastructure

4. **Show follow-ups on shared readings?**
   - Recommendation: No, follow-ups are private/ephemeral
