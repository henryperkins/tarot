const TEMPLATE_BIAS_CLASS = {
  hopeful: 'narrative-atmosphere--bias-hopeful',
  encouraging: 'narrative-atmosphere--bias-hopeful',
  grounded: 'narrative-atmosphere--bias-grounded',
  transformative: 'narrative-atmosphere--bias-transformative',
  contemplative: 'narrative-atmosphere--bias-contemplative',
  'action-oriented': 'narrative-atmosphere--bias-action',
  clarifying: 'narrative-atmosphere--bias-clarifying',
  balanced: 'narrative-atmosphere--bias-balanced',
  neutral: 'narrative-atmosphere--bias-balanced'
};

const SUIT_CLASS = {
  wands: 'narrative-atmosphere--suit-wands',
  cups: 'narrative-atmosphere--suit-cups',
  swords: 'narrative-atmosphere--suit-swords',
  pentacles: 'narrative-atmosphere--suit-pentacles'
};

const PHASE_CLASS = {
  analyzing: 'narrative-atmosphere--phase-analyzing',
  drafting: 'narrative-atmosphere--phase-drafting',
  polishing: 'narrative-atmosphere--phase-polishing',
  complete: 'narrative-atmosphere--phase-complete'
};

export function getNarrativeBiasClass(templateBias) {
  if (typeof templateBias !== 'string') return '';
  const key = templateBias.trim().toLowerCase();
  return TEMPLATE_BIAS_CLASS[key] || '';
}

export function getNarrativeSuitClass(dominantSuit) {
  if (typeof dominantSuit !== 'string') return '';
  const key = dominantSuit.trim().toLowerCase();
  return SUIT_CLASS[key] || '';
}

export function getNarrativePhaseClass(phase) {
  if (typeof phase !== 'string') return '';
  const key = phase.trim().toLowerCase();
  return PHASE_CLASS[key] || '';
}
