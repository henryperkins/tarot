import { tableuMarkMarkup } from '../../shared/brand/tableuMark.js';

const DEFAULT_ERROR_MESSAGE = 'Reading not found';
const SPREAD_MAX_LENGTH = 22;
const NAME_MAX_LENGTH = 20;
const SITE_DOMAIN = 'tarot.lakefrontdev.com';

const SUIT_COLORS = {
  wands: '#C9A876',
  cups: '#8B95A5',
  swords: '#6B7280',
  pentacles: '#8A9985',
  coins: '#8A9985',
};

const XML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, match => XML_ESCAPES[match]);
}

function truncate(value, maxLength) {
  if (!value) return '';
  const text = String(value);
  if (!maxLength || text.length <= maxLength) return text;
  if (maxLength <= 3) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 3)}...`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Undated';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Undated';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function getSuitColor(card) {
  if (!card?.suit) return '#D4B896';
  const suitKey = String(card.suit).toLowerCase();
  return SUIT_COLORS[suitKey] || '#D4B896';
}

export function buildOgImageSvg(entries, shareRecord) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const entry = safeEntries[0] || {};
  const cards = Array.isArray(entry.cards) ? entry.cards : [];
  const visibleCards = cards.slice(0, 5);
  const overflowCount = Math.max(0, cards.length - visibleCards.length);

  const dateStr = escapeXml(formatDate(entry?.ts));
  const spreadText = escapeXml(truncate(entry?.spread || 'Tarot Reading', SPREAD_MAX_LENGTH));
  const questionText = entry?.question
    ? escapeXml(truncate(entry.question, 90))
    : '';
  const contextText = entry?.context
    ? escapeXml(String(entry.context).toUpperCase())
    : '';
  const themeText = entry?.themes?.suitFocus || entry?.themes?.archetypeDescription || '';
  const themeLine = themeText ? escapeXml(truncate(themeText, 90)) : '';
  const shareTitle = shareRecord?.title
    ? escapeXml(truncate(shareRecord.title, 40))
    : '';
  const shareToken = shareRecord?.token ? escapeXml(shareRecord.token) : '';
  const shareUrl = shareToken ? `${SITE_DOMAIN}/share/${shareToken}` : SITE_DOMAIN;
  const entryCountLabel = safeEntries.length > 1 ? `${safeEntries.length} readings shared` : '';
  const entryCountText = entryCountLabel ? escapeXml(entryCountLabel) : '';

  const cardMarkup = visibleCards.map((card, index) => {
    const cardName = card?.name || `Card ${index + 1}`;
    const position = card?.position || '';
    const orientation = card?.orientation || (card?.isReversed ? 'Reversed' : 'Upright');
    const isReversed = /reversed/i.test(String(orientation)) || card?.isReversed;
    const nameLabel = truncate(`${cardName}${isReversed ? ' ↺' : ''}`, NAME_MAX_LENGTH);
    const positionLabel = truncate(position, 18);
    const color = getSuitColor(card);
    const x = 70 + index * 215;
    const y = 180;

    return `
    <g transform="translate(${x}, ${y})">
      <rect width="180" height="250" rx="12" fill="#1C1A22" stroke="#625547" stroke-width="2" />
      <rect x="12" y="12" width="156" height="226" rx="8" fill="#0F0E13" stroke="#3F3741" stroke-width="1" />
      <path d="M60 70 H120" fill="none" stroke="${color}" stroke-width="3" />
      <text x="90" y="155" fill="#E8E6E3" font-family="serif" font-size="18" text-anchor="middle" font-weight="600">${escapeXml(nameLabel)}</text>
      <text x="90" y="184" fill="#CCC5B9" font-family="sans-serif" font-size="12" text-anchor="middle" letter-spacing="1">${escapeXml(positionLabel)}</text>
    </g>`;
  }).join('');

  const overflowMarkup = overflowCount
    ? `<text x="70" y="454" fill="#CCC5B9" font-family="sans-serif" font-size="14">+${overflowCount} more cards</text>`
    : '';

  const shareTitleMarkup = shareTitle
    ? `<text x="60" y="117" fill="#CCC5B9" font-family="serif" font-size="22">${shareTitle}</text>`
    : '';
  const entryCountMarkup = entryCountText
    ? `<text x="1140" y="117" fill="#CCC5B9" font-family="sans-serif" font-size="16" text-anchor="end">${entryCountText}</text>`
    : '';

  const infoLines = [];
  let infoY = 483;
  if (themeLine) {
    infoLines.push(`<text x="60" y="${infoY}" fill="#D4B896" font-family="sans-serif" font-size="14" letter-spacing="2">THEME</text>`);
    infoY += 20;
    infoLines.push(`<text x="60" y="${infoY}" fill="#CCC5B9" font-family="sans-serif" font-size="16">${themeLine}</text>`);
    infoY += 30;
  }
  if (contextText) {
    infoLines.push(`<text x="60" y="${infoY}" fill="#D4B896" font-family="sans-serif" font-size="14" letter-spacing="2">CONTEXT: ${contextText}</text>`);
    infoY += 30;
  }
  if (questionText) {
    infoLines.push(`<text x="60" y="${infoY}" fill="#E8E6E3" font-family="sans-serif" font-size="20">${questionText}</text>`);
  }
  const infoMarkup = infoLines.join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1C1A22"/>
      <stop offset="100%" stop-color="#0F0E13"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>

  <g transform="translate(60 26) scale(0.24)" color="#D4B896" fill="currentColor">${tableuMarkMarkup()}</g>
  <text x="136" y="67" fill="#D4B896" font-family="serif" font-size="34" letter-spacing="5">TABLEU</text>
  <text x="1140" y="67" fill="#CCC5B9" font-family="sans-serif" font-size="18" text-anchor="end">${dateStr}</text>
  ${shareTitleMarkup}
  ${entryCountMarkup}

  <text x="60" y="157" fill="#E8E6E3" font-family="serif" font-size="30">${spreadText}</text>

  ${cardMarkup}
  ${overflowMarkup}

  ${infoMarkup}

  <text x="60" y="606" fill="#CCC5B9" font-family="sans-serif" font-size="14">${shareUrl}</text>
</svg>`;
}

export function buildErrorOgImage(message = DEFAULT_ERROR_MESSAGE) {
  const safeMessage = escapeXml(message || DEFAULT_ERROR_MESSAGE);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1C1A22"/>
      <stop offset="100%" stop-color="#0F0E13"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <g transform="translate(60 26) scale(0.24)" color="#D4B896" fill="currentColor">${tableuMarkMarkup()}</g>
  <text x="136" y="67" fill="#D4B896" font-family="serif" font-size="34" letter-spacing="5">TABLEU</text>
  <text x="60" y="260" fill="#E8E6E3" font-family="serif" font-size="36">${safeMessage}</text>
  <text x="60" y="310" fill="#CCC5B9" font-family="sans-serif" font-size="20">Please check your share link and try again.</text>
  <text x="60" y="606" fill="#CCC5B9" font-family="sans-serif" font-size="14">${SITE_DOMAIN}</text>
</svg>`;
}
