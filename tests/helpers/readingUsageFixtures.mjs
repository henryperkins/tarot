import { buildEnhancedClaudePrompt } from '../../functions/lib/narrative/prompts/buildEnhancedClaudePrompt.js';
import { buildVisionEvidencePackets } from '../../functions/lib/visionEvidence.js';

// Real prompt assembly with invented, non-personal text. Keep UI fixtures on
// the same metadata contract as production instead of inventing telemetry codes.
const cardsInfo = [{ card: 'The Sun', number: 19, position: 'Theme', orientation: 'Upright', meaning: 'Warmth and renewal.' }];
const base = { spreadInfo: { key: 'single', name: 'One-Card Insight' }, cardsInfo, context: 'general' };
const visionInsights = [0.92, 0.4].map((confidence, index) => ({
  label: `image-${index}`, predictedCard: 'The Sun', matchesDrawnCard: true,
  confidence, promptEligible: confidence > 0.8, visualProfile: { tone: ['radiant'] },
  visualDetails: ['Flowers below the sun.']
}));

export function buildReadingUsageFixtures() {
  return {
    reference: buildEnhancedClaudePrompt({
      ...base, cardsInfo: [{ ...cardsInfo[0], userReflection: 'The flowers stand out.' }],
      userQuestion: 'What supports me today?', personalization: { readingTone: 'gentle', preferredSpreadDepth: 'standard' },
      graphRAGPayload: {
        passages: [{ title: 'The Sun', source: 'Tableu Tarot Canon', text: 'Warmth supports growth.' }],
        formattedBlock: '**Retrieved Wisdom from Tarot Tradition:**\n\n1. **The Sun**\n   Warmth supports growth.\n   — Tableu Tarot Canon',
        retrievalSummary: { passagesRetrieved: 1 }, initialPassageCount: 1, maxPassages: 1
      }
    }).promptMeta.sourceUsage,
    alternate: buildEnhancedClaudePrompt({
      ...base, visionInsights,
      visionEvidence: buildVisionEvidencePackets(visionInsights, cardsInfo, 'rws-1909')
    }).promptMeta.sourceUsage
  };
}
