import { useSettledValue } from '../hooks/useSettledValue';
import { QUESTION_NUDGES } from './questionField';

/**
 * QuestionNudge - one ungraded line when the phrasing is hard to read for,
 * such as a yes-or-no question, with a way into the guided coach.
 *
 * The parent passes the nudge kind from getQuestionNudge and adds `id` to the
 * field's aria-describedby while it shows. The live region stays mounted so a
 * nudge that appears is spoken once the person pauses typing.
 */
export function QuestionNudge({ id, kind, onOpenCoach }) {
  const message = kind ? QUESTION_NUDGES[kind] || '' : '';
  const announcement = useSettledValue(message);

  return (
    <>
      {message && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p id={id} className="min-w-0 text-xs text-muted text-pretty">
            {message}
          </p>
          {typeof onOpenCoach === 'function' && (
            <button
              type="button"
              onClick={onOpenCoach}
              aria-haspopup="dialog"
              className="min-h-touch text-xs font-semibold text-secondary underline underline-offset-4 rounded-lg hover:text-main transition touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Shape it with the coach
            </button>
          )}
        </div>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </>
  );
}

export default QuestionNudge;
