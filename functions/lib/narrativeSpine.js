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
    keywords: ['stands', 'shows', 'reveals', 'manifests', 'appears', 'presents'],
    required: true
  },
  why: {
    name: 'Why/How (connector)',
    keywords: ['because', 'therefore', 'however', 'so that', 'this', 'since'],
    required: false // Optional for single-card sections
  },
  whatsNext: {
    name: "What's next",
    keywords: ['points toward', 'suggests', 'invites', 'calls for', 'trajectory', 'path'],
    required: false // Optional for past-focused positions
  }
};

/**
 * Check if a text section contains spine elements
 */
export function analyzeSpineCompleteness(text) {
  if (!text || typeof text !== 'string') {
    return {
      isComplete: false,
      missingElements: ['what', 'why', 'whatsNext'],
      suggestions: ['Add concrete description of the card/situation', 'Include causal connector', 'Provide forward-looking guidance']
    };
  }

  const lowerText = text.toLowerCase();
  const present = {};
  const missing = [];

  for (const [key, element] of Object.entries(SPINE_ELEMENTS)) {
    const hasElement = element.keywords.some(keyword => lowerText.includes(keyword));
    present[key] = hasElement;

    if (element.required && !hasElement) {
      missing.push(key);
    }
  }

  return {
    isComplete: missing.length === 0,
    present,
    missing,
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

  // If section is complete, return as-is
  if (analysis.isComplete) {
    return {
      text: section,
      validation: { ...analysis, enhanced: false }
    };
  }

  // Attempt to enhance missing elements
  let enhanced = section || '';
  const enhancements = [];

  // If missing "what", try to prepend basic card statement
  if (analysis.missing.includes('what') && metadata.cards) {
    const cardInfo = Array.isArray(metadata.cards) ? metadata.cards[0] : metadata.cards;
    if (cardInfo && cardInfo.card && cardInfo.position) {
      const orientation =
        typeof cardInfo.orientation === 'string' && cardInfo.orientation.trim()
          ? ` ${cardInfo.orientation}`
          : '';
      const whatStatement = `${cardInfo.position}: ${cardInfo.card}${orientation}.`;
      enhanced = `${whatStatement} ${enhanced}`.trim();
      enhancements.push('Added card identification');
    }
  }

  // If missing "why" and relationships exist, add causal connector
  if (analysis.missing.includes('why') && metadata.relationships && metadata.cards) {
    const cards = Array.isArray(metadata.cards) ? metadata.cards : [metadata.cards];
    if (cards.length >= 2 && metadata.relationships.elementalRelationship) {
      const whyStatement = buildWhyFromElemental(
        metadata.relationships.elementalRelationship,
        cards[0].card,
        cards[1].card
      );
      if (whyStatement) {
        enhanced += ` ${whyStatement}`;
        enhancements.push('Added causal connector');
      }
    }
  }

  // If missing "what's next" for forward-looking positions, add guidance prompt
  if (analysis.missing.includes('whatsNext') && metadata.type) {
    const forwardTypes = ['timeline', 'outcome', 'future', 'staff'];
    if (forwardTypes.includes(metadata.type.toLowerCase())) {
      const guidancePrompt = 'Consider what this trajectory invites you to do next.';
      enhanced += ` ${guidancePrompt}`;
      enhancements.push('Added forward-looking guidance');
    }
  }

  return {
    text: enhanced,
    validation: {
      ...analysis,
      enhanced: true,
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
  const sectionPattern = /\*\*([^*]+)\*\*/g;
  const sections = [];
  let match;
  let lastIndex = 0;

  while ((match = sectionPattern.exec(readingText)) !== null) {
    if (lastIndex > 0) {
      const prevHeader = sections[sections.length - 1].header;
      const content = readingText.substring(lastIndex, match.index).trim();
      sections[sections.length - 1].content = content;
    }

    sections.push({
      header: match[1],
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
