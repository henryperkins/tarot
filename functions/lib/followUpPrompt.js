/**
 * Follow-Up Prompt Builder
 * 
 * Prompt engineering for follow-up questions about tarot readings.
 * Maintains consistency with original reading while enabling deeper exploration.
 */

import { sanitizeDisplayName } from './narrative/styleHelpers.js';

// Import tone and frame guidance from the narrative prompts system
const TONE_GUIDANCE = {
  gentle: `Use warm, nurturing language throughout. Lead with validation before addressing challenges. Frame difficulties as growth opportunities rather than obstacles. Avoid harsh absolutes or alarming language. Emphasize possibilities, hope, and the querent's inner wisdom.`,
  balanced: `Be honest but kind. Acknowledge both challenges and opportunities with equal weight. Balance difficult truths with encouragement. Use measured language that neither sugarcoats nor dramatizes. Trust the querent to handle nuanced information.`,
  blunt: `Be direct and clear. Skip softening phrases like "perhaps" or "you might consider." State observations plainly without hedging. Focus on clarity over comfort. Assume the querent prefers straightforward guidance over diplomatic cushioning.`
};

const FRAME_GUIDANCE = {
  psychological: `Interpret through Jungian archetypes, shadow work, and behavioral patterns. Use language of the psyche: projection, integration, individuation. Ground insights in observable patterns and personal development frameworks.`,
  spiritual: `Embrace intuitive, mystical language. Reference cosmic cycles, soul contracts, and energetic resonance. Honor the sacred dimension of the reading. Use terms like "spirit guides," "higher self," and "universal wisdom" where appropriate.`,
  mixed: `Blend psychological insight with spiritual symbolism naturally. Move fluidly between archetypal psychology and mystical language based on what serves each card's message. This is the default approach when no preference is specified.`,
  playful: `Keep it light, fun, and exploratory. Use humor where appropriate. Frame the reading as a curious adventure rather than a solemn ritual. Avoid heavy language even for challenging cards. Maintain wonder and levity throughout.`
};

const MAX_NARRATIVE_CONTEXT = 1500;  // Characters to include from original
const MAX_HISTORY_TURNS = 5;         // Max conversation turns to include
const MAX_JOURNAL_PATTERNS = 3;      // Max journal patterns to include

/**
 * Build prompts for follow-up question responses
 * 
 * @param {Object} options
 * @param {Object} options.originalReading - Original reading context
 * @param {string} options.followUpQuestion - User's follow-up question
 * @param {Array} options.conversationHistory - Previous follow-up exchanges
 * @param {Object} options.journalContext - Optional journal patterns/similar entries
 * @param {Object} options.personalization - User preferences (tone, frame, name)
 * @returns {{ systemPrompt: string, userPrompt: string }}
 */
