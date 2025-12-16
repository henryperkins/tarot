/**
 * OG Image Builder
 *
 * Generates SVG images for Open Graph social media previews.
 * These images appear when share links are posted to Twitter, Facebook, Discord, etc.
 *
 * Output: 1200x630 SVG (standard OG dimensions)
 */

const SUIT_COLORS = {
  Wands: '#f97316',    // Orange - Fire
  Cups: '#3b82f6',     // Blue - Water
  Swords: '#a855f7',   // Purple - Air
  Pentacles: '#22c55e' // Green - Earth
};

const MAJOR_ARCANA_COLOR = '#fbbf24'; // Gold/Amber

/**
 * Get accent color for a card based on its suit or Major Arcana status.
 * @param {Object} card - Card object with suit property
 * @returns {string} Hex color code
 */
function getCardColor(card) {
  if (card?.suit && SUIT_COLORS[card.suit]) {
    return SUIT_COLORS[card.suit];
  }
  // Major Arcana or unknown - use gold
  return MAJOR_ARCANA_COLOR;
}

/**
 * Truncate a string to a maximum length with ellipsis.
 * @param {string} str - Input string
 * @param {number} maxLen - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}

/**
 * Escape special XML characters for safe SVG embedding.
 * @param {string} str - Input string
 * @returns {string} XML-safe string
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format a timestamp for display.
 * @param {number} ts - Timestamp in milliseconds or seconds
 * @returns {string} Formatted date string
 */
