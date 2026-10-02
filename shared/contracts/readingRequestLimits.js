// Bounds keep a single request from inflating the response past the 100,000
// character ceiling GPT Actions enforces. These strings are counted twice: once
// echoed back in `cardsInfo`, and again inside the assembled prompt that
// promptDebug can return. Sized so the largest spread (10 cards) at every
// maximum still leaves ~30% headroom — see the end-to-end size test in
// tests/promptDebugHardening.test.mjs. Real values are far smaller: deck
// meanings run ~100 characters. Keep these UI limits independent of validation.
export const CARD_MEANING_MAX_LENGTH = 1000;
export const CARD_REFLECTION_MAX_LENGTH = 2000;
export const USER_QUESTION_MAX_LENGTH = 2000;
export const REFLECTIONS_TEXT_MAX_LENGTH = 5000;
// A reading cannot contain more cards than exist in the deck (78).
export const MAXIMUM_CARD_COUNT = 78;
