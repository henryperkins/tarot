import { jsPDF } from 'jspdf';

function addWrappedText(doc, text, x, y, maxWidth, options = {}) {
  const {
    lineHeight = 14,
    topMargin = 48,
    bottomMargin = 48,
    paragraphGap = 6,
  } = options;

  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomY = pageHeight - bottomMargin;

  let cursorY = y;
  const raw = String(text ?? '');
  if (!raw) return cursorY;

  // Preserve explicit newlines while still wrapping long lines.
  const paragraphs = raw.split('\n');
  for (const paragraph of paragraphs) {
    if (cursorY > bottomY) {
      doc.addPage();
      cursorY = topMargin;
    }

    const trimmed = paragraph.replace(/\s+$/g, '');
    if (!trimmed) {
      cursorY += Math.round(lineHeight * 0.8);
      continue;
    }

    const lines = doc.splitTextToSize(trimmed, maxWidth);
    for (const line of lines) {
      if (cursorY > bottomY) {
        doc.addPage();
        cursorY = topMargin;
      }
      doc.text(String(line), x, cursorY);
      cursorY += lineHeight;
    }
    cursorY += paragraphGap;
  }

  return cursorY;
}

function drawContextBars(doc, contexts, startX, startY, width) {
  if (!Array.isArray(contexts) || contexts.length === 0) return startY;
  const maxCount = Math.max(...contexts.map((ctx) => ctx.count));
  const barHeight = 12;
  const gap = 10;
  let cursorY = startY;
  contexts.slice(0, 4).forEach((ctx) => {
    const barWidth = maxCount === 0 ? 0 : (ctx.count / maxCount) * width;
    doc.setFillColor(61, 190, 161);
    doc.rect(startX, cursorY, barWidth, barHeight, 'F');
    doc.text(`${ctx.name} (${ctx.count})`, startX + width + 6, cursorY + barHeight - 2);
    cursorY += barHeight + gap;
  });
  return cursorY;
}

/**
 * Export journal insights and entries to PDF.
 * @param {Object} stats - Journal statistics
 * @param {Array} entries - Journal entries to include
 * @param {Object} options - Export options
 * @param {string} options.scopeLabel - Human-readable scope label (e.g., "This month", "All time")
 */
