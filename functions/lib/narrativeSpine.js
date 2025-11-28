/**
 * Narrative Spine Helper
 *
 * Ensures each major reading section follows the story spine structure:
 * 1. WHAT is happening (situation/card)
 * 2. WHY it's happening (connector/cause)
 * 3. WHAT'S NEXT (trajectory/action)
 *
 * This helper validates and enriches narrative sections to maintain
 * flowing, causal storytelling throughout the reading.
 */

/**
 * Narrative spine structure for validation
 */
const SPINE_ELEMENTS = {
  what: {
    name: 'What is happening',
    required: true
  },
  why: {
    name: 'Why/How (connector)',
    required: false // Optional for single-card sections
  },
  whatsNext: {
    name: "What's next",
    required: false // Optional for past-focused positions
  }
};

const MIN_SENTENCE_WORDS = 5;
const CARD_HEADER_PATTERN = /^[\w\s]+[:\-–]/;
const MINOR_ARCANA_PATTERN = /\b(?:ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king)\s+of\s+(?:wands|cups|swords|pentacles)\b/i;
const MAJOR_ARCANA_NAMES = [
  'fool',
  'magician',
  'high priestess',
  'empress',
  'emperor',
  'hierophant',
  'lovers',
  'chariot',
  'strength',
  'hermit',
  'wheel of fortune',
  'justice',
  'hanged man',
  'death',
  'temperance',
  'devil',
  'tower',
  'star',
  'moon',
  'sun',
  'judgement',
  'judgment',
  'world'
];
const MAJOR_ARCANA_PATTERN = new RegExp(`\\b(?:the\\s+)?(?:${MAJOR_ARCANA_NAMES.join('|')})\\b`, 'i');
const CARD_CONTEXT_PATTERN = /\b(?:card|position|energy|situation|scene|story|thread|theme|anchor|nucleus|timeline|past|present|future|influence|lesson|moment|lens|reflection|reflections|synthesis|guidance|reminder|insight)\b/i;
const DESCRIPTIVE_VERB_PATTERN = /\b(?:is|are|feels|brings|ushers|marks|signals|casts|delivers|grounds|anchors|establishes|opens|presents|reveals|shows|illustrates|demonstrates|highlights|frames|illuminates|expresses|focuses|rests|sits|holds|carries|offers|spotlights|reminds|echoes|emerges|unfolds)\b/i;
const WHY_PATTERNS = [
  /\b(?:because|since|due to|thanks to|as a result|resulting in|which is why|which means)\b/i,
  /\b(?:therefore|thus|hence|so that|so you can|so you might)\b/i,
  /\b(?:stems from|rooted in|comes from|arises from|emerges from)\b/i,
  /\b(?:leads to|creates|sparks|requires|demands)\b/i,
  /,\s*(?:which|that)\s+(?:allows|invites|pushes|nudges|lets)\b/i,
  /\bin turn\b/i
];
const WHATS_NEXT_PATTERNS = [
  /\b(?:what's next|next|future|going forward|the road ahead|ahead|from here|on the horizon)\b/i,
  /\b(?:consider|choose|decide|prepare|plan|commit|focus|lean|move|step)\s+(?:to|into|toward|forward|next)\b/i,
  /\b(?:invites|encourages|calls|asks|urges|prompts|guides)\b/i,
  /\b(?:guidance|advice|trajectory|path|action|step|practice)\b/i,
  /\b(?:you can|you might|you could)\s+(?:now|next|begin|take|start)\b/i
];

function segmentSentences(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function hasCardReference(text) {
  if (!text) return false;
  return MINOR_ARCANA_PATTERN.test(text) || MAJOR_ARCANA_PATTERN.test(text);
}

function detectWhatClause(text, sentences) {
  if (!text) return false;
  if (hasCardReference(text)) return true;
  if (sentences.some(sentence => CARD_HEADER_PATTERN.test(sentence))) {
    return true;
  }

  return sentences.some(sentence => {
    const trimmed = sentence.trim();
    if (!trimmed) return false;
    if (trimmed.split(/\s+/).length < MIN_SENTENCE_WORDS) return false;
    return CARD_CONTEXT_PATTERN.test(trimmed) && DESCRIPTIVE_VERB_PATTERN.test(trimmed);
  });
}

function detectWhyClause(text) {
  if (!text) return false;
  return WHY_PATTERNS.some(pattern => pattern.test(text));
}

function detectWhatsNextClause(text) {
  if (!text) return false;
  return WHATS_NEXT_PATTERNS.some(pattern => pattern.test(text));
}

function resolveHint(spineHints = {}, key, detector) {
  if (Object.prototype.hasOwnProperty.call(spineHints, key) && typeof spineHints[key] === 'boolean') {
    return spineHints[key];
  }
  return detector();
}

function detectSpineElements(text, spineHints = {}) {
  const safeText = typeof text === 'string' ? text : '';
  const sentences = segmentSentences(safeText);

  const what = resolveHint(spineHints, 'what', () => detectWhatClause(safeText, sentences));
  const why = resolveHint(spineHints, 'why', () => detectWhyClause(safeText));
  const whatsNext = resolveHint(spineHints, 'whatsNext', () => detectWhatsNextClause(safeText));

  return { what, why, whatsNext };
}

/**
 * Check if a text section contains spine elements
 *
 * @param {string} text - Narrative paragraph to evaluate
 * @param {Object} [options] - Optional detection overrides
 * @param {Object} [options.spineHints] - Explicit hints { what, why, whatsNext }
 */
export function analyzeSpineCompleteness(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      isComplete: false,
      missingElements: ['what', 'why', 'whatsNext'],
      missing: ['what', 'why', 'whatsNext'],
      missingRequired: ['what'],
      present: { what: false, why: false, whatsNext: false },
      suggestions: ['Add concrete description of the card/situation', 'Include causal connector', 'Provide forward-looking guidance']
    };
  }

  const { spineHints } = options;
  const present = detectSpineElements(text, spineHints);
  const missing = [];
  const missingRequired = [];

  for (const [key, element] of Object.entries(SPINE_ELEMENTS)) {
    if (!present[key]) {
      missing.push(key);
      if (element.required) {
        missingRequired.push(key);
      }
    }
  }

  return {
    isComplete: missingRequired.length === 0,
    present,
    missing,
    missingRequired,
    suggestions: missing.map(key => `Consider adding: ${SPINE_ELEMENTS[key].name}`)
  };
}

