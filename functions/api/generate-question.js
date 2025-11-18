const JSON_HEADERS = { 'Content-Type': 'application/json' };

function sanitizeSnippet(value, fallback) {
  if (!value || typeof value !== 'string') return fallback;
  return value.trim();
}

function ensureQuestionMark(text) {
  if (!text) return '';
  return text.trim().endsWith('?') ? text.trim() : `${text.trim()}?`;
}

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

  const baseQuestion = `How can I work with ${focus}${timeframeClause}${themeClause} to invite ${depth.toLowerCase()} in ${topicLabel}?`;
  return ensureQuestionMark(baseQuestion);
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
