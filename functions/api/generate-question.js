const JSON_HEADERS = { 'Content-Type': 'application/json' };

function sanitizeSnippet(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  return value.trim();
}

function ensureQuestionMark(text) {
  if (!text) return '';
  return text.trim().endsWith('?') ? text.trim() : `${text.trim()}?`;
}

/**
 * FNV-1a hash function (matches deck.js implementation)
 */
function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Deterministic variant picker using seed.
 * Same seed + same list = same result.
 */
function pickDeterministic(list, seed) {
  if (!Array.isArray(list) || list.length === 0) return '';
  const numericSeed = typeof seed === 'string' ? hashString(seed) : (seed >>> 0);
  return list[numericSeed % list.length];
}

/**
 * Legacy picker with time-based randomization (non-deterministic).
 * Used when no seed is provided.
 */
function pick(list, seed = '') {
  if (!Array.isArray(list) || list.length === 0) return '';
  const mixed = seed ? Math.abs(hashString(`${seed}|${Math.random()}|${Date.now()}`)) : Math.floor(Math.random() * list.length);
  return list[mixed % list.length];
}

/**
 * Crafts a creative question from prompt and metadata.
 *
 * @param {string} prompt - The prompt text
 * @param {Object} metadata - Question metadata including seed
 * @returns {string} Generated question text
 */
function craftQuestionFromPrompt(prompt, metadata = {}) {
  const focusMatch = prompt.match(/about (.+?) for the/i);
  const timeframeMatch = prompt.match(/for the (.+?)(?:\.|$)/i);
  const depthMatch = prompt.match(/depth is (.+?)(?:\.|$)/i);

  const focus = sanitizeSnippet(metadata.focus || metadata.customFocus || (focusMatch ? focusMatch[1] : ''), 'this path');
  const timeframe = sanitizeSnippet(metadata.timeframe || (timeframeMatch ? timeframeMatch[1] : ''), '').toLowerCase();
  const depth = sanitizeSnippet(metadata.depth || (depthMatch ? depthMatch[1] : ''), 'deeper insight');

  const topicLabel = sanitizeSnippet(metadata.topic, 'this chapter');
  const recentTheme = Array.isArray(metadata.recentThemes) && metadata.recentThemes.length > 0
    ? metadata.recentThemes[0]
    : null;

  const timeframeClause = timeframe ? ` over ${timeframe}` : '';
  const themeClause = recentTheme ? ` while honoring ${recentTheme}` : '';

  const verbs = ['move forward with', 'nurture', 'deepen trust in', 'reimagine', 'show up for'];
  const closers = ['honor my growth', 'feel aligned', 'invite reciprocity', 'stay grounded', 'lead with compassion'];
  const lenses = ['with clarity', 'with courage', 'with steadiness', 'with openness', 'with healthy boundaries'];

  // Use deterministic picker if seed is provided
  const seed = metadata.seed;
  const hasSeed = seed !== null && seed !== undefined;
  const picker = hasSeed ? pickDeterministic : pick;

  const verb = picker(verbs, hasSeed ? hashString(`${seed}|verb|${focus}`) : focus);
  const closer = picker(closers, hasSeed ? hashString(`${seed}|closer|${depth}`) : depth);
  const lens = picker(lenses, hasSeed ? hashString(`${seed}|lens|${topicLabel}`) : topicLabel);

  const baseQuestion = `How can I ${verb} ${focus}${timeframeClause}${themeClause} so I can ${closer} ${lens} in ${topicLabel}`;
  return ensureQuestionMark(baseQuestion.replace(/\s+/g, ' ').trim());
}

export async function onRequestPost({ request }) {
  try {
    const body = await request.json();
    const prompt = body?.prompt;
    const metadata = body?.metadata || {};

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing prompt' }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const question = craftQuestionFromPrompt(prompt, metadata);
    return new Response(
      JSON.stringify({ question }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error) {
    console.error('generate-question error:', error);
    return new Response(
      JSON.stringify({ error: 'Unable to craft question' }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
}
