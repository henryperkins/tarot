export function NarrativeQuestionAnchor({
  question,
  compact = false
}) {
  if (!question) return null;

  if (compact) {
    return (
      <div className="max-w-3xl mx-auto mt-3 rounded-lg border border-secondary/35 bg-surface/65 px-3 py-2">
        <p className="text-2xs uppercase tracking-[0.12em] text-muted/80">Anchor</p>
        <p dir="auto" className="text-xs text-accent/85 mt-1 leading-relaxed [overflow-wrap:anywhere]">{question}</p>
      </div>
    );
  }

  return (
    <div className="bg-surface/85 rounded-lg px-3 xxs:px-4 py-3 border border-secondary/40">
      <p className="text-accent/85 text-xs sm:text-sm italic [overflow-wrap:anywhere]">Anchor: <bdi>{question}</bdi></p>
    </div>
  );
}