export function buildFollowUpPrompt({
  originalReading,
  followUpQuestion,
  conversationHistory = [],
  journalContext = null,
  personalization = null
}) {
  const displayName = sanitizeDisplayName(personalization?.displayName);
  const toneKey = personalization?.readingTone || 'balanced';
  const frameKey = personalization?.spiritualFrame || 'mixed';
  
  // Build system prompt
  const systemLines = [
    'You are a thoughtful tarot reader continuing a conversation about a reading you have given.',
    '',
    '## CORE PRINCIPLES',
    '',
    '- Stay grounded in the cards already drawn—do not introduce new cards or spreads',
    '- Reference specific card names and positions when answering',
    '- Maintain the WHAT/WHY/WHAT\'S NEXT story spine from the original reading',
    '- Keep responses focused and under 200 words unless depth is explicitly requested',
    '- Use second person ("you") and maintain the same warm, supportive tone',
    '- If asked about timing, be honest that tarot offers trajectories, not specific dates',
    '- If the question strays from the reading\'s scope, gently redirect to the cards drawn',
    '- Emphasize choice, agency, and trajectory language; avoid deterministic guarantees',
    ''
  ];
  
  // Add tone guidance
  if (TONE_GUIDANCE[toneKey]) {
    systemLines.push('## TONE', '', TONE_GUIDANCE[toneKey], '');
  }
  
  // Add frame guidance
  if (FRAME_GUIDANCE[frameKey]) {
    systemLines.push('## INTERPRETIVE FRAME', '', FRAME_GUIDANCE[frameKey], '');
  }
  
  // Add journal context instructions if present
  if (journalContext?.patterns?.length > 0) {
    systemLines.push(
      '## JOURNAL CONTEXT',
      '',
      'The querent has a history of readings. Use this context to provide deeper, more personalized insight:',
      ''
    );
    
    journalContext.patterns.slice(0, MAX_JOURNAL_PATTERNS).forEach(pattern => {
      if (pattern.type === 'recurring_card') {
        systemLines.push(`- ${pattern.description}`);
        if (pattern.contexts?.length > 0) {
          systemLines.push(`  Previous contexts: ${pattern.contexts.join(', ')}`);
        }
      } else if (pattern.type === 'similar_themes') {
        systemLines.push(`- ${pattern.description}`);
      }
    });
    
    systemLines.push(
      '',
      'When referencing past readings:',
      '- Frame connections gently ("This theme has come up before...")',
      '- Highlight growth or evolution in patterns',
      '- Ask reflective questions about past guidance ("How did X unfold for you?")',
      ''
    );
  }
  
  systemLines.push(
    '## ETHICS',
    '',
    '- Do not provide medical, mental health, legal, financial, or abuse-safety directives',
    '- When restricted themes surface, gently suggest consulting qualified professionals',
    '- Emphasize choice and agency; avoid deterministic language',
    ''
  );
  
  systemLines.push(
    '## RESPONSE FORMAT',
    '',
    '- Keep responses conversational and focused',
    '- Reference the specific card(s) relevant to the question',
    '- If multiple cards relate, weave them together coherently',
    '- End with an invitation for further reflection or action',
    ''
  );
  
  const systemPrompt = systemLines.join('\n');
  
  // Build user prompt with context
  const userLines = [];
  
  // Original reading context
  userLines.push('## ORIGINAL READING CONTEXT', '');
  
  if (originalReading?.userQuestion) {
    userLines.push(`**Original Question**: ${truncateText(originalReading.userQuestion, 300)}`);
  } else {
    userLines.push('**Original Question**: Open reflection (no specific question)');
  }
  
  if (originalReading?.spreadKey) {
    const spreadLabels = {
      celtic: 'Celtic Cross (10 cards)',
      threeCard: 'Three-Card (Past/Present/Future)',
      fiveCard: 'Five-Card Clarity',
      single: 'One-Card Insight',
      relationship: 'Relationship Snapshot',
      decision: 'Decision / Two-Path'
    };
    userLines.push(`**Spread**: ${spreadLabels[originalReading.spreadKey] || originalReading.spreadKey}`);
  }
  
  if (originalReading?.cardsInfo?.length > 0) {
    userLines.push('', '**Cards Drawn**:');
    originalReading.cardsInfo.slice(0, 10).forEach(card => {
      const cardName = card.card || card.name || 'Unknown';
      const position = card.position || 'Card';
      const orientation = card.orientation || (card.isReversed ? 'reversed' : 'upright');
      userLines.push(`- ${position}: ${cardName} (${orientation})`);
    });
  }
  
  if (originalReading?.narrative) {
    const truncatedNarrative = originalReading.narrative.length > MAX_NARRATIVE_CONTEXT
      ? originalReading.narrative.slice(0, MAX_NARRATIVE_CONTEXT) + '...[truncated]'
      : originalReading.narrative;
    userLines.push('', '**Original Reading Excerpt**:', '', truncatedNarrative);
  }
  
  userLines.push('');
  
  // Themes context (elemental, archetypal)
  if (originalReading?.themes) {
    const themeNotes = [];
    
    if (originalReading.themes.elementCounts) {
      const dominant = Object.entries(originalReading.themes.elementCounts)
        .filter(([_, count]) => count > 0)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2)
        .map(([el, count]) => `${el} (${count})`)
        .join(', ');
      if (dominant) {
        themeNotes.push(`Dominant elements: ${dominant}`);
      }
    }
    
    if (originalReading.themes.reversalCount > 0) {
      themeNotes.push(`Reversed cards: ${originalReading.themes.reversalCount}`);
    }
    
    if (themeNotes.length > 0) {
      userLines.push('**Reading Themes**:', ...themeNotes.map(n => `- ${n}`), '');
    }
  }
  
  // Conversation history
  if (conversationHistory.length > 0) {
    userLines.push('## CONVERSATION SO FAR', '');
    conversationHistory.slice(-MAX_HISTORY_TURNS).forEach(msg => {
      const role = msg.role === 'user' ? 'Querent' : 'Reader';
      userLines.push(`**${role}**: ${truncateText(msg.content, 500)}`, '');
    });
  }
  
  // Current question
  userLines.push('## CURRENT QUESTION', '');
  
  const questionPrefix = displayName ? `${displayName} asks` : 'The querent asks';
  userLines.push(`${questionPrefix}: "${followUpQuestion}"`);
  
  userLines.push('', '---', '');
  userLines.push('Please respond to this follow-up question, staying grounded in the original reading context.');
  
  const userPrompt = userLines.join('\n');
  
  return { systemPrompt, userPrompt };
}

/**
 * Truncate text to a maximum length, preserving word boundaries
 */
function truncateText(text, maxLength) {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.7) {
    return truncated.slice(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Build a condensed context summary for token-constrained scenarios
 */
export function buildCondensedContext(originalReading) {
  if (!originalReading) return '';
  
  const lines = [];
  
  if (originalReading.cardsInfo?.length > 0) {
    const cardSummary = originalReading.cardsInfo
      .slice(0, 5)
      .map(c => {
        const name = c.card || c.name || '?';
        const pos = c.position || '';
        const rev = c.isReversed || c.orientation === 'reversed' ? '(R)' : '';
        return pos ? `${pos}: ${name}${rev}` : `${name}${rev}`;
      })
      .join('; ');
    lines.push(`Cards: ${cardSummary}`);
  }
  
  if (originalReading.userQuestion) {
    lines.push(`Question: ${truncateText(originalReading.userQuestion, 100)}`);
  }
  
  return lines.join(' | ');
}

export default buildFollowUpPrompt;
