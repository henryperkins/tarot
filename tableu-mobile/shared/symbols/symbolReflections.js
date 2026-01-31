// symbolReflections.js
// Reflective questions for contemplation and journaling
// Organized by symbol family for reuse across cards

/**
 * Get reflective questions for a symbol
 * Returns 2-3 questions for contemplation
 */
export function getReflections(symbolName) {
  const normalized = symbolName.toLowerCase();

  // Check for exact match first, then partial matches
  for (const [key, questions] of Object.entries(SYMBOL_REFLECTIONS)) {
    if (normalized === key || normalized.includes(key) || key.includes(normalized)) {
      return questions;
    }
  }

  return null;
}

/**
 * Get a single random reflection for display
 */
export function getRandomReflection(symbolName) {
  const reflections = getReflections(symbolName);
  if (!reflections || reflections.length === 0) return null;
  return reflections[Math.floor(Math.random() * reflections.length)];
}

// Reflective questions organized by symbol
const SYMBOL_REFLECTIONS = {
  // Celestial
  sun: [
    'What area of your life needs more light and attention?',
    'When do you feel most alive and radiant?',
    'What truth is becoming clearer to you now?'
  ],
  moon: [
    'What fears or illusions might be distorting your view?',
    'What is your intuition trying to tell you?',
    'What cycles are you moving through right now?'
  ],
  star: [
    'What gives you hope when times are dark?',
    'How do you reconnect with your sense of purpose?',
    'What wound is ready to be healed?'
  ],

  // Elements
  water: [
    'What emotions are flowing through you right now?',
    'Where do you need to go with the flow?',
    'What lies beneath the surface of your awareness?'
  ],
  fire: [
    'What passion is burning within you?',
    'What needs to be transformed or released?',
    'Where is your energy being directed?'
  ],
  mountain: [
    'What challenge have you already overcome?',
    'What obstacle feels insurmountable right now?',
    'What would the view look like from the summit?'
  ],

  // Flora
  rose: [
    'Where is beauty emerging from difficulty?',
    'What are you cultivating with patience?',
    'How do you balance vulnerability with protection?'
  ],
  lily: [
    'Where do you need more purity of intention?',
    'What wisdom is quietly growing within you?',
    'How can you bring more peace to this situation?'
  ],
  flower: [
    'What is blossoming in your life right now?',
    'How are you nurturing your own growth?',
    'What beauty might you be overlooking?'
  ],
  sunflower: [
    'What are you turning toward for nourishment?',
    'How do you stay oriented toward positivity?',
    'What brings you genuine joy and vitality?'
  ],
  wheat: [
    'What seeds have you planted that are now ready to harvest?',
    'How are you being nourished and sustained?',
    'What abundance already surrounds you?'
  ],

  // Creatures
  lion: [
    'How do you relate to your own strength and power?',
    'What wild part of yourself needs gentle attention?',
    'Where might courage serve you better than force?'
  ],
  dog: [
    'Who or what is faithfully accompanying you?',
    'What instincts are trying to warn or guide you?',
    'How do you honor loyalty in your relationships?'
  ],
  sphinx: [
    'What riddle or mystery is asking to be solved?',
    'How do you balance knowledge with mystery?',
    'What ancient wisdom might apply to your situation?'
  ],
  serpent: [
    'What transformation is calling you?',
    'Where might wisdom come from unexpected places?',
    'What old skin are you ready to shed?'
  ],
  dove: [
    'Where is peace trying to enter your life?',
    'What message from your higher self awaits?',
    'How can you create more harmony in this situation?'
  ],

  // Figures
  angel: [
    'What guidance might you be receiving right now?',
    'How do you connect with something larger than yourself?',
    'What blessing is present that you haven\'t noticed?'
  ],

  // Objects
  wand: [
    'What creative project is calling for your energy?',
    'How are you directing your willpower?',
    'What action wants to be taken?'
  ],
  cup: [
    'What emotional need is seeking attention?',
    'How full or empty is your inner cup right now?',
    'What relationship deserves more presence?'
  ],
  sword: [
    'What truth needs to be spoken or acknowledged?',
    'Where might clarity cut through confusion?',
    'What decision have you been avoiding?'
  ],
  pentacle: [
    'What practical step would ground your vision?',
    'How is your relationship with material resources?',
    'What investment of time or energy will pay off?'
  ],

  // Structures
  tower: [
    'What structure in your life is no longer serving you?',
    'How do you respond when plans collapse?',
    'What might be revealed when the walls come down?'
  ],
  pillar: [
    'What dualities are you balancing?',
    'What supports the structure of your life?',
    'How do you find stability between opposites?'
  ],
  castle: [
    'What are you building toward?',
    'How do you protect what matters most?',
    'What goal feels distant but achievable?'
  ],
  cliff: [
    'What edge are you standing on right now?',
    'What would it take to trust the next step?',
    'When has a leap of faith paid off for you?'
  ],

  // Symbols
  infinity: [
    'What patterns keep repeating in your life?',
    'How do you connect with the eternal within you?',
    'What feels truly limitless about your potential?'
  ],
  scale: [
    'Where is balance needed in your life?',
    'What decision requires careful weighing?',
    'How do you honor fairness in your choices?'
  ],
  wheel: [
    'What cycle are you in right now?',
    'How do you stay centered when circumstances change?',
    'What is rising as something else falls away?'
  ],
  key: [
    'What door is waiting to be unlocked?',
    'What knowledge do you already have that can help?',
    'What access are you seeking?'
  ],
  crown: [
    'How do you claim your own authority?',
    'What mastery have you earned through experience?',
    'What responsibility comes with your power?'
  ],
  halo: [
    'What insight has come through surrender?',
    'How has a difficult perspective shift served you?',
    'What spiritual truth is illuminating your path?'
  ],
  lantern: [
    'What inner light guides you through uncertainty?',
    'How do you find your way when the path is unclear?',
    'What wisdom can you share with others?'
  ],
  chain: [
    'What keeps you bound that you could actually release?',
    'Where have you given away your power?',
    'What would freedom look like for you?'
  ],
  lightning: [
    'What sudden realization is trying to break through?',
    'How do you handle unexpected disruption?',
    'What false belief is ready to be shattered?'
  ],

  // Body/Actions
  hand: [
    'What is being offered to you right now?',
    'What are you reaching for?',
    'How are you using your ability to give and receive?'
  ],
  path: [
    'What journey are you on?',
    'What next step feels right, even if uncertain?',
    'How do you navigate when the way forward is unclear?'
  ],
  dance: [
    'How do you celebrate your accomplishments?',
    'What would it mean to fully embrace this moment?',
    'How integrated do you feel within yourself?'
  ],

  // States
  blindfold: [
    'What are you choosing not to see?',
    'Where might intuition serve better than analysis?',
    'What would change if you removed your blinders?'
  ],

  // Miscellaneous
  rainbow: [
    'What promise or hope sustains you?',
    'How do you integrate all aspects of yourself?',
    'What blessing follows the storm you\'ve weathered?'
  ],
  bridge: [
    'What transition are you making?',
    'How do you move from where you are to where you want to be?',
    'What connects your past to your future?'
  ],
  scroll: [
    'What hidden knowledge awaits your discovery?',
    'What teachings are you ready to receive?',
    'How do you honor wisdom traditions?'
  ],
  veil: [
    'What mystery lies just beyond your current understanding?',
    'What separates your conscious from unconscious mind?',
    'What would be revealed if the veil lifted?'
  ]
};

export { SYMBOL_REFLECTIONS };
