/**
 * How each spread shapes a coach question.
 *
 * The coach writes the question before any card is drawn, but each spread asks
 * something different of it: the Decision spread weighs two paths, and the
 * Relationship Snapshot holds you, them and the bond. The browser templates,
 * the Worker's local templates and the AI prompt all shape the question from
 * these profiles.
 *
 * Templates use {focus}, {timeframe} and {closing}. The timeframe and closing
 * carry their own leading space, or are empty.
 */
import { SPREADS } from '../../src/data/spreads.js';
import {
  RELATIONSHIP_SPREAD_CORE_POSITIONS,
  RELATIONSHIP_SPREAD_CLARIFIER_POSITIONS
} from '../contracts/spreadContracts.js';

const SPREAD_QUESTION_PROFILES = {
  single: {
    shortName: 'One-Card Insight',
    hint: 'One card speaks to the theme or guidance of this moment, so your question will follow a single, clear thread.',
    promptShape: 'Write one focused question with a single thread, so one card can answer it as the theme or guidance of the moment; do not stack several asks or compare options.',
    variants: {
      support: [
        'What one quiet need is asking for my care around {focus}{timeframe}',
        'What is the one gentle truth I need to hear about {focus}{timeframe}',
        'Where can I find one point of calm around {focus}{timeframe}',
        'What is the one energy to notice around {focus}{timeframe}, and how can I meet it{closing}'
      ],
      navigate: [
        'What single step matters most around {focus}{timeframe}, and how can I take it{closing}',
        'Which single priority deserves my energy around {focus}{timeframe}',
        'What one choice can I make{closing} about {focus}{timeframe}'
      ],
      lesson: [
        'What one lesson is waiting for me{timeframe} as I think about {focus}',
        'What is the one truth I most need to see about {focus}{timeframe}',
        'What single teaching is asking for my attention around {focus}{timeframe}'
      ],
      transform: [
        'What one pattern am I ready to release around {focus}{timeframe}{closing}',
        'What one story am I ready to rewrite about {focus}{timeframe}{closing}',
        'What one fear can I set down around {focus}{timeframe}{closing}',
        'Which single change in me is ready to unfold around {focus}{timeframe}'
      ]
    }
  },
  threeCard: {
    shortName: 'Three-Card Story',
    hint: 'Three cards read as a story: what led here, where you stand, and where the path is heading if nothing shifts. Your question will follow that arc.',
    promptShape: 'Shape one question as a story in three beats (what led here, where the querent stands, and where the path is heading if nothing shifts) so the Past, Present and Future cards each answer one beat. Frame the future as a trajectory the querent can still change, never a fixed fate.',
    variants: {
      support: [
        'What has shaped where I stand with {focus}, and where is my path gently leading{timeframe}',
        'How did I get here, where do I stand, and where am I heading{timeframe}, when it comes to {focus}',
        'What has brought me here with {focus}, and how can I meet what is unfolding{timeframe}{closing}'
      ],
      navigate: [
        'What led me here with {focus}, where is my path heading{timeframe}, and how can I steer it{closing}',
        'Where do I stand with {focus}, how did I arrive here, and how can I step forward{timeframe}{closing}',
        'How has my path unfolded with {focus}, and what step would shift where it is heading{timeframe}'
      ],
      lesson: [
        'What lesson links where I have been, where I stand and where I am heading with {focus}{timeframe}',
        'Which past lessons shape where I stand with {focus}, and where might those lessons lead me{timeframe}',
        'How has my path unfolded with {focus}, and what is it teaching me about where I am heading{timeframe}'
      ],
      transform: [
        'What am I outgrowing, what is taking root, and what could bloom{timeframe}, when it comes to {focus}',
        'What old story can I release around {focus}, and what is ready to begin{timeframe}',
        'What brought me here with {focus}, and what new chapter can I begin{timeframe}{closing}'
      ]
    }
  },
  fiveCard: {
    shortName: 'Five-Card Clarity',
    hint: 'Five cards circle the core of the matter: its challenge, a hidden influence, your support and the likely direction. Your question will ask what helps and what hinders.',
    promptShape: 'Ask one question about the core of the matter that leaves room for what challenges it, what hidden influence sits beneath it, what supports the querent, and where the current path is likely to lead. Let it name what helps and what hinders without becoming a list.',
    variants: {
      support: [
        'What is the core of the matter around {focus}, and what is quietly helping or hindering me{timeframe}',
        'What supports me and what tests me around {focus}{timeframe}, and how can I meet both{closing}',
        'What lies beneath how I feel about {focus}, and what lifts or weighs on me{timeframe}'
      ],
      navigate: [
        'What is the heart of the matter around {focus}, and what helps or hinders my way forward{timeframe}',
        'What is my main challenge around {focus}, and what support can I draw on{timeframe}{closing}',
        'What lies beneath my choices around {focus}{timeframe}, and how can I meet what hinders me{closing}'
      ],
      lesson: [
        'What is the core lesson around {focus}, and what helps or hinders me in learning it{timeframe}',
        'What is my challenge teaching me about {focus}, and what is quietly supporting me{timeframe}',
        'What is the hidden lesson around {focus}{timeframe}, and how do my challenges and supports point to it'
      ],
      transform: [
        'What core pattern is ready to shift around {focus}{timeframe}, and what helps or hinders it',
        'What hinders me around {focus}, and what support can help me change{timeframe}{closing}',
        'What hidden strength can help me release what holds me back around {focus}{timeframe}'
      ]
    }
  },
  decision: {
    shortName: 'Decision',
    hint: 'Two paths are read side by side, with the heart of the choice and your free will. Name both in “Add a detail” and your question will weigh them without choosing for you.',
    promptShape: 'Write one question that weighs both paths side by side without choosing for the querent, so the heart of the decision, each path’s energy and likely outcome, what clarifies, and free will can all answer. Name the options only in the querent’s own words; if they named none, say “each path” or “the two paths before me”, and never invent them.',
    variants: {
      support: [
        'What matters most to me around {focus}, and how does each path sit with me{timeframe}',
        'What energy does each path carry around {focus}{timeframe}, and what would steady me',
        'How can I hold both paths open around {focus}{timeframe}{closing}'
      ],
      navigate: [
        'Where is each path likely to lead when it comes to {focus}{timeframe}, and what is mine to decide',
        'What would clarify the path that fits me best around {focus}{timeframe}, so I can choose{closing}',
        'What might each path bring as I consider {focus}{timeframe}, and what can help me choose{closing}'
      ],
      lesson: [
        'What do I value most around {focus}{timeframe}, and how does each path honor it',
        'What can each path teach me about {focus}{timeframe}, and about myself',
        'What do the two paths before me reveal about my freedom to choose around {focus}{timeframe}'
      ],
      transform: [
        'What longing sits beneath this choice, and how might each path answer it{timeframe}, as I consider {focus}',
        'What am I ready to release around {focus}{timeframe}, so I can walk either path freely',
        'How might each path change me around {focus}{timeframe}, and what is mine to choose'
      ]
    }
  },
  relationship: {
    shortName: 'Relationship Snapshot',
    hint: 'Three cards hold you, them and the bond between you, and two clarifiers can follow if you ask. Your question will keep all three in view and center your own part.',
    promptShape: 'Center the three core positions (the querent, the other person and the bond between them) so the question stands even if neither optional clarifier is drawn; a person named in the focus is the other party, and any other focus is only the bond’s context, never the other party, with the other person left unnamed. Keep agency with the querent: ask what they can see, offer or tend, never what the other person secretly thinks, feels or will do, and never for a fixed outcome.',
    variants: {
      support: [
        'What am I bringing, what meets me, and what is alive between us{timeframe}, as I think about {focus}',
        'How are we each showing up, and what does our bond need{timeframe}, when I think of {focus}',
        'How can I hold the bond between us{timeframe}{closing}, as I think about {focus}'
      ],
      navigate: [
        'What is mine to give, mine to receive, and ours to shape{timeframe}, as I think about {focus}',
        'Where do we each stand{timeframe}, and what is mine to do{closing}, when I think of {focus}',
        'What boundary can I hold{closing}{timeframe} that honors us both, as I think about {focus}'
      ],
      lesson: [
        'What shared lesson is unfolding between us{timeframe}, as I think about {focus}',
        'What am I learning about myself, and about us{timeframe}, when I think of {focus}',
        'What is our bond mirroring back to me{timeframe}, as I think about {focus}'
      ],
      transform: [
        'What old pattern in how we relate am I ready to release{timeframe}, as I think about {focus}',
        'How might our bond evolve{timeframe}, and what is mine to change, when I think of {focus}',
        'How is the energy between us inviting change in me{timeframe}, as I think about {focus}'
      ]
    }
  },
  celtic: {
    shortName: 'Celtic Cross',
    hint: 'Ten cards lay out the fuller picture, from roots and hidden currents to hopes, fears and the likely path if unchanged. Your question will leave room for every layer.',
    promptShape: 'Ask one spacious question about the focus that opens the fuller, layered picture, so all ten positions can speak, from the present and its crossing challenge to hidden roots, outside influences, hopes and fears, and the likely path if unchanged. Keep it one question, not a checklist.',
    variants: {
      support: [
        'What is the fuller picture around {focus}{timeframe}, and how can I hold it{closing}',
        'What lies beneath the surface around {focus}{timeframe}, and what would steady me',
        'Which hopes and fears are stirring in me around {focus}{timeframe}, and how can I meet them'
      ],
      navigate: [
        'Where do I stand with {focus}, what is in my way, and where is my current path leading{timeframe}',
        'How do the many layers fit together around {focus}{timeframe}, and what step can I take{closing}',
        'What hidden currents shape my path with {focus}, and how can I steer it{timeframe}{closing}'
      ],
      lesson: [
        'What is the whole picture teaching me about {focus}{timeframe}',
        'What deeper story is unfolding around {focus}{timeframe}, from its roots to my hopes and fears',
        'What is stirring beneath my awareness around {focus}, and what is it teaching me{timeframe}'
      ],
      transform: [
        'What is ready to change, from the roots up, around {focus}{timeframe}{closing}',
        'What hidden pattern can I bring into the light around {focus}{timeframe}{closing}',
        'Which of my fears and hopes are ready to shift around {focus}{timeframe}'
      ]
    }
  }
};

