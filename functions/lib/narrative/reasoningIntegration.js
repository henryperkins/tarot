/**
 * Reasoning Chain Integration Layer
 *
 * Connects the reasoning chain to existing narrative builders,
 * providing reasoning-informed template selection and synthesis building.
 *
 * @module reasoningIntegration
 */

import {
  buildReadingReasoning
} from './reasoning.js';

import { sanitizeDisplayName } from './styleHelpers.js';

// ============================================================================
// REASONING-INFORMED TEMPLATE SELECTION
// ============================================================================

/**
 * Connector phrases based on reasoning context
 */
const REASONING_CONNECTORS = {
  // Tension-aware connectors
  'emotional-contrast-ascending': [
    'Yet from this weight, something begins to lift—',
    'But here, the energy shifts toward—',
    'And yet, light breaks through as—'
  ],
  'emotional-contrast-descending': [
    'However, this brightness meets shadow with—',
    'Yet this gives way to—',
    'But now, a different energy emerges—'
  ],
  'elemental-opposition': [
    'This elemental tension asks for integration—',
    'These opposing forces meet in—',
    'Balancing this friction, we find—'
  ],
  'action-reflection-to-reflection': [
    'Yet before moving further, consider—',
    'But first, pause to receive—',
    'However, stillness precedes action—'
  ],
  'action-reflection-to-action': [
    'And yet, action calls through—',
    'But now movement beckons with—',
    'However, the time for doing arrives—'
  ],

  // Arc-aware connectors
  'arc-struggle-to-resolution': [
    'From this difficulty, transformation unfolds—',
    'Through this challenge, growth emerges—',
    'This struggle seeds what follows—'
  ],
  'arc-inner-journey': [
    'Going deeper within—',
    'Turning inward further—',
    'In the quiet space—'
  ],
  'arc-active-momentum': [
    'Building on this energy—',
    'With momentum gathering—',
    'Moving forward decisively—'
  ],

  // Emphasis-aware connectors
  'pivot-incoming': [
    'This brings us to the pivot—',
    'And here, at the turning point—',
    'Now, at the heart of it—'
  ],
  'after-pivot': [
    'From this pivot, we see—',
    'With this as the fulcrum—',
    'Building on this insight—'
  ]
};

/**
 * Select a connector phrase based on reasoning context
 *
 * @param {Object} reasoning - The reasoning chain
 * @param {number} currentIndex - Current card index
 * @param {number} nextIndex - Next card index
 * @returns {string} Selected connector phrase
 */
export function selectReasoningConnector(reasoning, currentIndex, nextIndex) {
  // Check for relevant tension between these positions
  const tension = reasoning.tensions?.find(t =>
    t.positions.includes(currentIndex) && t.positions.includes(nextIndex)
  );

  if (tension) {
    let key = tension.type;

    // Add direction for emotional contrasts
    if (tension.type === 'emotional-contrast') {
      const direction = reasoning.emotionalArc?.direction || 'stable';
      key = `emotional-contrast-${direction === 'ascending' ? 'ascending' : 'descending'}`;
    }

    // Add direction for action-reflection
    if (tension.type === 'action-reflection') {
      const nextEmphasis = reasoning.emphasisMap?.[nextIndex];
      key = nextEmphasis?.reasons?.includes('pivot position')
        ? 'action-reflection-to-reflection'
        : 'action-reflection-to-action';
    }

    const connectors = REASONING_CONNECTORS[key];
    if (connectors?.length > 0) {
      return pickOne(connectors);
    }
  }

  // Check for pivot-related connectors
  if (reasoning.pivotCard?.index === nextIndex) {
    return pickOne(REASONING_CONNECTORS['pivot-incoming']);
  }
  if (reasoning.pivotCard?.index === currentIndex) {
    return pickOne(REASONING_CONNECTORS['after-pivot']);
  }

  // Fall back to arc-based connectors
  const arcKey = `arc-${reasoning.narrativeArc?.key}`;
  if (REASONING_CONNECTORS[arcKey]) {
    return pickOne(REASONING_CONNECTORS[arcKey]);
  }

  return null; // Let the default connector system handle it
}

