const DEFAULT_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_MAX_TOKENS = 512;
const MAX_REASONING_CHARS = 600;
const MAX_VISUAL_DETAILS = 6;
const MAX_VISUAL_DETAIL_CHARS = 120;
const MAX_MATCHES = 5;

const VISION_SYSTEM_PROMPT = `You analyze tarot card images.

Rules:
- Return ONLY valid JSON, no markdown and no extra text.
- Pick the closest matching tarot card name from the allowed list.
- Orientation must be "upright", "reversed", or "unknown".
- Confidence is a number between 0 and 1.
- Reasoning should be 1-2 short sentences, grounded in visible elements.
- Visual details should be a short list of 3-6 phrases.`;

function clampConfidence(value) {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return null;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function normalizeOrientation(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith('upright')) return 'upright';
  if (normalized.startsWith('reversed') || normalized.startsWith('reverse')) return 'reversed';
  if (normalized === 'unknown') return 'unknown';
  return null;
}

function truncateText(value, maxChars) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!maxChars || trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(0, maxChars).trim();
}

function normalizeVisualDetails(details) {
  if (!details) return null;
  let items = [];
  if (Array.isArray(details)) {
    items = details;
  } else if (typeof details === 'string') {
    items = details.split(/[\n;]+/g);
  } else {
    return null;
  }

  const normalized = items
    .map((entry) => (typeof entry === 'string' ? truncateText(entry, MAX_VISUAL_DETAIL_CHARS) : null))
    .filter(Boolean)
    .slice(0, MAX_VISUAL_DETAILS);

  return normalized.length ? normalized : null;
}

function normalizeMatches(matches) {
  if (!Array.isArray(matches)) return [];
  return matches
    .map((match) => {
      if (typeof match === 'string') {
        return { card: match.trim(), confidence: null };
      }
      if (!match || typeof match !== 'object') return null;
      const card = typeof match.card === 'string'
        ? match.card
        : (typeof match.name === 'string' ? match.name : match.cardName);
      if (!card || typeof card !== 'string') return null;
      return {
        card: card.trim(),
        confidence: clampConfidence(match.confidence ?? match.score ?? match.probability ?? null)
      };
    })
    .filter(Boolean)
    .slice(0, MAX_MATCHES);
}

function extractJsonBlock(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  const jsonText = candidate.slice(start, end + 1);
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function normalizeImageInput(image) {
  if (typeof image === 'string') {
    if (image.startsWith('data:image/')) {
      const commaIndex = image.indexOf(',');
      if (commaIndex === -1) return null;
      return image.slice(commaIndex + 1);
    }
    if (/^https?:\/\//i.test(image)) {
      return null;
    }
    return image;
  }

  if (image instanceof ArrayBuffer) {
    return arrayBufferToBase64(image);
  }

  if (ArrayBuffer.isView(image)) {
    return arrayBufferToBase64(image.buffer);
  }

  return null;
}

function arrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function buildUserPrompt({ allowedCards = [], deckProfile, cardScope }) {
  const scopeLine = cardScope === 'all' ? 'Major + Minor Arcana' : 'Major Arcana only';
  const deckCue = deckProfile?.promptCue ? `Deck cues: ${deckProfile.promptCue}` : '';
  const allowedList = allowedCards.length
    ? `Allowed cards:\n- ${allowedCards.join('\n- ')}`
    : '';

  return `Identify the tarot card shown.
Scope: ${scopeLine}.
${deckCue}
${allowedList}

Return JSON with keys:
card, confidence, orientation, reasoning, visualDetails, matches.`;
}

function normalizeLlamaPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const card = typeof payload.card === 'string'
    ? payload.card
    : (typeof payload.predictedCard === 'string' ? payload.predictedCard : payload.cardName);

  const confidence = clampConfidence(payload.confidence ?? payload.score ?? payload.probability ?? null);
  const orientation = normalizeOrientation(payload.orientation || payload.rotation || payload.flip);
  const reasoning = truncateText(payload.reasoning || payload.rationale || payload.explanation, MAX_REASONING_CHARS);
  const visualDetails = normalizeVisualDetails(payload.visualDetails || payload.visual_details || payload.details);
  const matches = normalizeMatches(payload.matches || payload.alternates || payload.candidates);

  return {
    card: typeof card === 'string' ? card.trim() : null,
    confidence,
    orientation,
    reasoning,
    visualDetails,
    matches
  };
}

export async function runLlamaVisionAnalysis(env, options = {}) {
  const {
    image,
    label,
    allowedCards = [],
    deckProfile = null,
    cardScope = 'major',
    timeoutMs = DEFAULT_TIMEOUT_MS,
    model = DEFAULT_MODEL,
    maxTokens = DEFAULT_MAX_TOKENS
  } = options;

  if (!env?.AI?.run) {
    return {
      status: 'missing_ai',
      label: label || null,
      model
    };
  }

  const base64Image = normalizeImageInput(image);
  if (!base64Image) {
    return {
      status: 'invalid_image',
      label: label || null,
      model
    };
  }

  const prompt = buildUserPrompt({ allowedCards, deckProfile, cardScope });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const response = await env.AI.run(
      model,
      {
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image', image: base64Image }
            ]
          }
        ],
        max_tokens: maxTokens,
        temperature: 0.2
      },
      { signal: controller.signal }
    );

    const latencyMs = Date.now() - startTime;
    const responseText = typeof response?.response === 'string'
      ? response.response
      : (typeof response === 'string' ? response : '');
    const parsed = extractJsonBlock(responseText);

    if (!parsed) {
      return {
        status: 'parse_error',
        label: label || null,
        model,
        latencyMs
      };
    }

    const normalized = normalizeLlamaPayload(parsed);
    if (!normalized || !normalized.card) {
      return {
        status: 'parse_error',
        label: label || null,
        model,
        latencyMs
      };
    }

    return {
      status: 'ok',
      label: label || null,
      model,
      latencyMs,
      ...normalized
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    if (err?.name === 'AbortError') {
      return {
        status: 'timeout',
        label: label || null,
        model,
        latencyMs
      };
    }
    return {
      status: 'error',
      label: label || null,
      model,
      latencyMs,
      error: err?.message || 'Unknown error'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export { DEFAULT_MODEL as LLAMA_VISION_DEFAULT_MODEL };
