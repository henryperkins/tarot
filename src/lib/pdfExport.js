import { jsPDF } from 'jspdf';

function addWrappedText(doc, text, x, y, maxWidth) {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * 14;
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

export function exportJournalInsightsToPdf(stats, entries = []) {
  if (!stats) return;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const margin = 48;
  let cursorY = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Mystic Tarot · Journal Snapshot', margin, cursorY);
  cursorY += 28;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  cursorY = addWrappedText(
    doc,
    `Entries: ${stats.totalReadings} · Cards Logged: ${stats.totalCards} · Reversal Rate: ${stats.reversalRate}%`,
    margin,
    cursorY,
    520
  );
  cursorY += 8;

  if (stats.recentThemes?.length) {
    cursorY = addWrappedText(doc, `Themes whispering lately: ${stats.recentThemes.join(', ')}`, margin, cursorY, 520);
    cursorY += 8;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Context cadence', margin, cursorY + 16);
  doc.setDrawColor(90, 214, 189);
  doc.rect(margin, cursorY + 24, 250, 90);
  doc.setFont('helvetica', 'normal');
  cursorY = drawContextBars(doc, stats.contextBreakdown, margin + 6, cursorY + 30, 180) + 10;

  const entrySnapshots = entries.slice(0, 4);
  if (entrySnapshots.length) {
    doc.setFont('helvetica', 'bold');
    doc.text('Highlighted entries', margin, cursorY);
    cursorY += 16;
    doc.setFont('helvetica', 'normal');
    entrySnapshots.forEach((entry, index) => {
      const title = `${index + 1}. ${entry.spread} (${entry.context || 'general'}) — ${new Date(entry.ts).toLocaleDateString()}`;
      cursorY = addWrappedText(doc, title, margin, cursorY, 520);
      if (entry.question) {
        cursorY = addWrappedText(doc, `Intention: ${entry.question}`, margin + 12, cursorY, 500);
      }
      const cardLine = (entry.cards || [])
        .slice(0, 5)
        .map((card) => `${card.position || card.name}: ${card.name}${card.orientation ? ` (${card.orientation})` : ''}`)
        .join(' · ');
      if (cardLine) {
        cursorY = addWrappedText(doc, `Cards: ${cardLine}`, margin + 12, cursorY, 500);
      }
      cursorY += 12;
      if (cursorY > 700) {
        doc.addPage();
        cursorY = margin;
      }
    });
  }

  doc.save('mystic-tarot-journal.pdf');
}

function buildSvg(stats) {
  const width = 640;
  const height = 360;
  const barWidth = 40;
  const gap = 20;
  const contexts = stats?.contextBreakdown?.slice(0, 5) || [];
  const maxCount = contexts.length ? Math.max(...contexts.map((ctx) => ctx.count)) : 1;
  const bars = contexts
    .map((ctx, index) => {
      const x = 80 + index * (barWidth + gap);
      const barHeight = maxCount === 0 ? 0 : (ctx.count / maxCount) * 160;
      const y = 260 - barHeight;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#50E3C2" rx="6" />
        <text x="${x + barWidth / 2}" y="280" text-anchor="middle" font-size="12" fill="#F9FAFB">${ctx.name}</text>
        <text x="${x + barWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="12" fill="#F9FAFB">${ctx.count}</text>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e1b4b" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)" rx="24" />
  <text x="50%" y="48" text-anchor="middle" font-size="24" font-weight="600" fill="#FDE68A">Mystic Tarot · Snapshot</text>
  <text x="50%" y="82" text-anchor="middle" font-size="14" fill="#E2E8F0">Entries: ${stats.totalReadings} · Cards: ${stats.totalCards} · Reversals: ${stats.reversalRate}%</text>
  <g>${bars}</g>
</svg>`;
}

export function downloadInsightsSvg(stats) {
  if (!stats || typeof document === 'undefined') return;
  const svgContent = buildSvg(stats);
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mystic-tarot-visual.svg';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
