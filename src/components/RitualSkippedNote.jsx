import { useEffect, useId, useRef, useState } from 'react';
import { CloseButton } from './CloseButton';

export const RITUAL_NOTE_ID = 'ritual-skipped-note';

/**
 * What the Ritual step opens once the ritual has been skipped: a short note in
 * the canvas, under the progress thread. It says the reading is unaffected and
 * how to have the ritual next time. It is not an error and not a dialog: the
 * reading stays in view and in reach.
 *
 * Three cases share it:
 *  - ritual steps hidden, nothing dealt yet: bringing them back restores the
 *    ritual for the reading on the table;
 *  - ritual steps hidden, cards dealt: bringing them back applies next time;
 *  - cards dealt without a knock or a cut: the ritual is already offered at
 *    every table, so there is nothing to switch on.
 */
export function RitualSkippedNote({ ritualHidden, isDealt, onUseRitual, onClose }) {
  const noteRef = useRef(null);
  const titleId = useId();
  const bodyId = useId();
  const aboutId = useId();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [restored, setRestored] = useState(false);

  // Opened from a step several controls away: bring focus to the note, so a
  // keyboard or screen-reader user arrives at what their choice opened.
  useEffect(() => {
    const note = noteRef.current;
    if (!note) return;
    note.focus({ preventScroll: true });
    note.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const useRitual = () => {
    // Its button leaves with the hidden state, so focus stays on the note.
    if (isDealt) {
      setRestored(true);
      noteRef.current?.focus({ preventScroll: true });
    }
    onUseRitual?.();
  };

  const title = isDealt ? 'Ritual skipped for this reading' : 'Ritual steps are hidden';
  const body = !isDealt
    ? 'The deck goes straight to Deal. Bring the ritual back to knock on the deck and cut it before your cards are dealt.'
    : ritualHidden
      ? 'Your reading continues as usual. Ritual steps are hidden, so the deck went straight to Deal.'
      : 'Your reading continues as usual. The ritual will be waiting at the table next time, before you deal.';

  return (
    <div
      ref={noteRef}
      id={RITUAL_NOTE_ID}
      className="ritual-note"
      role="group"
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
    >
      <div className="ritual-note__text">
        <h2 id={titleId} className="ritual-note__title">{title}</h2>
        <p id={bodyId}>{body}</p>
        <p role="status" className="ritual-note__status">{restored ? 'Ritual steps are back on.' : ''}</p>
        {aboutOpen && (
          <p id={aboutId} className="ritual-note__about">
            Before the cards are dealt, you can knock three times on the deck and cut it where it feels right.
            Your question, the timing of your knocks and where you cut together set the shuffle.
            It is a moment to arrive, not a requirement: a reading without it is just as complete.
          </p>
        )}
        <div className="ritual-note__actions">
          {ritualHidden && (
            <button type="button" className="ritual-note__action ritual-note__action--primary" onClick={useRitual}>
              {isDealt ? 'Use ritual next time' : 'Bring the ritual back'}
            </button>
          )}
          <button
            type="button"
            className="ritual-note__action"
            aria-expanded={aboutOpen}
            aria-controls={aboutOpen ? aboutId : undefined}
            onClick={() => setAboutOpen(open => !open)}
          >
            Learn about the ritual
          </button>
        </div>
      </div>
      <CloseButton label="Close ritual note" size="sm" className="ritual-note__close" onClick={onClose} />
    </div>
  );
}