/**
 * Pick a random element from an array
 */
function pickOne(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================================================
// REASONING-INFORMED OPENING
// ============================================================================

/**
 * Opening variations based on question intent
 */
const INTENT_OPENINGS = {
  decision: [
    'You stand at a crossroads, weighing your options.',
    'A choice calls for your attention.',
    'You\'re navigating a decision that matters.'
  ],
  timing: [
    'You\'re wondering about timing and readiness.',
    'The question of "when" is on your mind.',
    'You sense something wants to shift, and wonder when.'
  ],
  blockage: [
    'You sense something in the way.',
    'There\'s a feeling of friction or stuckness you\'re exploring.',
    'You\'re investigating what might be holding things back.'
  ],
  confirmation: [
    'You\'re looking for guidance on a path you\'re considering.',
    'You want to check your direction.',
    'You\'re seeking clarity on something you\'re already feeling.'
  ],
  outcome: [
    'You\'re curious about where things are heading.',
    'You want to understand the trajectory you\'re on.',
    'You\'re looking ahead to see what\'s unfolding.'
  ],
  understanding: [
    'You\'re seeking deeper understanding.',
    'You want to see more clearly into this situation.',
    'You\'re looking for insight and meaning.'
  ],
  exploration: [
    'You\'re open to what the cards reveal.',
    'You come with curiosity and openness.',
    'You\'re ready to explore what wants attention.'
  ],
  open: [
    'Let\'s see what the cards have to share.',
    'The spread is laid; let\'s explore together.',
    'Here\'s what emerges for you today.'
  ]
};

/**
 * Build a reasoning-informed opening
 *
 * @param {string} spreadName - Name of the spread
 * @param {string} userQuestion - The user's question
 * @param {string} context - Reading context
 * @param {Object} reasoning - The reasoning chain
 * @param {Object} options - Additional options
 * @returns {string} Opening text
 */
export function buildReasoningAwareOpening(spreadName, userQuestion, context, reasoning, options = {}) {
  const parts = [];

  // Spread introduction
  parts.push(`**${spreadName}**`);

  // Question-intent-aware opening
  const intentType = reasoning.questionIntent?.type || 'open';
  const intentOpening = pickOne(INTENT_OPENINGS[intentType] || INTENT_OPENINGS.open);
  parts.push(intentOpening);

  // Add arc preview if notable
  if (reasoning.narrativeArc?.key !== 'unfolding') {
    parts.push(`*${reasoning.narrativeArc.description}.*`);
  }

  // Add personalization bridge if available
  const safeName = sanitizeDisplayName(options.personalization?.displayName);
  if (safeName) {
    parts.push(`${safeName}, let's explore what the cards reveal.`);
  }

  return parts.join('\n\n');
}

// ============================================================================
// REASONING-INFORMED CARD TEXT ENHANCEMENT
// ============================================================================

/**
 * Emphasis markers for different emphasis levels
 */
const EMPHASIS_MARKERS = {
  high: {
    prefix: '**',
    suffix: '**',
    annotation: '*This position carries particular weight in your reading.*'
  },
  moderate: {
    prefix: '',
    suffix: '',
    annotation: ''
  },
  normal: {
    prefix: '',
    suffix: '',
    annotation: ''
  }
};

/**
 * Enhance card text based on reasoning
 *
 * @param {string} baseText - The base card text from existing builder
 * @param {number} cardIndex - Index of the card
 * @param {Object} reasoning - The reasoning chain
 * @returns {Object} Enhanced text with metadata
 */
export function enhanceCardTextWithReasoning(baseText, cardIndex, reasoning) {
  if (!reasoning) return { text: baseText, enhanced: false };

  const emphasisInfo = reasoning.emphasisMap?.[cardIndex];
  const emphasis = emphasisInfo?.emphasis || 'normal';
  const marker = EMPHASIS_MARKERS[emphasis];

  let enhancedText = baseText;
  const enhancements = [];

  // Add pivot annotation
  if (reasoning.pivotCard?.index === cardIndex) {
    enhancedText += `\n\n*${reasoning.pivotCard.reason}*`;
    enhancements.push('pivot');
  }

  // Add tension context
  const relevantTension = reasoning.tensions?.find(t =>
    t.isKeyTension && t.positions.includes(cardIndex)
  );
  if (relevantTension && relevantTension.significance) {
    enhancedText += `\n\n*${relevantTension.significance}*`;
    enhancements.push('key-tension');
  }

  // Add emotional peak/valley annotation
  if (reasoning.emotionalArc?.peak?.card === reasoning.emphasisMap?.[cardIndex]?.card) {
    enhancedText += '\n\n*This card represents an emotional high point in your spread.*';
    enhancements.push('emotional-peak');
  }
  if (reasoning.emotionalArc?.valley?.card === reasoning.emphasisMap?.[cardIndex]?.card) {
    enhancedText += '\n\n*This card marks a point of challenge or depth in your journey.*';
    enhancements.push('emotional-valley');
  }

  // Apply emphasis markers if high
  if (emphasis === 'high' && marker.annotation) {
    enhancedText += `\n\n${marker.annotation}`;
    enhancements.push('high-emphasis');
  }

  return {
    text: enhancedText,
    enhanced: enhancements.length > 0,
    enhancements,
    emphasis
  };
}

// ============================================================================
// REASONING-INFORMED SYNTHESIS
// ============================================================================

/**
 * Build a reasoning-informed synthesis section
 *
 * @param {Array} cardsInfo - Array of card information
 * @param {Object} reasoning - The reasoning chain
 * @param {Object} themes - Theme analysis
 * @param {string} userQuestion - The user's question
 * @param {string} context - Reading context
 * @returns {string} Synthesis text
 */
export function buildReasoningSynthesis(cardsInfo, reasoning, _themes, _userQuestion, _context) {
  // Intentionally reserved for future synthesis enrichment while preserving the
  // documented public signature (see docs/reasoning-chain.md).
  void cardsInfo;
  void _themes;
  void _userQuestion;
  void _context;

  const sections = [];

  // Add synthesis hooks from reasoning
  if (reasoning.synthesisHooks?.length > 0) {
    reasoning.synthesisHooks.forEach(hook => {
      sections.push(hook.text);
    });
  }

  // Add throughlines
  if (reasoning.throughlines?.length > 0) {
    sections.push('**Recurring Themes:**');
    reasoning.throughlines.forEach(throughline => {
      sections.push(`- ${throughline}`);
    });
  }

  // Add emotional arc summary
  if (reasoning.emotionalArc?.summary) {
    sections.push(`\n**Emotional Journey:** ${reasoning.emotionalArc.summary}`);
  }

  // Add narrative guidance
  if (reasoning.narrativeArc?.narrativeGuidance) {
    sections.push(`\n**Guidance:** ${reasoning.narrativeArc.narrativeGuidance}`);
  }

  // Add agency reminder
  sections.push('\n*Remember: these cards illuminate, they don\'t determine. Your choices shape what unfolds.*');

  return sections.join('\n');
}

// ============================================================================
// FULL READING BUILDER WITH REASONING
// ============================================================================

/**
 * Build a complete reading with reasoning chain integration
 *
 * This is the main integration function that wraps existing builders
 * and enhances their output with reasoning-aware elements.
 *
 * @param {Object} payload - Reading payload
 * @param {Function} baseBuilder - The base spread builder function
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Enhanced reading with reasoning metadata
 */
export async function buildReadingWithReasoning(payload, baseBuilder, options = {}) {
  const {
    cardsInfo,
    userQuestion,
    context,
    themes,
    spreadInfo
  } = payload;

  const spreadKey = spreadInfo?.key || 'general';

  // Step 1: Build reasoning chain
  const reasoning = buildReadingReasoning(
    cardsInfo,
    userQuestion,
    context,
    themes,
    spreadKey
  );

  // Step 2: Attach reasoning to payload for builder access
  const enhancedPayload = {
    ...payload,
    reasoning
  };

  // Step 3: Call base builder (if reasoning-aware, it will use the reasoning)
  const baseReading = await baseBuilder(enhancedPayload, {
    ...options,
    reasoning
  });

  // Step 4: If base reading is just a string, wrap it
  const reading = typeof baseReading === 'string'
    ? baseReading
    : baseReading.reading || baseReading;

  // Step 5: Return enhanced result
  return {
    reading,
    reasoning: {
      questionIntent: reasoning.questionIntent,
      narrativeArc: reasoning.narrativeArc,
      tensions: reasoning.tensions.slice(0, 3), // Top tensions only
      throughlines: reasoning.throughlines,
      pivotCard: reasoning.pivotCard ? {
        card: reasoning.pivotCard.card,
        position: reasoning.pivotCard.position,
        reason: reasoning.pivotCard.reason
      } : null,
      emotionalArc: reasoning.emotionalArc ? {
        start: reasoning.emotionalArc.start,
        end: reasoning.emotionalArc.end,
        direction: reasoning.emotionalArc.direction,
        summary: reasoning.emotionalArc.summary
      } : null
    },
    prompts: null,
    usage: null
  };
}

// ============================================================================
// REASONING CHAIN FORMATTER (for debugging/logging)
// ============================================================================

/**
 * Format reasoning chain as human-readable text
 *
 * @param {Object} reasoning - The reasoning chain
 * @returns {string} Formatted reasoning summary
 */
export function formatReasoningChain(reasoning) {
  if (!reasoning) return '[No reasoning chain]';

  const lines = ['=== REASONING CHAIN ===', ''];

  // Question intent
  lines.push(`QUESTION INTENT: ${reasoning.questionIntent?.type || 'unknown'}`);
  if (reasoning.questionIntent?.focus) {
    lines.push(`  Focus: ${reasoning.questionIntent.focus}`);
  }
  if (reasoning.questionIntent?.urgency) {
    lines.push(`  Urgency: ${reasoning.questionIntent.urgency}`);
  }
  lines.push('');

  // Narrative arc
  lines.push(`NARRATIVE ARC: ${reasoning.narrativeArc?.name || 'Unknown'}`);
  lines.push(`  ${reasoning.narrativeArc?.description || ''}`);
  lines.push(`  Emphasis: ${reasoning.narrativeArc?.emphasis || ''}`);
  lines.push('');

  // Tensions
  if (reasoning.tensions?.length > 0) {
    lines.push(`TENSIONS (${reasoning.tensions.length}):`);
    reasoning.tensions.slice(0, 3).forEach((t, i) => {
      lines.push(`  ${i + 1}. [${t.type}] ${t.cards.join(' ↔ ')}`);
      lines.push(`     ${t.description}`);
      if (t.isKeyTension) lines.push(`     ⭐ KEY TENSION`);
    });
    lines.push('');
  }

  // Pivot card
  if (reasoning.pivotCard) {
    lines.push(`PIVOT CARD: ${reasoning.pivotCard.card} in ${reasoning.pivotCard.position}`);
    lines.push(`  ${reasoning.pivotCard.reason}`);
    lines.push('');
  }

  // Emotional arc
  if (reasoning.emotionalArc) {
    lines.push(`EMOTIONAL ARC: ${reasoning.emotionalArc.start} → ${reasoning.emotionalArc.end}`);
    lines.push(`  Direction: ${reasoning.emotionalArc.direction}`);
    lines.push(`  ${reasoning.emotionalArc.summary || ''}`);
    lines.push('');
  }

  // Throughlines
  if (reasoning.throughlines?.length > 0) {
    lines.push('THROUGHLINES:');
    reasoning.throughlines.forEach(t => lines.push(`  - ${t}`));
    lines.push('');
  }

  // Emphasis map
  if (reasoning.emphasisMap?.length > 0) {
    const highEmphasis = reasoning.emphasisMap.filter(e => e.emphasis === 'high');
    if (highEmphasis.length > 0) {
      lines.push('HIGH EMPHASIS POSITIONS:');
      highEmphasis.forEach(e => {
        lines.push(`  - ${e.card} (${e.position}): ${e.reasons.join(', ')}`);
      });
      lines.push('');
    }
  }

  lines.push('=== END REASONING ===');
  return lines.join('\n');
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  buildReadingReasoning
} from './reasoning.js';
