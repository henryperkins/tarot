/**
 * QuestionSection.jsx
 * Displays the reading question in Cormorant Garamond italic style.
 */
import { memo } from 'react';
import { styles } from '../EntryCard.primitives';

export const QuestionSection = memo(function QuestionSection({ question }) {
  if (!question) return null;

  return (
    <section className={styles.section}>
      <header className={styles.sectionHeader}>
        <div className={styles.sectionLabel}>Question</div>
      </header>

      <div className={styles.sectionBody}>
        <p className="font-[Cormorant_Garamond] text-[18px] sm:text-[20px] leading-[1.35] text-[color:var(--text-main)] italic">
          &ldquo;{question}&rdquo;
        </p>
      </div>
    </section>
  );
});
