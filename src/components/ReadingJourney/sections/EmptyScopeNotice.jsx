export default function EmptyScopeNotice({ onScopeSelect }) {
  return <div className="space-y-2 text-sm text-muted-high">
    <p>No readings in this scope. Your saved readings are still in your journal.</p>
    {onScopeSelect && <button type="button" onClick={() => onScopeSelect('all')}
      className="min-h-touch font-semibold text-main underline underline-offset-2 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color)">
      View all time
    </button>}
  </div>;
}
