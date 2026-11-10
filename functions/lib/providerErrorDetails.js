/**
 * Provider error details that are safe to write to Worker logs.
 *
 * Provider messages explain a rejection ("The model `x` does not exist", or
 * "Unexpected value(s) `x` for the `anthropic-beta` header."), but they can quote
 * request content. Quoted values that are not plain identifiers, email addresses
 * and long opaque tokens are masked, and the text is capped, so request content
 * and credentials stay out of logs.
 */

const SAFE_QUOTED_VALUE = /^[A-Za-z0-9_.:/-]{1,64}$/;
const SAFE_IDENTIFIER = /^[A-Za-z0-9_.:-]{1,64}$/;
const MAX_LOGGED_MESSAGE_LENGTH = 200;

export function sanitizeProviderErrorMessage(message) {
  if (typeof message !== 'string') return null;
  const keepIdentifier = (match, open, value, close) => (SAFE_QUOTED_VALUE.test(value) ? match : `${open}[redacted]${close}`);
  const text = message
    .replace(/\p{Cc}+/gu, ' ')
    .replace(/(`)([^`]{0,500})(`)/g, keepIdentifier)
    .replace(/(["“])([^"“”]{0,500})(["”])/g, keepIdentifier)
    // A single quote opens a value only outside a word, so "doesn't" survives.
    .replace(/(?<!\w)(['‘])([^'‘’]{1,500})(['’])(?!\w)/g, keepIdentifier)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[redacted]')
    .replace(/[A-Za-z0-9]{24,}/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > MAX_LOGGED_MESSAGE_LENGTH ? `${text.slice(0, MAX_LOGGED_MESSAGE_LENGTH - 1)}…` : text;
}

/** A provider error code, type or parameter name, or null when it is not a plain identifier. */
export function safeProviderIdentifier(value) {
  return typeof value === 'string' && SAFE_IDENTIFIER.test(value) ? value : null;
}