export function exportJournalInsightsToPdf(stats, entries = [], options = {}) {
  if (!stats) return;
  const { scopeLabel } = options;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const margin = 48;
  const topMargin = margin;
  const bottomMargin = margin;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomY = pageHeight - bottomMargin;
  let cursorY = margin;

  const ensureSpace = (minSpace = 24) => {
    if (cursorY + minSpace <= bottomY) return;
    doc.addPage();
    cursorY = topMargin;
  };

  const normalizeNarrativeText = (value) => {
    if (!value || typeof value !== 'string') return '';
    const raw = value.trim();
    if (!raw) return '';

    // Collapse markdown-ish formatting into readable paragraphs.
    const paragraphs = raw.split(/\n\n+/g).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean);
    return paragraphs.join('\n\n');
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Tableu · Journal Export', margin, cursorY);
  cursorY += 28;

  // Show scope and entry count
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const scopeLine = scopeLabel
    ? `Scope: ${scopeLabel} · ${entries.length} entries`
    : `${entries.length} entries`;
  doc.text(scopeLine, margin, cursorY);
  cursorY += 16;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  cursorY = addWrappedText(
    doc,
    `Entries: ${stats.totalReadings} · Cards Logged: ${stats.totalCards} · Reversal Rate: ${stats.reversalRate}%`,
    margin,
    cursorY,
    520,
    { topMargin, bottomMargin }
  );
  cursorY += 8;

  if (stats.recentThemes?.length) {
    cursorY = addWrappedText(
      doc,
      `Themes whispering lately: ${stats.recentThemes.join(', ')}`,
      margin,
      cursorY,
      520,
      { topMargin, bottomMargin }
    );
    cursorY += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Context cadence', margin, cursorY + 16);
  doc.setDrawColor(90, 214, 189);
  doc.rect(margin, cursorY + 24, 250, 90);
  doc.setFont('helvetica', 'normal');
  cursorY = drawContextBars(doc, stats.contextBreakdown, margin + 6, cursorY + 30, 180) + 10;

  if (Array.isArray(entries) && entries.length) {
    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Entries', margin, cursorY);
    cursorY += 18;

    entries.forEach((entry, index) => {
      ensureSpace(40);

      const spreadName = entry?.spread || entry?.spreadName || 'Tarot Reading';
      const contextLabel = entry?.context || 'general';
      const dateLabel = entry?.ts ? new Date(entry.ts).toLocaleString() : '';

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(0, 0, 0);
      cursorY = addWrappedText(doc, `${index + 1}. ${spreadName}`, margin, cursorY, 520, { topMargin, bottomMargin, paragraphGap: 2 });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (dateLabel) {
        cursorY = addWrappedText(doc, `Date: ${dateLabel}`, margin, cursorY, 520, { topMargin, bottomMargin, paragraphGap: 2 });
      }
      cursorY = addWrappedText(doc, `Context: ${contextLabel}`, margin, cursorY, 520, { topMargin, bottomMargin, paragraphGap: 6 });

      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);

      if (entry?.question) {
        doc.setFont('helvetica', 'bold');
        ensureSpace(18);
        doc.text('Intention', margin, cursorY);
        cursorY += 14;
        doc.setFont('helvetica', 'normal');
        cursorY = addWrappedText(doc, String(entry.question), margin, cursorY, 520, { topMargin, bottomMargin });
      }

      const cards = Array.isArray(entry?.cards) ? entry.cards : [];
      if (cards.length) {
        doc.setFont('helvetica', 'bold');
        ensureSpace(18);
        doc.text('Cards', margin, cursorY);
        cursorY += 14;
        doc.setFont('helvetica', 'normal');
        const cardLine = cards
          .map((card) => {
            const position = card?.position ? `${card.position}: ` : '';
            const name = card?.name || card?.card || 'Unknown';
            const orientation = card?.orientation ? ` (${card.orientation})` : '';
            return `${position}${name}${orientation}`;
          })
          .join(' · ');
        cursorY = addWrappedText(doc, cardLine, margin, cursorY, 520, { topMargin, bottomMargin });
      }

      const narrativeText = normalizeNarrativeText(entry?.personalReading || entry?.reading || entry?.narrative || '');
      if (narrativeText) {
        doc.setFont('helvetica', 'bold');
        ensureSpace(18);
        doc.text('Reading', margin, cursorY);
        cursorY += 14;
        doc.setFont('helvetica', 'normal');
        cursorY = addWrappedText(doc, narrativeText, margin, cursorY, 520, { topMargin, bottomMargin });
      }

      const followUps = Array.isArray(entry?.followUps) ? entry.followUps : [];
      if (followUps.length) {
        doc.setFont('helvetica', 'bold');
        ensureSpace(18);
        doc.text('Follow-up conversation', margin, cursorY);
        cursorY += 14;
        doc.setFont('helvetica', 'normal');

        followUps.forEach((turn, turnIndex) => {
          const turnNumber = Number.isFinite(turn?.turnNumber) ? turn.turnNumber : (turnIndex + 1);
          const question = normalizeNarrativeText(turn?.question || '');
          const answer = normalizeNarrativeText(turn?.answer || '');
          if (!question && !answer) return;

          ensureSpace(36);
          doc.setFont('helvetica', 'bold');
          cursorY = addWrappedText(doc, `Turn ${turnNumber}`, margin, cursorY, 520, { topMargin, bottomMargin, paragraphGap: 2 });
          doc.setFont('helvetica', 'normal');
          if (question) {
            cursorY = addWrappedText(doc, `Q: ${question}`, margin, cursorY, 520, { topMargin, bottomMargin, paragraphGap: 2 });
          }
          if (answer) {
            cursorY = addWrappedText(doc, `A: ${answer}`, margin, cursorY, 520, { topMargin, bottomMargin });
          }
        });
      }

      // Divider
      ensureSpace(18);
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 16;
    });
  }

  doc.save('tableu-journal.pdf');
}
