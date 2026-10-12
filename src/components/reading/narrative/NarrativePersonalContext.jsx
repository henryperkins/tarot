export function NarrativePersonalContext({ question, reflections, cards = [] }) {
  const notes = cards.filter(card => typeof reflections?.[card.index] === 'string' && reflections[card.index].trim());
  if (!question?.trim() && !notes.length) return null;
  return (
    <details className="reading-context mt-3 text-sm text-muted">
      <summary className="min-h-touch cursor-pointer py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary rounded-lg">Your question and notes</summary>
      <div className="space-y-4 pt-2 pb-3 text-base leading-relaxed [overflow-wrap:anywhere]">
        {question?.trim() ? <p className="whitespace-pre-wrap">{question}</p> : null}
        {notes.map(card => <div key={card.index}>
          <h3 className="text-sm font-semibold text-main">{card.name} · {card.positionLabel}{card.isReversed ? ' · Reversed' : ''}</h3>
          <p className="mt-1 whitespace-pre-wrap">{reflections[card.index]}</p>
        </div>)}
      </div>
    </details>
  );
}
