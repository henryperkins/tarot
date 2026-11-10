import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { SpreadTable } from '../../src/components/SpreadTable.jsx';
import { MAJOR_ARCANA } from '../../src/data/majorArcana.js';
import '../../src/styles/reading-table.css';

export function mountDisabledReadingTable() {
  const host = document.createElement('div');
  host.className = 'reading-table';
  document.body.appendChild(host);
  createRoot(host).render(createElement(SpreadTable, {
    spreadKey: 'single',
    cards: [MAJOR_ARCANA[0]],
    disableReveal: true,
    readingTable: true,
    hideLegend: true,
    showProgress: false,
    showTactileLens: false,
    cardsOnly: true
  }));
}
