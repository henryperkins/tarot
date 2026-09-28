import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';

// One voice and one set of behaviours for the question field on every
// surface: the phone card, its landscape bar, and the desktop panel.
export const QUESTION_PROMPT = 'What would you like to understand?';
export const QUESTION_HELPER = 'Optional. How and what questions work best.';
// An instruction, never a sample question: a sample in the empty field reads
// as if a question were already set.
export const QUESTION_PLACEHOLDER = 'In your own words…';

// Ungraded guidance for phrasing a reading cannot answer well; see
// getQuestionNudge in lib/questionQuality.
export const QUESTION_NUDGES = {
  closed: 'This reads as a yes-or-no question. Asking how or what gives you more to reflect on.',
  'fixed-outcome': 'A reading can’t promise an outcome. Asking what you can understand or change gives you more to work with.'
};

export function getQuestionPrompt(displayName) {
  const name = typeof displayName === 'string' ? displayName.trim() : '';
  return name ? `What would you like to understand, ${name}?` : QUESTION_PROMPT;
}

// True while the field still holds an example exactly as it was inserted.
export function isExampleQuestion(value) {
  return typeof value === 'string' && EXAMPLE_QUESTIONS.includes(value.trim());
}

// Enter finishes the question and Shift+Enter adds a line. Enter also confirms
// an IME composition (Japanese, Chinese, Korean); that keystroke belongs to the
// input method, not to "done".
export function handleQuestionFieldKeyDown(event, onDone) {
  if (event.nativeEvent?.isComposing || event.keyCode === 229) return;
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (typeof onDone === 'function') {
      onDone(event);
    } else {
      event.target.blur();
    }
  }
}
