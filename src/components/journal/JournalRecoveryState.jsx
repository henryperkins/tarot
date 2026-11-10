import { OUTLINE_BUTTON_CLASS } from '../../styles/buttonClasses';

export function JournalRecoveryState({ cloud, onReload, loading }) {
  return (
    <section className="rounded-2xl border border-warning/30 bg-(--bg-surface) p-5 sm:p-6 space-y-3" aria-labelledby="journal-recovery-title">
      <h2 id="journal-recovery-title" className="font-serif text-xl text-main">Journal unavailable</h2>
      <p className="journal-prose text-muted-high">
        {cloud ? 'Your cloud journal could not be reached. Try again when you are connected.'
          : 'This browser could not read your saved journal. Its stored data has been kept; retry without clearing your site data.'}
      </p>
      <button type="button" onClick={onReload} disabled={loading} className={OUTLINE_BUTTON_CLASS}>
        {loading ? 'Retrying…' : 'Try again'}
      </button>
    </section>
  );
}
