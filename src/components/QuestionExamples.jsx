import { useRef, useState } from 'react';
import { ArrowsClockwise, Lightbulb } from '@phosphor-icons/react';
import { EXAMPLE_QUESTIONS } from '../data/exampleQuestions';
import { isExampleQuestion } from './questionField';

/**
 * QuestionExamples - puts an example question into the field as real text.
 *
 * Only offered while the field is empty or still holds an untouched example,
 * so it never replaces words the person wrote. Once inserted, the example can
 * be edited, swapped for another, or cleared.
 */
export function QuestionExamples({ value, onChange }) {
  const [nextIndex, setNextIndex] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const primaryRef = useRef(null);
  const trimmed = (value || '').trim();
  const holdsExample = isExampleQuestion(trimmed);

  if (trimmed && !holdsExample) return null;

  const insertExample = () => {
    let index = nextIndex % EXAMPLE_QUESTIONS.length;
    if (EXAMPLE_QUESTIONS[index] === trimmed) {
      index = (index + 1) % EXAMPLE_QUESTIONS.length;
    }
    const example = EXAMPLE_QUESTIONS[index];
    onChange(example);
    setNextIndex((index + 1) % EXAMPLE_QUESTIONS.length);
    setAnnouncement(`Example added: ${example}`);
  };

  const clearExample = () => {
    // Clear unmounts with the example; keep keyboard focus on the example button.
    primaryRef.current?.focus();
    onChange('');
    setAnnouncement('Example cleared.');
  };

  const ExampleIcon = holdsExample ? ArrowsClockwise : Lightbulb;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        ref={primaryRef}
        type="button"
        onClick={insertExample}
        className="inline-flex min-h-touch items-center gap-2 rounded-full border border-secondary/35 px-3 py-1.5 text-xs font-semibold text-secondary hover:text-main hover:border-secondary/50 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ExampleIcon className="w-3.5 h-3.5" aria-hidden="true" />
        {holdsExample ? 'Another example' : 'Try an example'}
      </button>
      {holdsExample && (
        <button
          type="button"
          onClick={clearExample}
          aria-label="Clear example"
          className="min-h-touch min-w-touch px-3 py-2 text-xs font-semibold text-secondary underline underline-offset-4 rounded-lg hover:bg-secondary/10 active:bg-secondary/20 transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Clear
        </button>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

export default QuestionExamples;