// Replaces the generic "avoid listing options" rule for the Decision spread,
// which has to weigh two paths in a single question.
export const DECISION_QUESTION_INSTRUCTION = 'Avoid yes/no phrasing; one question may weigh two paths side by side, but name them only in the querent’s own words (otherwise say “each path”), and never invent options, choose for the querent or return a list.';

const PLACEHOLDER_PATTERN = /\{(focus|timeframe|closing)\}/g;

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function isKnownSpreadKey(spreadKey) {
  return typeof spreadKey === 'string'
    && hasOwn(SPREADS, spreadKey)
    && hasOwn(SPREAD_QUESTION_PROFILES, spreadKey);
}

/**
 * Canonical facts about a spread for shaping its question, or null for a
 * missing or unknown key. Unknown keys never fall back to a default spread;
 * callers keep their generic questions instead.
 *
 * @param {unknown} spreadKey
 * @returns {{ key: string, name: string, shortName: string, cardCount: number,
 *   corePositions: string[], optionalPositions: string[], hint: string,
 *   promptShape: string } | null}
 */
export function resolveSpreadQuestionContext(spreadKey) {
  if (!isKnownSpreadKey(spreadKey)) return null;
  const spread = SPREADS[spreadKey];
  const profile = SPREAD_QUESTION_PROFILES[spreadKey];
  // The Relationship Snapshot always deals its three core cards; the two
  // clarifiers are drawn only when the querent asks for them.
  const isRelationship = spreadKey === 'relationship';
  const corePositions = isRelationship
    ? [...RELATIONSHIP_SPREAD_CORE_POSITIONS]
    : [...spread.positions];
  const optionalPositions = isRelationship
    ? [...RELATIONSHIP_SPREAD_CLARIFIER_POSITIONS]
    : [];
  return {
    key: spreadKey,
    name: spread.name,
    shortName: profile.shortName,
    cardCount: corePositions.length,
    corePositions,
    optionalPositions,
    hint: profile.hint,
    promptShape: profile.promptShape
  };
}

/**
 * The spread's question templates for one depth pattern, filled in. Returns
 * null for an unknown spread or pattern so callers use their generic
 * templates.
 *
 * @param {unknown} spreadKey
 * @param {string} pattern - support, navigate, lesson or transform
 * @param {{ focus?: string, timeframeText?: string, closingSuffix?: string }} parts
 * @returns {string[] | null}
 */
export function buildSpreadQuestionVariants(spreadKey, pattern, { focus = '', timeframeText = '', closingSuffix = '' } = {}) {
  if (!isKnownSpreadKey(spreadKey)) return null;
  const { variants } = SPREAD_QUESTION_PROFILES[spreadKey];
  if (!hasOwn(variants, pattern)) return null;
  const parts = { focus, timeframe: timeframeText, closing: closingSuffix };
  // One pass with a replacer function, so placeholder-like or "$&" text in
  // the querent's own words is inserted literally.
  return variants[pattern].map(template => template
    .replace(PLACEHOLDER_PATTERN, (match, name) => parts[name])
    .replace(/\s+/g, ' ')
    .trim());
}
