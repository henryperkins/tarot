export function NarrativeQuestionAnchor({
  question,
  compact = false,
  className = ''
}) {
  if (!question) return null;

  // Matches the journal's editorial treatment of a reading's question.
  return (
    <div className={className}>
      <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-muted">Your question</p>
      <p className={`mt-1.5 font-serif italic leading-snug text-main [overflow-wrap:anywhere] ${compact ? 'text-base' : 'text-lg'}`}>
        &ldquo;<bdi>{question}</bdi>&rdquo;
      </p>
    </div>
  );
}
