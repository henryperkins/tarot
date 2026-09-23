export function NarrativeQuestionAnchor({
  question,
  compact = false
}) {
  if (!question) return null;

  if (compact) {
    return (
      <div className="max-w-3xl mx-auto mt-3">
        <p className="text-sm text-accent/85 leading-relaxed [overflow-wrap:anywhere]">Anchor: <bdi>{question}</bdi></p>
      </div>
    );
  }

  return (
    <div className="bg-surface/85 rounded-lg px-3 xxs:px-4 py-3 border border-secondary/40">
      <p className="text-accent/85 text-xs sm:text-sm italic [overflow-wrap:anywhere]">Anchor: <bdi>{question}</bdi></p>
    </div>
  );
}
