#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

import { getRwsCardEvidence } from '../../shared/vision/rwsEvidenceOntology.js';

const DEFAULT_OUT = 'training/rws-grounding-dataset.jsonl';
const SEED_CARDS = [
  'The Fool',
  'The Magician',
  'The High Priestess',
  'Two of Swords',
  'Three of Swords',
  'Eight of Cups',
  'Five of Pentacles'
];

export function buildRwsGroundingRecordsForCard(cardName) {
  const card = getRwsCardEvidence(cardName);
  if (!card) return [];
  const symbols = card.visualSymbols || [];
  const primary = symbols[0] || null;
  return [
    {
      task_type: 'card_identification',
      deck: card.deck,
      card: card.card,
      target: {
        card: card.card,
        stableId: card.stableId,
        confidence_rationale: symbols.slice(0, 4).map((symbol) => symbol.label)
      }
    },
    ...symbols.slice(0, 6).map((symbol) => ({
      task_type: 'symbol_grounding',
      deck: card.deck,
      card: card.card,
      target: {
        label: symbol.symbol,
        location_text: symbol.location,
        literal_observation: symbol.literalObservation,
        symbolic_tags: symbol.symbolicMeaning
      }
    })),
    primary ? {
      task_type: 'tarot_vqa',
      deck: card.deck,
      card: card.card,
      question: `What does the ${primary.label} suggest in ${card.card}?`,
      answer: {
        literal: [primary.literalObservation],
        symbolic: primary.symbolicMeaning
      }
    } : null,
    {
      task_type: 'symbol_absence_check',
      deck: card.deck,
      card: card.card,
      question: `Is there a lion in ${card.card}?`,
      target: {
        answer: symbols.some((symbol) => /lion/i.test(symbol.label)) ? 'Yes.' : 'No.',
        visible_symbols: symbols.map((symbol) => symbol.label)
      }
    }
  ].filter(Boolean);
}

async function main() {
  const out = path.resolve(process.cwd(), process.argv[2] || DEFAULT_OUT);
  const records = SEED_CARDS.flatMap(buildRwsGroundingRecordsForCard);
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
  console.log(`Wrote ${records.length} RWS grounding records to ${out}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('RWS grounding dataset build failed:', error.message);
    process.exit(1);
  });
}
