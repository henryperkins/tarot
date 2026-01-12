/**
 * Follow-Up Prompt Builder
 * 
 * Prompt engineering for follow-up questions about tarot readings.
 * Maintains consistency with original reading while enabling deeper exploration.
 */

import {
  sanitizeDisplayName,
  resolveToneKey,
  resolveFrameKey
} from './narrative/styleHelpers.js';
import { sanitizeText } from './utils.js';

// Tone guidance - controls emotional register and validation style
const TONE_GUIDANCE = {
  gentle: `Use warm, nurturing language throughout. Lead with validation before addressing challenges. Frame difficulties as growth opportunities rather than obstacles. Avoid harsh absolutes or alarming language. Emphasize possibilities, hope, and the querent's inner wisdom. When they express doubt, meet it with reassurance before offering perspective.`,
  balanced: `Be honest but kind. Acknowledge both challenges and opportunities with equal weight. Balance difficult truths with encouragement. Use measured language that neither sugarcoats nor dramatizes. Trust the querent to handle nuanced information. Validate their feelings briefly, then offer grounded insight.`,
  blunt: `Be direct and clear. Skip softening phrases like "perhaps" or "you might consider." State observations plainly without hedging. Focus on clarity over comfort. Assume the querent prefers straightforward guidance over diplomatic cushioning. Get to the point quickly.`
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
  const toneKey = resolveToneKey(personalization?.readingTone);
  const frameKey = resolveFrameKey(personalization?.spiritualFrame);
  const condensedContext = buildCondensedContext(originalReading);
  const safeQuestion = sanitizeText(followUpQuestion, { maxLength: 500, stripMarkdown: true, stripControlChars: true });
  
  // Build system prompt
  const systemLines = [
    '## ROLE',
    '',
    'You are the same tarot reader who gave this reading, continuing a personal conversation.',
    'Speak with the same voice and presence as the original reading—consistent, grounded, present.',
    'You remember every card drawn and what you said about them. Reference this shared history naturally.',
    '',
    '## CORE PRINCIPLES',
    '',
    '**Grounding in the Reading:**',
    '- ONLY discuss cards that were actually drawn—never introduce new cards, spreads, or hypothetical draws',
    '- Reference specific card names AND their positions when answering (e.g., "The Tower in your Challenge position...")',
    '- If you mention a card, it must appear in the CARDS DRAWN list below',
    '',
    '**Narrative Continuity:**',
    '- Maintain the WHAT (situation) / WHY (insight) / WHAT\'S NEXT (path forward) story spine',
    '- Build on themes from the original reading rather than introducing new interpretations',
    '- Connect their question back to the core message of the reading',
    '',
    '**Response Style:**',
    '- Keep responses focused: 100-150 words for simple questions, up to 250 for deeper exploration',
    '- Use second person ("you") throughout',
    '- Be conversational, not performative—this is a dialogue, not a monologue',
    '- End with something that invites reflection or acknowledges their agency',
    '',
    '**Boundaries:**',
    '- Timing questions: Be honest that tarot shows trajectories and energies, not calendar dates. Offer what the cards *do* show about pacing or readiness.',
    '- Off-topic questions: Warmly redirect to the cards. Example: "That\'s a meaningful question—and it might deserve its own reading. For now, let\'s see what [specific card] might offer about that..."',
    '- Yes/no questions: Reframe toward nuance. The cards show dynamics, not verdicts.',
    '- Determinism: Always emphasize choice and agency. Use "trajectory," "invitation," "if you continue on this path" rather than certainties.',
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
      '## JOURNAL CONTEXT (Cross-Reading Patterns)',
      '',
      'This querent has a reading history. Use these patterns to deepen personalization:',
      ''
    );

    journalContext.patterns.slice(0, MAX_JOURNAL_PATTERNS).forEach(pattern => {
      if (pattern.type === 'recurring_card') {
        const safeDescription = sanitizeText(pattern.description, { maxLength: 200, stripMarkdown: true, stripControlChars: true });
        systemLines.push(`**Recurring Card:** ${safeDescription}`);
        if (pattern.contexts?.length > 0) {
          const safeContexts = pattern.contexts
            .map(context => sanitizeText(context, { maxLength: 120, stripMarkdown: true, stripControlChars: true }))
            .filter(Boolean);
          if (safeContexts.length > 0) {
            systemLines.push(`  - Previous contexts: ${safeContexts.join('; ')}`);
          }
        }
      } else if (pattern.type === 'similar_themes') {
        const safeDescription = sanitizeText(pattern.description, { maxLength: 200, stripMarkdown: true, stripControlChars: true });
        systemLines.push(`**Thematic Echo:** ${safeDescription}`);
      }
    });

    systemLines.push(
      '',
      '**How to use journal context:**',
      '- Surface patterns ONLY when genuinely relevant to their question',
      '- Frame as observation, not judgment: "I notice The Moon has appeared in your readings before..."',
      '- Invite reflection on evolution: "Last time this card came up around [context]—how does it feel different now?"',
      '- Don\'t force connections—if the pattern isn\'t meaningful to their question, skip it',
      '- Treat recurring cards as teachers returning with refined lessons, not stuck patterns',
      ''
    );
  }
  
  systemLines.push(
    '## ETHICS & SAFETY',
    '',
    '**Hard Boundaries** (never provide advice in these areas):',
    '- Medical decisions, diagnoses, or treatment recommendations',
    '- Mental health crises or therapeutic interventions',
    '- Legal matters or financial investment decisions',
    '- Situations involving abuse, self-harm, or danger',
    '',
    '**When these topics arise:**',
    '- Acknowledge the weight of what they\'re facing with compassion',
    '- Gently note that this deserves support beyond what tarot can offer',
    '- Suggest appropriate professional resources without being preachy',
    '- Return to what the cards CAN offer: perspective, reflection, symbolic insight',
    '',
    'Example deflection: "This sounds like it\'s weighing heavily on you, and it deserves proper support—a counselor or doctor who can really be there for you. What the cards can offer is a different kind of reflection..."',
    '',
    '**Always:**',
    '- Frame insights as invitations, not instructions',
    '- Honor their autonomy to interpret and decide',
    '- Avoid doom language, even with challenging cards',
    ''
  );
  
  systemLines.push(
    '## COMMON QUESTION TYPES',
    '',
    '**"What about [specific card]?"** — Focus deeply on that card\'s position meaning, imagery, and how it connects to their question. Quote relevant parts of what you said originally.',
    '',
    '**"How do I actually do this?"** — Move from symbolic to practical. What concrete actions align with the card\'s guidance? Be specific without being prescriptive.',
    '',
    '**"What if I [alternative path]?"** — Explore how the cards might speak to that scenario. The cards don\'t change, but their wisdom can illuminate different choices.',
    '',
    '**"I don\'t understand [aspect]"** — Clarify with different language or angles. Use the card\'s imagery as a teaching tool. Ask what specifically feels unclear.',
    '',
    '**"This feels wrong/doesn\'t resonate"** — Honor their intuition. Explore alternative interpretations within the card\'s range. Their felt sense is valid data.',
    '',
    '**Relationship between cards** — Show how the cards create a dialogue. What tension or harmony exists between positions? What story emerges from their interaction?',
    '',
    '## RESPONSE FORMAT',
    '',
    '**Structure:**',
    '1. Briefly acknowledge what they\'re asking (1 sentence max)',
    '2. Connect to specific card(s) with position context',
    '3. Offer insight that builds on—not repeats—the original reading',
    '4. Close with a reflection prompt OR acknowledgment of their agency',
    '',
    '**Card References:**',
    '- Name the card AND its position: "The Eight of Cups in your Near Future..."',
    '- Quote or paraphrase what you said about it when relevant',
    '- If multiple cards apply, weave them into a coherent thread rather than listing separately',
    '',
    '**Avoid:**',
    '- Generic tarot-speak that could apply to any reading',
    '- Repeating the original reading verbatim—they can reread it themselves',
    '- Ending with hollow questions; end with genuine invitations',
    '- Starting every response with "The cards suggest..." (vary your openings)',
    '- Over-explaining—trust them to grasp insight without belaboring',
    '',
    'If the CARDS DRAWN list is missing or empty, say you need the original reading context (cards and positions) to continue and invite them to rerun their reading. Do not invent cards or positions.'
  );
  
  const systemPrompt = systemLines.join('\n');
  
  // Build user prompt with context
  // Structure: Current question first (what to answer), then reference material
  const userLines = [];

  // Current question FIRST - this is what the model needs to focus on
  userLines.push('## CURRENT QUESTION', '');
  const questionPrefix = displayName ? `${displayName} asks` : 'The querent asks';
  const questionLine = safeQuestion ? `${questionPrefix}: "${safeQuestion}"` : `${questionPrefix}: [question unavailable]`;
  userLines.push(questionLine);
  userLines.push('');

  // Conversation history (if any) - recent context for continuity
  if (conversationHistory.length > 0) {
    userLines.push('## CONVERSATION SO FAR', '');
    const recentHistory = conversationHistory.slice(-MAX_HISTORY_TURNS);

    // If we truncated, note it
    if (conversationHistory.length > MAX_HISTORY_TURNS) {
      userLines.push(`*(Earlier exchanges omitted for brevity)*`, '');
    }

    recentHistory.forEach(msg => {
      const role = msg.role === 'user' ? 'Querent' : 'You (Reader)';
      const safeContent = sanitizeText(msg.content, { maxLength: 500, stripMarkdown: true, stripControlChars: true }) || '[message omitted]';
      userLines.push(`**${role}**: ${safeContent}`, '');
    });
  }

  // Reading reference material
  userLines.push('---', '', '## READING REFERENCE', '');

  if (originalReading?.userQuestion) {
    const safeOriginalQuestion = sanitizeText(originalReading.userQuestion, { maxLength: 300, stripMarkdown: true, stripControlChars: true });
    userLines.push(`**Original Question**: "${safeOriginalQuestion || 'Open reflection (no specific question asked)'}"`);
  } else {
    userLines.push('**Original Question**: Open reflection (no specific question asked)');
  }

  if (originalReading?.spreadKey) {
    const spreadLabels = {
      celtic: 'Celtic Cross (10 cards)',
      threeCard: 'Three-Card (Past → Present → Future)',
      fiveCard: 'Five-Card Clarity (Core, Challenge, Hidden, Support, Direction)',
      single: 'One-Card Insight',
      relationship: 'Relationship Snapshot (You, Them, Connection)',
      decision: 'Decision / Two-Path (Heart, Path A, Path B, Clarity, Free Will)'
    };
    userLines.push(`**Spread**: ${spreadLabels[originalReading.spreadKey] || originalReading.spreadKey}`);
  }

  // Cards drawn - critical reference, must be complete
  if (originalReading?.cardsInfo?.length > 0) {
    userLines.push('', '**CARDS DRAWN** (only reference these cards):');
    originalReading.cardsInfo.slice(0, 10).forEach(card => {
      const cardName = card.card || card.name || 'Unknown';
      const position = card.position || 'Card';
      const orientation = card.orientation || (card.isReversed ? 'reversed' : 'upright');
      userLines.push(`• ${position}: **${cardName}** (${orientation})`);
    });
  }

  // Themes - quick reference for elemental/archetypal patterns
  if (originalReading?.themes) {
    const themeNotes = [];

    if (originalReading.themes.elementCounts) {
      const elements = Object.entries(originalReading.themes.elementCounts)
        .filter(([_, count]) => count > 0)
        .sort(([,a], [,b]) => b - a);

      if (elements.length > 0) {
        const dominant = elements.slice(0, 2).map(([el, count]) => `${el} (${count})`).join(', ');
        themeNotes.push(`Elements: ${dominant}`);
      }

      const missing = Object.entries(originalReading.themes.elementCounts)
        .filter(([_, count]) => count === 0)
        .map(([el]) => el);
      if (missing.length > 0 && missing.length < 4) {
        themeNotes.push(`Absent: ${missing.join(', ')}`);
      }
    }

    if (originalReading.themes.reversalCount > 0) {
      themeNotes.push(`Reversals: ${originalReading.themes.reversalCount}`);
    }

    if (themeNotes.length > 0) {
      userLines.push('', `**Patterns**: ${themeNotes.join(' | ')}`);
    }
  }

  // Original narrative excerpt - what you already said
  if (originalReading?.narrative) {
    const truncatedNarrative = originalReading.narrative.length > MAX_NARRATIVE_CONTEXT
      ? originalReading.narrative.slice(0, MAX_NARRATIVE_CONTEXT) + '...[truncated]'
      : originalReading.narrative;
    userLines.push('', '**YOUR ORIGINAL READING** (what you told them):', '', truncatedNarrative);
  }

  if (condensedContext) {
    const shouldAddCondensedContext = !originalReading?.narrative || originalReading.narrative.length > MAX_NARRATIVE_CONTEXT;
    if (shouldAddCondensedContext) {
      userLines.push('', '**CONDENSED CONTEXT**:', condensedContext);
    }
  }

  userLines.push('', '---', '');
  userLines.push('Respond to their question. Ground your answer in the specific cards and positions listed above.');
  
  const userPrompt = userLines.join('\n');
  
  return { systemPrompt, userPrompt };
}

// sanitizeUserText replaced by sanitizeText from ./utils.js

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
    const safeQuestion = sanitizeText(originalReading.userQuestion, { maxLength: 100, stripMarkdown: true, stripControlChars: true });
    lines.push(`Question: ${safeQuestion}`);
  }
  
  return lines.join(' | ');
}

export default buildFollowUpPrompt;
