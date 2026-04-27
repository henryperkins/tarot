import { canonicalizeCardName } from './cardNameMapping.js';

export const RWS_HARD_NEGATIVE_GROUPS = Object.freeze([
  {
    anchor: 'The High Priestess',
    positives: ['pillars', 'scroll', 'veil', 'crescent moon', 'lunar crown'],
    negatives: [
      {
        card: 'Justice',
        sharedFeatures: ['seated figure', 'pillars', 'frontal composition'],
        distinguishingFeatures: ['sword', 'scales', 'red robe']
      },
      {
        card: 'The Hierophant',
        sharedFeatures: ['pillars', 'religious authority'],
        distinguishingFeatures: ['raised hand', 'two acolytes', 'crossed keys']
      }
    ]
  },
  {
    anchor: 'The Sun',
    positives: ['sun', 'child', 'horse', 'sunflowers', 'banner'],
    negatives: [
      {
        card: 'Strength',
        sharedFeatures: ['yellow palette', 'warmth', 'lion'],
        distinguishingFeatures: ['woman and lion', 'infinity symbol', 'flower garland']
      },
      {
        card: 'The Fool',
        sharedFeatures: ['bright sky', 'sun', 'open landscape'],
        distinguishingFeatures: ['cliff edge', 'small dog', 'white rose', 'travel bundle']
      }
    ]
  },
  {
    anchor: 'Two of Swords',
    positives: ['blindfold', 'crossed swords', 'water', 'moon'],
    negatives: [
      {
        card: 'Eight of Swords',
        sharedFeatures: ['blindfold', 'swords', 'restriction'],
        distinguishingFeatures: ['bound figure', 'eight swords', 'muddy ground']
      },
      {
        card: 'Four of Swords',
        sharedFeatures: ['swords', 'stillness', 'pause'],
        distinguishingFeatures: ['tomb', 'recumbent figure', 'stained glass']
      }
    ]
  },
  {
    anchor: 'Queen of Cups',
    positives: ['ornate cup', 'throne', 'water', 'angels'],
    negatives: [
      {
        card: 'The High Priestess',
        sharedFeatures: ['seated feminine figure', 'intuition', 'water'],
        distinguishingFeatures: ['pillars', 'scroll', 'veil', 'crescent moon']
      },
      {
        card: 'Page of Cups',
        sharedFeatures: ['cup', 'water', 'emotional tone'],
        distinguishingFeatures: ['youthful page', 'fish in cup', 'standing figure']
      }
    ]
  },
  {
    anchor: 'The Fool',
    positives: ['cliff', 'dog', 'white rose', 'sun', 'bundle'],
    negatives: [
      {
        card: 'The Sun',
        sharedFeatures: ['sun', 'bright sky', 'open landscape'],
        distinguishingFeatures: ['child', 'horse', 'sunflowers', 'red banner']
      },
      {
        card: 'Strength',
        sharedFeatures: ['yellow palette', 'warmth', 'animal companion'],
        distinguishingFeatures: ['woman and lion', 'infinity symbol', 'flower garland']
      }
    ]
  }
]);

function canonicalKey(cardName) {
  const canonical = canonicalizeCardName(cardName, 'rws-1909') || cardName;
  return String(canonical || '').trim().toLowerCase();
}

export function getRwsHardNegatives(cardName) {
  const key = canonicalKey(cardName);
  const group = RWS_HARD_NEGATIVE_GROUPS.find((entry) => canonicalKey(entry.anchor) === key);
  return group ? group.negatives.map((entry) => ({ ...entry })) : [];
}