function formatDate(ts) {
  if (!ts) return '';
  // Handle both milliseconds and seconds
  const ms = ts < 1e12 ? ts * 1000 : ts;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Build a single card element for the SVG.
 * @param {Object} card - Card object
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Card width
 * @param {number} height - Card height
 * @returns {string} SVG group element
 */
function buildCardElement(card, x, y, width, height) {
  const color = getCardColor(card);
  const orientation = card.orientation === 'Reversed' ? ' ↺' : '';
  const name = escapeXml(truncate(card.name, 14));
  const position = escapeXml(card.position || '');

  // Create a stylized card representation
  return `
    <g transform="translate(${x}, ${y})">
      <!-- Card border -->
      <rect width="${width}" height="${height}" rx="8" fill="#1a1b2e" stroke="${color}" stroke-width="2"/>

      <!-- Inner design area -->
      <rect x="12" y="12" width="${width - 24}" height="${height - 70}" rx="4" fill="${color}15"/>

      <!-- Decorative element based on suit/type -->
      <circle cx="${width / 2}" cy="${(height - 70) / 2 + 12}" r="20" fill="${color}25" stroke="${color}40" stroke-width="1"/>

      <!-- Card name -->
      <text x="${width / 2}" y="${height - 40}" fill="#ffffff" font-size="11" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="500">${name}${orientation}</text>

      <!-- Position label -->
      <text x="${width / 2}" y="${height - 20}" fill="#a3a3a3" font-size="9" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${position}</text>
    </g>
  `;
}

/**
 * Build the complete OG image SVG for a share link.
 *
 * @param {Array<Object>} entries - Journal entries to display
 * @param {Object} shareRecord - Share token record with metadata
 * @returns {string} Complete SVG document
 */
export function buildOgImageSvg(entries, shareRecord) {
  const entry = entries?.[0];
  const cards = entry?.cards || [];
  const spread = entry?.spread || entry?.spreadName || 'Tarot Reading';
  const question = entry?.question || '';
  const theme = entry?.themes?.suitFocus ||
    entry?.themes?.archetypeDescription ||
    entry?.themes?.elementalBalance ||
    '';
  const date = formatDate(entry?.ts || entry?.created_at);
  const context = entry?.context || '';

  // OG standard dimensions
  const width = 1200;
  const height = 630;

  // Card layout calculations
  const displayCards = cards.slice(0, 5);
  const cardWidth = 110;
  const cardHeight = 170;
  const cardGap = 16;
  const cardsStartX = 50;
  const cardsStartY = 130;

  // Build card elements
  const cardElements = displayCards
    .map((card, i) => {
      const x = cardsStartX + i * (cardWidth + cardGap);
      return buildCardElement(card, x, cardsStartY, cardWidth, cardHeight);
    })
    .join('');

  // Info panel position (right side)
  const infoX = cardsStartX + displayCards.length * (cardWidth + cardGap) + 40;

  // Build context badge if present
  const contextBadge = context
    ? `<text x="${infoX}" y="175" fill="#a3a3a3" font-size="11" font-family="system-ui, -apple-system, sans-serif" text-transform="uppercase" letter-spacing="0.5">${escapeXml(context.toUpperCase())}</text>`
    : '';

  // Build question block if present
  const questionBlock = question
    ? `
      <text x="${infoX}" y="230" fill="#888888" font-size="12" font-family="system-ui, -apple-system, sans-serif" font-style="italic">"${escapeXml(truncate(question, 50))}"</text>
    `
    : '';

  // Build theme block if present
  const themeBlock = theme
    ? `
      <text x="${infoX}" y="${question ? 280 : 230}" fill="${MAJOR_ARCANA_COLOR}" font-size="11" font-family="system-ui, -apple-system, sans-serif" font-weight="500">THEME</text>
      <text x="${infoX}" y="${question ? 302 : 252}" fill="#d4d4d4" font-size="13" font-family="system-ui, -apple-system, sans-serif">${escapeXml(truncate(theme, 45))}</text>
    `
    : '';

  // Additional cards indicator
  const moreCards =
    cards.length > 5
      ? `<text x="${infoX}" y="350" fill="#666666" font-size="12" font-family="system-ui, -apple-system, sans-serif">+${cards.length - 5} more cards</text>`
      : '';

  // Entry count for journal shares
  const entryCount =
    entries?.length > 1
      ? `<text x="${infoX}" y="380" fill="#666666" font-size="12" font-family="system-ui, -apple-system, sans-serif">${entries.length} readings shared</text>`
      : '';

  // Share title (user-defined or default)
  const shareTitle = shareRecord?.title
    ? `<text x="${width - 50}" y="${height - 30}" fill="#888888" font-size="12" text-anchor="end" font-family="system-ui, -apple-system, sans-serif">${escapeXml(truncate(shareRecord.title, 35))}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient -->
    <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0b0c1d"/>
      <stop offset="50%" style="stop-color:#0d1024"/>
      <stop offset="100%" style="stop-color:#1a1b2e"/>
    </linearGradient>

    <!-- Subtle glow effect -->
    <radialGradient id="glow" cx="20%" cy="30%" r="50%">
      <stop offset="0%" style="stop-color:rgba(251,191,36,0.08)"/>
      <stop offset="100%" style="stop-color:transparent"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg-gradient)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>

  <!-- Header bar -->
  <rect x="0" y="0" width="${width}" height="90" fill="#0a0b15" opacity="0.5"/>

  <!-- Logo/Brand -->
  <text x="50" y="55" fill="${MAJOR_ARCANA_COLOR}" font-size="26" font-weight="bold" font-family="system-ui, -apple-system, sans-serif">★ MYSTIC TAROT</text>

  <!-- Date -->
  <text x="${width - 50}" y="55" fill="#a3a3a3" font-size="16" text-anchor="end" font-family="system-ui, -apple-system, sans-serif">${escapeXml(date)}</text>

  <!-- Divider line -->
  <line x1="50" y1="90" x2="${width - 50}" y2="90" stroke="${MAJOR_ARCANA_COLOR}" stroke-width="1" opacity="0.3"/>

  <!-- Cards -->
  ${cardElements}

  <!-- Info Panel -->
  <!-- Spread name -->
  <text x="${infoX}" y="155" fill="#ffffff" font-size="28" font-weight="bold" font-family="system-ui, -apple-system, sans-serif">${escapeXml(truncate(spread, 22))}</text>

  ${contextBadge}
  ${questionBlock}
  ${themeBlock}
  ${moreCards}
  ${entryCount}

  <!-- Footer bar -->
  <rect x="0" y="${height - 60}" width="${width}" height="60" fill="#0a0b15" opacity="0.5"/>

  <!-- Footer divider -->
  <line x1="50" y1="${height - 60}" x2="${width - 50}" y2="${height - 60}" stroke="${MAJOR_ARCANA_COLOR}" stroke-width="1" opacity="0.2"/>

  <!-- Share URL -->
  <text x="50" y="${height - 25}" fill="#666666" font-size="14" font-family="system-ui, -apple-system, sans-serif">mystictarot.app/share/${escapeXml(shareRecord?.token || '')}</text>

  ${shareTitle}
</svg>`;
}

/**
 * Build a minimal OG image for empty or error states.
 *
 * @param {string} message - Message to display
 * @returns {string} SVG document
 */
export function buildErrorOgImage(message = 'Reading not found') {
  const width = 1200;
  const height = 630;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0b0c1d"/>
  <text x="${width / 2}" y="${height / 2 - 20}" fill="${MAJOR_ARCANA_COLOR}" font-size="32" font-weight="bold" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">★ MYSTIC TAROT</text>
  <text x="${width / 2}" y="${height / 2 + 30}" fill="#666666" font-size="18" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif">${escapeXml(message)}</text>
</svg>`;
}