/**
 * Build a narrative paragraph following the spine structure
 *
 * @param {Object} components - The narrative components
 * @param {string} components.what - What is happening (required)
 * @param {string} components.why - Why/how this happened (optional)
 * @param {string} components.whatsNext - What's next/guidance (optional)
 * @param {string} components.connector - Connector phrase to previous section (optional)
 * @returns {string} Fully formed narrative paragraph
 */
export function buildSpineParagraph({ what, why, whatsNext, connector = '' }) {
  if (!what) {
    throw new Error('Narrative spine requires "what" (the situation description)');
  }

  const parts = [];

  // Add connector if provided
  if (connector) {
    parts.push(connector);
  }

  // Always include WHAT
  parts.push(what);

  // Add WHY if provided (causal connection)
  if (why) {
    parts.push(why);
  }

  // Add WHAT'S NEXT if provided (trajectory/guidance)
  if (whatsNext) {
    parts.push(whatsNext);
  }

  return parts.join(' ');
}

/**
 * Generate "why" connector based on elemental relationship
 */
export function buildWhyFromElemental(elementalRelationship, card1Name, card2Name) {
  if (!elementalRelationship || !elementalRelationship.relationship) {
    return null;
  }

  const safeCard1 = card1Name || 'the first card';
  const safeCard2 = card2Name || 'the second card';
  const { relationship } = elementalRelationship;

  const templates = {
    supportive: `Because ${safeCard1} supports and harmonizes with ${safeCard2}, these energies flow together constructively.`,
    tension: `However, ${safeCard1} creates friction with ${safeCard2}, requiring skillful navigation to integrate both.`,
    amplified: `Because both energies share the same elemental quality, ${safeCard1} and ${safeCard2} intensify this theme significantly.`,
    neutral: `${safeCard1} and ${safeCard2} work together with subtle complexity.`
  };

  return templates[relationship] || templates.neutral;
}

/**
 * Validate and enhance a reading section with spine structure
 *
 * @param {string} section - Raw section text
 * @param {Object} metadata - Section metadata
 * @param {string} metadata.type - Section type (nucleus, timeline, staff, etc.)
 * @param {Object} metadata.cards - Card information
 * @param {Object} metadata.relationships - Elemental/position relationships
 * @returns {Object} Enhanced section with spine validation
 */
