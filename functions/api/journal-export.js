/**
 * Journal Export API Endpoint
 *
 * GET /api/journal-export/:id - Export a single reading as PDF
 * GET /api/journal-export?format=pdf - Export all readings as PDF
 *
 * Generates PDF documents and optionally stores them in R2 for caching.
 */

import { validateSession, getSessionFromCookie } from '../lib/auth.js';
import { jsonResponse } from '../lib/utils.js';

// PDF generation constants
const PDF_PAGE_HEIGHT = 842; // A4 height in points
const PDF_PAGE_WIDTH = 595;  // A4 width in points
const PDF_MARGIN = 50;
const PDF_LINE_HEIGHT = 14;
const PDF_CHARS_PER_LINE = 80;
const PDF_TOP_Y = 750;
const PDF_BOTTOM_Y = 50;

/**
 * Simple multi-page PDF generator for Cloudflare Workers
 * Creates a basic PDF document without external dependencies
 * @param {string} content - Text content to render
 * @returns {{pdf: string, pageCount: number, truncated: boolean}}
 */
export function generatePDF(content) {
  const lines = content.split('\n');

  // Encode text for PDF (handle special characters)
  const encodeText = (text) => {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\u0080-\uFFFF]/g, '?'); // Replace non-ASCII with ?
  };

  // Word wrap a single line
  const wrapLine = (line) => {
    const wrapped = [];
    if (line.length > PDF_CHARS_PER_LINE) {
      let remaining = line;
      while (remaining.length > 0) {
        let breakPoint = PDF_CHARS_PER_LINE;
        if (remaining.length > PDF_CHARS_PER_LINE) {
          const lastSpace = remaining.lastIndexOf(' ', PDF_CHARS_PER_LINE);
          if (lastSpace > 0) {
            breakPoint = lastSpace;
          }
        }
        wrapped.push(remaining.substring(0, breakPoint));
        remaining = remaining.substring(breakPoint).trim();
      }
    } else {
      wrapped.push(line);
    }
    return wrapped;
  };

  // Generate content for a single page
  const generatePageContent = (pageLines) => {
    let yPosition = PDF_TOP_Y;
    let streamContent = 'BT\n/F1 11 Tf\n';

    for (const line of pageLines) {
      const isHeader = line.startsWith('# ') ||
                       line.startsWith('## ') ||
                       line.startsWith('### ');

      if (isHeader) {
        streamContent += 'ET\nBT\n/F1 14 Tf\n';
      }

      streamContent += `${PDF_MARGIN} ${yPosition} Td\n`;
      streamContent += `(${encodeText(line.replace(/^#+\s*/, ''))}) Tj\n`;
      streamContent += `${-PDF_MARGIN} ${-PDF_LINE_HEIGHT} Td\n`;

      if (isHeader) {
        streamContent += 'ET\nBT\n/F1 11 Tf\n';
        yPosition -= PDF_LINE_HEIGHT * 0.5;
      }

      yPosition -= PDF_LINE_HEIGHT;

      // Extra space for empty lines (paragraph breaks)
      if (line === '') {
        yPosition -= PDF_LINE_HEIGHT * 0.5;
      }
    }

    streamContent += 'ET';
    return streamContent;
  };

  // Split content into pages
  const pages = [];
  let currentPage = [];
  let currentY = PDF_TOP_Y;
  const maxPages = 20; // Limit to prevent runaway generation
  let truncated = false;
  let pageLimitReached = false;

  for (const line of lines) {
    if (pageLimitReached) break;

    const wrappedLines = wrapLine(line);

    for (const wrappedLine of wrappedLines) {
      const lineSpace = PDF_LINE_HEIGHT + (wrappedLine === '' ? PDF_LINE_HEIGHT * 0.5 : 0);

      if (currentY - lineSpace < PDF_BOTTOM_Y) {
        // Start new page
        if (currentPage.length > 0) {
          pages.push(currentPage);
        }
        if (pages.length >= maxPages) {
          // Truncate at max pages
          truncated = true;
          pageLimitReached = true;
          break;
        }
        currentPage = [];
        currentY = PDF_TOP_Y;
      }

      currentPage.push(wrappedLine);
      currentY -= lineSpace;
    }

    if (pageLimitReached) break;
  }

  // Add last page
  if (currentPage.length > 0 && pages.length < maxPages) {
    pages.push(currentPage);
  }

  const pageCount = pages.length || 1;

  // Build PDF structure
  const objects = [];
  let objectCount = 0;

  const addObject = (content) => {
    objectCount++;
    objects.push({ id: objectCount, content });
    return objectCount;
  };

  // Object 1: Catalog
  addObject('<<\n/Type /Catalog\n/Pages 2 0 R\n>>');

  // Object 2: Pages (will be updated with Kids array)
  const pageObjectIds = [];
  const pagesObjIndex = objects.length;
  addObject(''); // Placeholder

  // Object 3: Font
  const fontId = addObject('<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>');

  // Generate page objects
  for (let i = 0; i < pageCount; i++) {
    const pageLines = pages[i] || [];
    const streamContent = generatePageContent(pageLines);

    // Content stream
    const streamId = addObject(
      `<<\n/Length ${streamContent.length}\n>>\nstream\n${streamContent}\nendstream`
    );

    // Page object
    const pageId = addObject(
      `<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}]\n/Contents ${streamId} 0 R\n/Resources <<\n/Font <<\n/F1 ${fontId} 0 R\n>>\n>>\n>>`
    );
    pageObjectIds.push(pageId);
  }

  // Update Pages object with correct Kids array
  const kidsArray = pageObjectIds.map(id => `${id} 0 R`).join(' ');
  objects[pagesObjIndex].content = `<<\n/Type /Pages\n/Kids [${kidsArray}]\n/Count ${pageCount}\n>>`;

  // Build PDF
  let pdf = '%PDF-1.4\n';
  const offsets = [];

  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += `${obj.id} 0 obj\n${obj.content}\nendobj\n`;
  }

  // Cross-reference table
  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objectCount + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (const offset of offsets) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  // Trailer
  pdf += 'trailer\n';
  pdf += `<<\n/Size ${objectCount + 1}\n/Root 1 0 R\n>>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF';

  return { pdf, pageCount, truncated };
}

/**
 * Format a journal entry as readable text for PDF
 */
function formatEntryAsText(entry) {
  const lines = [];
  const date = new Date(entry.ts).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  lines.push(`# ${entry.spread || 'Tarot Reading'}`);
  lines.push(`Date: ${date}`);
  lines.push('');

  if (entry.question) {
    lines.push('## Question');
    lines.push(entry.question);
    lines.push('');
  }

  if (entry.context) {
    lines.push(`Context: ${entry.context}`);
    lines.push('');
  }

  lines.push('## Cards Drawn');
  if (Array.isArray(entry.cards)) {
    for (const card of entry.cards) {
      const position = card.position ? `${card.position}: ` : '';
      const orientation = card.orientation ? ` (${card.orientation})` : '';
      lines.push(`- ${position}${card.card || card.name}${orientation}`);
    }
  }
  lines.push('');

  if (entry.personalReading) {
    lines.push('## Reading');
    // Split long reading into paragraphs
    const paragraphs = entry.personalReading.split(/\n\n+/);
    for (const para of paragraphs) {
      lines.push(para.replace(/\n/g, ' ').trim());
      lines.push('');
    }
  }

  if (entry.reflections && Object.keys(entry.reflections).length > 0) {
    lines.push('## Personal Reflections');
    for (const [position, reflection] of Object.entries(entry.reflections)) {
      if (reflection) {
        lines.push(`Position ${position}: ${reflection}`);
      }
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * GET /api/journal-export/:id or /api/journal-export
 */
export async function onRequestGet(context) {
  const { request, env, params } = context;

  try {
    // Authenticate user
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, { status: 401 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'pdf';
    const cacheParam = url.searchParams.get('cache');
    const shouldCache = cacheParam === null
      ? true
      : !['0', 'false', 'no', 'off'].includes(cacheParam.toLowerCase());
    const entryId = params?.id;

    let entries = [];

    if (entryId) {
      // Export single entry
      const entry = await env.DB.prepare(`
        SELECT
          id, created_at, spread_key, spread_name, question,
          cards_json, narrative, themes_json, reflections_json,
          context, provider, session_seed
        FROM journal_entries
        WHERE user_id = ? AND id = ?
      `).bind(user.id, entryId).first();

      if (!entry) {
        return jsonResponse({ error: 'Entry not found' }, { status: 404 });
      }

      entries = [{
        id: entry.id,
        ts: entry.created_at * 1000,
        spread: entry.spread_name,
        spreadKey: entry.spread_key,
        question: entry.question,
        cards: JSON.parse(entry.cards_json || '[]'),
        personalReading: entry.narrative,
        themes: entry.themes_json ? JSON.parse(entry.themes_json) : null,
        reflections: entry.reflections_json ? JSON.parse(entry.reflections_json) : {},
        context: entry.context,
        provider: entry.provider
      }];
    } else {
      // Export all entries (with limit)
      const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10);
      const limit = Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 100)
        : 50;
      const result = await env.DB.prepare(`
        SELECT
          id, created_at, spread_key, spread_name, question,
          cards_json, narrative, themes_json, reflections_json,
          context, provider, session_seed
        FROM journal_entries
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
      `).bind(user.id, limit).all();

      entries = (result.results || []).map(entry => ({
        id: entry.id,
        ts: entry.created_at * 1000,
        spread: entry.spread_name,
        spreadKey: entry.spread_key,
        question: entry.question,
        cards: JSON.parse(entry.cards_json || '[]'),
        personalReading: entry.narrative,
        themes: entry.themes_json ? JSON.parse(entry.themes_json) : null,
        reflections: entry.reflections_json ? JSON.parse(entry.reflections_json) : {},
        context: entry.context,
        provider: entry.provider
      }));
    }

    if (entries.length === 0) {
      return jsonResponse({ error: 'No entries to export' }, { status: 404 });
    }

    // Generate content
    let content = `TAROT JOURNAL EXPORT\n`;
    content += `Generated: ${new Date().toISOString()}\n`;
    content += `Entries: ${entries.length}\n`;
    content += `\n${'='.repeat(50)}\n\n`;

    for (const entry of entries) {
      content += formatEntryAsText(entry);
    }

    if (format === 'pdf') {
      const { pdf, pageCount, truncated } = generatePDF(content);

      // Optionally store in R2 for caching
      const cacheKey = entryId
        ? `exports/readings/${user.id}/${entryId}.pdf`
        : `exports/journals/${user.id}/${Date.now()}.pdf`;

      if (shouldCache && env.LOGS_BUCKET) {
        try {
          const cacheTtlDays = 30;
          const expiresAt = new Date(Date.now() + cacheTtlDays * 24 * 60 * 60 * 1000).toISOString();
          await env.LOGS_BUCKET.put(cacheKey, pdf, {
            httpMetadata: {
              contentType: 'application/pdf',
              cacheControl: `private, max-age=${cacheTtlDays * 24 * 60 * 60}`
            },
            customMetadata: {
              userId: user.id,
              entryCount: entries.length.toString(),
              pageCount: pageCount.toString(),
              truncated: truncated.toString(),
              generatedAt: new Date().toISOString(),
              expiresAt,
              cacheTtlDays: cacheTtlDays.toString()
            }
          });
        } catch (err) {
          console.warn('Failed to cache PDF in R2:', err.message);
        }
      }

      const filename = entryId
        ? `tarot-reading-${entryId.slice(0, 8)}.pdf`
        : `tarot-journal-${new Date().toISOString().split('T')[0]}.pdf`;

      // Add warning header if content was truncated
      const headers = {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-PDF-Pages': pageCount.toString()
      };

      if (truncated) {
        headers['X-PDF-Truncated'] = 'true';
        headers['X-PDF-Warning'] = 'Content exceeded 20 pages and was truncated. Use format=txt for full export.';
      }

      return new Response(pdf, { headers });
    } else if (format === 'txt') {
      return new Response(content, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="tarot-journal.txt"`
        }
      });
    } else if (format === 'json') {
      return jsonResponse({
        exportedAt: new Date().toISOString(),
        entryCount: entries.length,
        entries
      });
    } else {
      return jsonResponse({ error: 'Invalid format. Use pdf, txt, or json.' }, { status: 400 });
    }
  } catch (error) {
    console.error('Journal export error:', error);
    return jsonResponse({ error: 'Export failed', message: error.message }, { status: 500 });
  }
}
