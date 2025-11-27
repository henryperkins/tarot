const DEFAULT_LABEL = 'uploaded-image';
export const MAX_VISION_LABEL_LENGTH = 80;

const CONTROL_CHARS_REGEX = /\p{Cc}/gu;
const MARKDOWN_META_REGEX = /[#*_`>|]/g;
const BRACKETS_REGEX = /[[\]{}<>]/g;
const UNSAFE_CHAR_REGEX = /[^\p{L}\p{N}\s.,!?:;\-–—_'"/\\&()]/gu;

function collapseWhitespace(value) {
    return value.replace(/\s+/g, ' ').trim();
}

export function normalizeVisionLabel(label, options = {}) {
    const fallback = options.fallback || DEFAULT_LABEL;
    const maxLength = typeof options.maxLength === 'number' && options.maxLength > 0
        ? options.maxLength
        : MAX_VISION_LABEL_LENGTH;

    if (typeof label !== 'string') {
        return fallback;
    }

    let sanitized = label;
    sanitized = sanitized.replace(CONTROL_CHARS_REGEX, ' ');
    sanitized = sanitized.replace(MARKDOWN_META_REGEX, ' ');
    sanitized = sanitized.replace(BRACKETS_REGEX, ' ');
    sanitized = collapseWhitespace(sanitized);

    if (!sanitized) {
        return fallback;
    }

    sanitized = sanitized.replace(UNSAFE_CHAR_REGEX, '');
    sanitized = collapseWhitespace(sanitized);

    if (!sanitized) {
        return fallback;
    }

    if (sanitized.length > maxLength) {
        sanitized = sanitized.slice(0, maxLength).trim();
    }

    return sanitized || fallback;
}

export function formatVisionLabelForPrompt(label, options = {}) {
    const safe = normalizeVisionLabel(label, options);
    // Escape any lingering markdown characters (should be removed already, but double-escape for safety)
    return safe.replace(/([*_`])/g, '').trim();
}