export function enhanceSection(section, metadata = {}) {
  const analysis = analyzeSpineCompleteness(section);
  const missingKeys = Array.isArray(analysis.missing)
    ? analysis.missing
    : Array.isArray(analysis.missingElements)
      ? analysis.missingElements
      : [];

  if (missingKeys.length === 0) {
    return {
      text: section,
      validation: { ...analysis, enhanced: false }
    };
  }

  let enhanced = section || '';
  const enhancements = [];
  let detection = analysis.present || detectSpineElements(enhanced);

  const cards = Array.isArray(metadata.cards)
    ? metadata.cards
    : metadata.cards
      ? [metadata.cards]
      : [];

  // Ensure WHAT is anchored by card identification
  if (!detection.what && cards.length > 0) {
    const cardInfo = cards[0];
    if (cardInfo && cardInfo.card && cardInfo.position) {
      const orientation =
        typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
          ? ` ${cardInfo.orientation}`
          : '';
      const whatStatement = `${cardInfo.position}: ${cardInfo.card}${orientation}.`;
      enhanced = `${whatStatement} ${enhanced}`.trim();
      enhancements.push('Added card identification');
      detection = detectSpineElements(enhanced);
    }
  }

  // Add WHY connector only when it is still missing
  if (!detection.why && cards.length >= 2 && metadata.relationships?.elementalRelationship) {
    const whyStatement = buildWhyFromElemental(
      metadata.relationships.elementalRelationship,
      cards[0].card,
      cards[1].card
    );
    if (whyStatement) {
      enhanced = enhanced ? `${enhanced} ${whyStatement}` : whyStatement;
      enhancements.push('Added causal connector');
      detection = detectSpineElements(enhanced);
    }
  }

  // Add WHAT'S NEXT guidance for forward-looking sections
  if (!detection.whatsNext && typeof metadata.type === 'string') {
    const forwardTypes = ['timeline', 'outcome', 'future', 'staff'];
    if (forwardTypes.includes(metadata.type.toLowerCase())) {
      const guidancePrompt = 'Consider what this trajectory invites you to do next.';
      enhanced = enhanced ? `${enhanced} ${guidancePrompt}` : guidancePrompt;
      enhancements.push('Added forward-looking guidance');
      detection = detectSpineElements(enhanced);
    }
  }

  const updatedAnalysis = analyzeSpineCompleteness(enhanced);
  const didEnhance = enhancements.length > 0;

  return {
    text: enhanced,
    validation: {
      ...updatedAnalysis,
      enhanced: didEnhance,
      enhancements
    }
  };
}

/**
 * Validate complete reading narrative
 * Checks that all major sections follow spine principles
 */
export function validateReadingNarrative(readingText) {
  if (!readingText || typeof readingText !== 'string') {
    return {
      isValid: false,
      errors: ['Reading text is empty or invalid']
    };
  }

  // Split by major section headers
  // Match: ### Markdown headers OR **Bold text at start of line** (not inline bold)
  const sectionPattern = /(^[ \t]*\*\*([^*]+)\*\*[ \t]*$)|(^#{2,6}\s+(.+)$)/gm;
  const sections = [];
  let match;
  let lastIndex = 0;

  while ((match = sectionPattern.exec(readingText)) !== null) {
    const header = (match[2] || match[4] || '').trim();
    if (!header) {
      lastIndex = sectionPattern.lastIndex;
      continue;
    }

    if (sections.length > 0) {
      const content = readingText.substring(lastIndex, match.index).trim();
      sections[sections.length - 1].content = content;
    }

    sections.push({
      header,
      start: match.index,
      content: ''
    });

    lastIndex = sectionPattern.lastIndex;
  }

  // Capture last section
  if (sections.length > 0) {
    sections[sections.length - 1].content = readingText.substring(lastIndex).trim();
  }

  // Analyze each section
  const analyses = sections.map(section => ({
    header: section.header,
    analysis: analyzeSpineCompleteness(section.content)
  }));

  const incompleteCount = analyses.filter(a => !a.analysis.isComplete).length;

  return {
    isValid: incompleteCount === 0,
    totalSections: sections.length,
    completeSections: sections.length - incompleteCount,
    incompleteSections: incompleteCount,
    sectionAnalyses: analyses,
    suggestions: incompleteCount > 0
      ? ["Review incomplete sections and ensure they include: what is happening, why/how (connector), and what's next"]
      : []
  };
}

/**
 * Build a multi-card narrative flow with spine structure
 * Useful for timeline, staff, or any sequential card sections
 */
export function buildFlowNarrative(cards, relationships, options = {}) {
  if (!cards || cards.length === 0) {
    return '';
  }

  const { includeSynthesis = true, connector: initialConnector = '' } = options;

  const paragraphs = [];

  cards.forEach((card, index) => {
    const isFirst = index === 0;
    const isLast = index === cards.length - 1;

    // Get relationship to previous card
    const prevRelationship = index > 0 && relationships && relationships[index - 1]
      ? relationships[index - 1]
      : null;

    // Build WHAT
    const what = `${card.position}: ${card.card} ${card.orientation}. ${card.meaning}`;

    // Build WHY (from elemental relationship)
    let why = null;
    if (prevRelationship && prevRelationship.elementalRelationship && cards[index - 1]) {
      why = buildWhyFromElemental(
        prevRelationship.elementalRelationship,
        cards[index - 1].card,
        card.card
      );
    }

    // Build WHAT'S NEXT (only for last card or specific positions)
    let whatsNext = null;
    if (isLast && includeSynthesis) {
      whatsNext = 'This trajectory invites conscious choice in how you proceed.';
    }

    // Determine connector
    let connector = isFirst ? initialConnector : '';
    if (!isFirst && prevRelationship) {
      const rel = prevRelationship.elementalRelationship?.relationship;
      if (rel === 'supportive') connector = 'Building on this,';
      else if (rel === 'tension') connector = 'However,';
      else if (rel === 'amplified') connector = 'Intensifying further,';
    }

    const paragraph = buildSpineParagraph({ what, why, whatsNext, connector });
    paragraphs.push(paragraph);
  });

  return paragraphs.join('\n\n');
}
