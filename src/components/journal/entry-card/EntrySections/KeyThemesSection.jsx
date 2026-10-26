/**
 * KeyThemesSection.jsx
 * Displays computed theme insights for the reading.
 */
import { memo } from 'react';
import { JournalThemesIcon } from '../../../JournalIcons';
import { styles, cn } from '../EntryCard.primitives';

export const KeyThemesSection = memo(function KeyThemesSection({ insights }) {
  if (!insights || insights.length === 0) return null;

  return (
    <section className={cn(styles.section, 'mt-4')}>
      <header className={styles.sectionHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <JournalThemesIcon className={styles.sectionIcon} aria-hidden="true" />
          <div className={styles.sectionLabel}>Key themes</div>
        </div>
      </header>

      <div className={styles.sectionBody}>
        <ul className="max-w-[34em] list-disc space-y-2 pl-5 marker:text-(--brand-primary)">
          {insights.map((line, idx) => (
            <li key={idx} className="text-sm leading-relaxed text-muted text-pretty">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
