/**
 * Formatting Utilities for Tarot Readings
 *
 * Normalizes Markdown-formatted readings into human-readable plain text
 * for both UI display and TTS narration, maintaining the "human storyteller"
 * tone while avoiding "asterisk asterisk" and rigid headings.
 */

/**
 * Normalize reading text by stripping or softening Markdown markers
 *
 * This creates a gentle, conversational reading experience by:
 * - Removing bold/italic markers (**, *, _)
 * - Converting headings to natural section breaks
 * - Preserving paragraph structure
 * - Collapsing excessive whitespace
 *
 * @param {string} markdown - Raw Markdown reading text
 * @returns {string} Normalized plain text
 */
export function normalizeReadingText(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  return markdown
    // Remove bold markers (** or __)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')

    // Remove italic markers (* or _)
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')

    // Remove inline code markers (`)
    .replace(/`([^`]+)`/g, '$1')

    // Remove strikethrough markers (~~)
    .replace(/~~(.*?)~~/g, '$1')

    // Convert headings to natural section breaks
    // H1 (# ) -> Double line break + text
    .replace(/^#\s+(.+)$/gm, '\n\n$1\n')

    // H2 (## ) -> Double line break + text
    .replace(/^#{2}\s+(.+)$/gm, '\n\n$1\n')

    // H3-H6 (### to ######) -> Single line break + text
    .replace(/^#{3,6}\s+(.+)$/gm, '\n$1\n')

    // Remove bullet points and list markers, keeping content
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')

    // Remove blockquote markers (>)
    .replace(/^>\s+/gm, '')

    // Remove horizontal rules (---, ***, ___)
    .replace(/^[\s]*[-*_]{3,}[\s]*$/gm, '')

    // Remove link syntax but keep link text: [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')

    // Remove image syntax: ![alt](url) -> ""
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')

    // Collapse multiple newlines into double newlines (paragraph breaks)
    .replace(/\n{3,}/g, '\n\n')

    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Prepare text specifically for TTS (Text-to-Speech) narration
 *
 * Adds natural pauses, emphasis cues, and pacing adjustments to make
 * the reading sound like a human storyteller, not a robot.
 *
 * @param {string} text - Normalized plain text
 * @returns {string} TTS-optimized text with pause markers and emphasis
 */
export function prepareForTTS(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Add pauses after section breaks (double newlines)
    // Some TTS engines respect SSML-like pauses, but we'll use ellipsis for natural pausing
    .replace(/\n\n/g, '... ')

    // Add slight pause after sentences
    .replace(/([.!?])\s+/g, '$1.. ')

    // Remove parenthetical asides that don't narrate well
    // E.g., "(Card 1)" -> ""
    .replace(/\(Card \d+\)/gi, '')
    .replace(/\([^)]{1,30}\)/g, '') // Remove short parentheticals

    // Convert em dashes to natural pauses
    .replace(/\s*—\s*/g, '... ')
    .replace(/\s*–\s*/g, '... ')

    // Add emphasis markers for key phrases (optional, depends on TTS engine)
    // For now, we'll keep it simple and let natural language handle emphasis

    // Clean up excessive ellipsis (more than 3 dots)
    .replace(/\.{4,}/g, '...')

    // Collapse multiple spaces
    .replace(/\s{2,}/g, ' ')

    // Trim
    .trim();
}

/**
 * Split normalized text into natural paragraphs for UI rendering
 *
 * @param {string} text - Normalized plain text
 * @returns {string[]} Array of paragraph strings
 */
export function splitIntoParagraphs(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .split(/\n\n+/)
    .map(para => para.trim())
    .filter(para => para.length > 0);
}

/**
 * Preserve headings as semantic sections while normalizing content
 *
 * Returns structured sections with headers and content, useful for
 * rendering with accessible heading hierarchy.
 *
 * @param {string} markdown - Raw Markdown reading text
 * @returns {Array<{level: number, title: string, content: string}>}
 */
export function extractSections(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return [];
  }

  const sections = [];
  const lines = markdown.split('\n');
  let currentSection = null;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.content = normalizeReadingText(currentSection.content);
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        level: headingMatch[1].length,
        title: headingMatch[2].trim(),
        content: ''
      };
    } else if (currentSection) {
      // Add to current section content
      currentSection.content += line + '\n';
    } else {
      // Content before first heading (introduction)
      if (!sections.length || sections[sections.length - 1].title !== 'Introduction') {
        sections.push({
          level: 0,
          title: 'Introduction',
          content: line + '\n'
        });
      } else {
        sections[sections.length - 1].content += line + '\n';
      }
    }
  }

  // Save last section
  if (currentSection) {
    currentSection.content = normalizeReadingText(currentSection.content);
    sections.push(currentSection);
  }

  // Normalize all content
  return sections.map(section => ({
    ...section,
    content: section.content.trim()
  })).filter(section => section.content.length > 0);
}

/**
 * Format reading for export (preserve some structure but make readable)
 *
 * Keeps paragraph breaks and section divisions but removes distracting
 * Markdown syntax, suitable for copying to journal or sharing.
 *
 * @param {string} markdown - Raw Markdown reading text
 * @returns {string} Export-friendly formatted text
 */
export function formatForExport(markdown) {
  if (!markdown || typeof markdown !== 'string') {
    return '';
  }

  return markdown
    // Keep bold as UPPERCASE for emphasis
    .replace(/\*\*([^*]+)\*\*/g, (match, text) => text.toUpperCase())
    .replace(/__([^_]+)__/g, (match, text) => text.toUpperCase())

    // Remove italics markers
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')

    // Convert headings to section dividers
    .replace(/^#\s+(.+)$/gm, '\n═══════════════════════════════════════\n$1\n═══════════════════════════════════════')
    .replace(/^#{2}\s+(.+)$/gm, '\n───────────────────────────────────────\n$1\n───────────────────────────────────────')
    .replace(/^#{3,6}\s+(.+)$/gm, '\n$1\n')

    // Keep paragraph breaks
    .replace(/\n{3,}/g, '\n\n')

    // Remove other markers
    .replace(/`([^`]+)`/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')

    .trim();
}

/**
 * Create a cache key from normalized text for TTS storage
 *
 * This ensures TTS cache keys align with the cleaned version,
 * preventing cache misses and duplicate storage.
 *
 * @param {string} text - Text to create cache key from
 * @returns {string} Stable hash key
 */
export function createTextCacheKey(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Normalize first to ensure consistent keys
  const normalized = normalizeReadingText(text);

  // Simple hash function (same as used in audio.js)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `tts_${Math.abs(hash).toString(36)}`;
}

/**
 * Detect if text contains Markdown formatting
 *
 * Useful for conditionally applying normalization.
 *
 * @param {string} text - Text to check
 * @returns {boolean} True if Markdown markers detected
 */
export function hasMarkdownFormatting(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const markdownPatterns = [
    /\*\*.*?\*\*/,          // Bold
    /\*.*?\*/,             // Italic
    /__.*?__/,             // Bold alt
    /_.*?_/,               // Italic alt
    /^#{1,6}\s+/m,         // Headings
    /`.*?`/,               // Code
    /\[.*?\]\(.*?\)/,      // Links
    /!\[.*?\]\(.*?\)/      // Images
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Comprehensive formatter that handles both display and narration
 *
 * Returns both UI-ready and TTS-ready versions, plus structured sections.
 * This is the main entry point for reading formatting.
 *
 * @param {string} rawMarkdown - Original Markdown reading text
 * @returns {Object} Formatted reading in multiple representations
 */
export function formatReading(rawMarkdown) {
  if (!rawMarkdown || typeof rawMarkdown !== 'string') {
    return {
      raw: '',
      normalized: '',
      tts: '',
      paragraphs: [],
      sections: [],
      exportText: '',
      cacheKey: ''
    };
  }

  const normalized = normalizeReadingText(rawMarkdown);
  const tts = prepareForTTS(normalized);
  const paragraphs = splitIntoParagraphs(normalized);
  const sections = extractSections(rawMarkdown);
  const exportText = formatForExport(rawMarkdown);
  const cacheKey = createTextCacheKey(normalized);

  return {
    raw: rawMarkdown,
    normalized,
    tts,
    paragraphs,
    sections,
    exportText,
    cacheKey,
    hasMarkdown: hasMarkdownFormatting(rawMarkdown)
  };
}
