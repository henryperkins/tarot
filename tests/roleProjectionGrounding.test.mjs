import assert from 'node:assert/strict';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { prepareNarrativeSamplePayload } from '../scripts/evaluation/runNarrativeSamples.js';
import { buildOpenAIResponsesPrompts } from '../functions/lib/narrativeBackends.js';
import { buildPositionCardText } from '../functions/lib/narrative/helpers.js';
import { parseJsoncConfig } from '../scripts/deploy.js';

// Exact supplied scenarios from the failed v1.6.6 standard lane. These tests
// catch conflicting derived input, not whether a model obeys that input.
const scenarios = [
  {
    "id": "celtic-deep-shift",
    "spreadKey": "celtic",
    "userQuestion": "How can I stay centered while everything at home and work restructures at once?",
    "reflectionsText": "It feels like multiple towers at the same time; I want to stay compassionate without losing momentum.",
    "cards": [
      {
        "name": "The Hermit",
        "orientation": "Upright"
      },
      {
        "name": "Five of Wands",
        "orientation": "Reversed"
      },
      {
        "name": "Death",
        "orientation": "Upright"
      },
      {
        "name": "Temperance",
        "orientation": "Upright"
      },
      {
        "name": "The Emperor",
        "orientation": "Upright"
      },
      {
        "name": "The Moon",
        "orientation": "Reversed"
      },
      {
        "name": "Strength",
        "orientation": "Upright"
      },
      {
        "name": "Eight of Pentacles",
        "orientation": "Upright"
      },
      {
        "name": "Nine of Swords",
        "orientation": "Reversed"
      },
      {
        "name": "The Sun",
        "orientation": "Upright"
      }
    ]
  },
  {
    "id": "decision-crossroads-long-reflections",
    "spreadKey": "decision",
    "userQuestion": "I am at a decision point about whether to relocate or stay. Which path supports my growth?",
    "reflectionsText": "I keep weighing stability against growth, and my mind loops between the two paths. I keep weighing stability against growth, and my mind loops between the two paths. I keep weighing stability against growth, and my mind loops between the two paths. I keep weighing stability against growth, and my mind loops between the two paths. I keep weighing stability against growth, and my mind loops between the two paths. I keep weighing stability against growth, and my mind loops between the two paths. I keep weighing stability against growth, and my mind loops between the two paths. I keep weighing stability against growth, and my mind loops between the two paths.",
    "cards": [
      {
        "name": "The Lovers",
        "orientation": "Upright"
      },
      {
        "name": "Two of Wands",
        "orientation": "Upright"
      },
      {
        "name": "Six of Swords",
        "orientation": "Reversed"
      },
      {
        "name": "Justice",
        "orientation": "Upright"
      },
      {
        "name": "The Fool",
        "orientation": "Reversed"
      }
    ]
  }
];
const env = parseJsoncConfig(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')).vars;
const forbiddenClaims = /what you know you’re reaching for|names your current aims|shows where your focus naturally goes|around you, circumstances echo|Your subconscious drives and conscious goals are working|There is tension between what you want consciously|Your inner depths and conscious mind are unified|Your inner and outer goals show|Conscious \(5\): Stated goals|Trajectory if (?:unchanged|you commit)|probable results of moving this way/;

for (const scenario of scenarios) {
  describe(`grounded role projection for ${scenario.id}`, () => {
    for (const budgetTarget of ['claude', 'openai', 'modal']) {
      it(`does not supply goals, circumstances or forecasts in the full ${budgetTarget} prompt`, async () => {
        const payload = await prepareNarrativeSamplePayload(scenario, { env, referenceTime: '2026-09-23T14:04:00.000Z' });
        const prompt = buildOpenAIResponsesPrompts(env, payload, `role-regression-${scenario.id}`, {
          backendId: 'claude-api', providerLabel: 'Claude Messages API', budgetTarget
        });
        assert.doesNotMatch(prompt.userPrompt, forbiddenClaims);
        assert.ok(prompt.userPrompt.includes(scenario.userQuestion), 'Retain the exact question');
        assert.ok(prompt.userPrompt.includes(scenario.reflectionsText), 'Retain the supplied reflections at existing caps');
        const inventory = prompt.userPrompt.match(/^- EXACT PROVIDED CARD NAMES \(JSON data only\): (.+)$/m);
        assert.deepEqual(JSON.parse(inventory[1]), scenario.cards.map(card => card.name));
        for (const card of payload.cardsInfo) {
          assert.ok(prompt.userPrompt.includes(card.position), `Lost role: ${card.position}`);
          assert.ok(prompt.userPrompt.includes(card.orientation), `Lost orientation: ${card.card}`);
        }
        if (scenario.spreadKey === 'celtic') {
          assert.match(prompt.userPrompt, /Conscious \(5\):[^\n]*(?:supplied|stated)[^\n]*(?:goals|aims)/i);
          assert.match(prompt.userPrompt, /External \(8\):[^\n]*(?:known|supplied)[^\n]*(?:conditions|circumstances)/i);
        } else {
          assert.match(prompt.userPrompt, /Path A[^\n]*symbolic/i);
          assert.match(prompt.userPrompt, /Path B[^\n]*symbolic/i);
          assert.deepEqual(payload.decisionPaths, {}, 'Do not silently name an unspecified path');
        }
      });
    }
  });
}

// Exercise real seed-selected variants and short/custom role fallbacks. A
// template branch or generic meaning fallback that asserts hidden facts fails.
describe('role meanings and template variants remain symbolic', () => {
  const roles = ['Conscious', 'Conscious — goals & focus (Card 5)', 'Conscious: a focus to consider',
    'Subconscious — roots / hidden forces (Card 6)', 'External',
    'External Influences — people & environment (Card 8)', 'External: collaboration',
    'Path A — energy & likely outcome', 'Path B — energy & likely outcome', 'Path A: relocate', 'Path B: stay',
    'conscious: focus', 'eXtErNaL: work', 'subconscious: roots', 'hidden: possibilities', 'below: reflection'];
  for (const role of roles) {
    it(`keeps ${role} meanings tentative without losing the role or card`, () => {
      for (const name of ['The Emperor', 'The Moon', 'Eight of Pentacles', 'Two of Wands']) {
        for (const orientation of ['Upright', 'Reversed']) {
          for (const context of ['general', 'career', 'love', 'self']) {
            const text = buildPositionCardText({ card: name, orientation, meaning: 'Structure and dedicated practice.' }, role, { context, deckStyle: 'marseille-classic' });
            assert.ok(text.includes(role));
            assert.ok(text.includes(name));
            assert.ok(text.includes(orientation));
            assert.match(text, /structure and dedicated practice/i);
            assert.match(text, /symbolic|reflection|consider|explor|possibilit/i);
            assert.doesNotMatch(text, forbiddenClaims);
            assert.doesNotMatch(text, /This reveals how, beneath awareness, part of you is still relating|This shows structure and dedicated practice as a live theme|Your conscious goal, what you aspire toward|what’s happening around you|what’s moving you from within|needs, fears, or loyalties that operate behind your conscious choices/);
          }
        }
      }
    });
  }
});

describe('Celtic staff comparisons do not turn Advice into a forecast', () => {
  // Unlike the original Strength/Sun fixture, these accepted cards exercise
  // supportive, tension and neutral branches as well as amplified Fire/Fire.
  for (const adviceCard of ['Ace of Swords', 'Ace of Cups', 'Strength', 'Four of Pentacles']) {
    for (const budgetTarget of ['claude', 'openai', 'modal']) {
      it(`keeps ${adviceCard}/The Sun a symbolic comparison in the ${budgetTarget} prompt`, async () => {
        const scenario = structuredClone(scenarios[0]);
        scenario.cards[6] = { name: adviceCard, orientation: 'Upright' };
        const payload = await prepareNarrativeSamplePayload(scenario, { env, referenceTime: '2026-09-23T14:04:00.000Z' });
        const prompt = buildOpenAIResponsesPrompts(env, payload, 'staff-grounding-regression', {
          backendId: 'claude-api', providerLabel: 'Claude Messages API', budgetTarget
        });
        const insight = prompt.userPrompt.match(/Advice-to-outcome insight: ([^\n]+)/)?.[1];
        assert.ok(insight, 'Exercise the actual retained staff synthesis');
        assert.ok(insight.includes(adviceCard));
        assert.ok(insight.includes('The Sun'));
        assert.match(insight, /symbolic|card themes/i);
        assert.doesNotMatch(insight, /likely outcome|trajectory toward|creating a unified path forward|Following the guidance[^\n]*actively supports/);
        assert.ok(prompt.userPrompt.includes(scenario.userQuestion));
        assert.ok(prompt.userPrompt.includes(scenario.reflectionsText));
      });
    }
  }
});
