/**
 * KeyThemesSection.jsx
 * Displays computed theme insights for the reading.
 */
import { memo } from 'react';
import { JournalBookIcon } from '../../../JournalIcons';
import { styles, cn } from '../EntryCard.primitives';

export const KeyThemesSection = memo(function KeyThemesSection({ insights }) {
  if (!insights || insights.length === 0) return null;

  return (
    <section className={cn(styles.section, 'mt-4')}>
      <header className={styles.sectionHeader}>
        <div className="flex items-center gap-2">
          <JournalBookIcon className="h-4 w-4 text-[color:var(--brand-primary)]" aria-hidden="true" />
          <div className={styles.sectionLabel}>Key themes</div>
        </div>
      </header>

      <div className={styles.sectionBody}>
        <ul className="space-y-2">
          {insights.map((line, idx) => (
            <li key={idx} className="text-[14px] leading-relaxed text-[color:var(--text-muted)]">
              <span className="mr-2 text-[color:var(--brand-primary)]">•</span>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
