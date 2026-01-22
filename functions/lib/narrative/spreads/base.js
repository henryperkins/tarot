import { buildOpening, buildReflectionsSection } from '../helpers.js';
import { buildPersonalizedClosing } from '../styleHelpers.js';

export function buildSpreadFallback({
  spreadName,
  expectedCount,
  receivedCount,
  reason
} = {}) {
  const title = spreadName ? `${spreadName} — Quick Reset` : 'Reading — Quick Reset';
  const spreadLabel = spreadName ? `the ${spreadName} spread` : 'this spread';
  const countNote = Number.isFinite(expectedCount) && Number.isFinite(receivedCount)
    ? `Expected ${expectedCount} cards, received ${receivedCount}.`
    : null;
  const reasonNote = reason || null;

  return [
    `### ${title}`,
    '',
    `I couldn't complete ${spreadLabel} because the card data was incomplete.`,
    countNote,
    reasonNote,
    'Please redraw the cards and try again. If this keeps happening, refresh the app or check your connection.'
  ].filter(Boolean).join('\n');
}

export class BaseSpreadBuilder {
  constructor(options = {}) {
    this.options = options;
  }

  buildOpening(spreadName, userQuestion, context) {
    return buildOpening(spreadName, userQuestion, context, { personalization: this.options.personalization });
  }

  buildReflections(reflectionsText) {
    return buildReflectionsSection(reflectionsText);
  }

  buildClosing() {
    return buildPersonalizedClosing(this.options.personalization);
  }

  buildNarrative(payload) {
    throw new Error('buildNarrative must be implemented by subclass');
  }
}
