/**
 * ReflectionsSection.jsx
 * Displays user reflections/notes for each card position.
 */
import { memo } from 'react';
import { styles, cn } from '../EntryCard.primitives';

export const ReflectionsSection = memo(function ReflectionsSection({ reflections, cards = [] }) {
  if (!reflections || reflections.length === 0) return null;

  return (
    <section className={cn(styles.section, 'mt-4')}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionLabel}>Reflections</div>
        <span className="text-xs text-muted">{reflections.length}</span>
      </header>

      <div className={styles.sectionBody}>
        <ul className="space-y-2">
          {reflections.map(([position, note], index) => {
            const card = /^\d+$/.test(position) ? cards[Number(position)] : null;
            const label = card
              ? [card.position, card.name].filter(Boolean).join(' — ')
              : position || `Note ${index + 1}`;
            return (
              <li
                key={`${position || 'reflection'}-${index}`}
                className="min-w-0 space-y-1 text-sm leading-relaxed"
              >
                <span className="block font-semibold text-main [overflow-wrap:anywhere]">
                  {label}
                </span>
                <span className="block whitespace-pre-wrap text-muted [overflow-wrap:anywhere]">{note}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
});
