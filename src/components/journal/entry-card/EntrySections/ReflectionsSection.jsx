/**
 * ReflectionsSection.jsx
 * Displays reflections labelled by card ("Past · The Hermit") or "Whole reading".
 */
import { memo } from 'react';
import { styles, cn } from '../EntryCard.primitives';

export const ReflectionsSection = memo(function ReflectionsSection({ reflections }) {
  if (!reflections || reflections.length === 0) return null;

  return (
    <section className={cn(styles.section, 'mt-4')}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionLabel}>Reflections</div>
        <span className="text-xs text-muted">{reflections.length}</span>
      </header>

      <div className={styles.sectionBody}>
        <ul className="space-y-2">
          {reflections.map(([label, note], index) => (
            <li
              key={`${label || 'reflection'}-${index}`}
              className="min-w-0 space-y-1 text-sm leading-relaxed"
            >
              <span className="block font-semibold text-main [overflow-wrap:anywhere]">
                {label || `Note ${index + 1}`}
              </span>
              <span className="block whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">{note}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
});
