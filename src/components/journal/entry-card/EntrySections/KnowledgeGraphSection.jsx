/**
 * KnowledgeGraphSection.jsx
 * The reading's pattern web: archetypal triads and dyads among its cards.
 */
import { memo, useId, useMemo } from 'react';
import { Graph } from '@phosphor-icons/react';
import CardRelationshipGraph from '../../../charts/CardRelationshipGraph';
import { resolvePatternWeb } from '../../../../lib/journal/patternWeb';
import { styles, cn } from '../EntryCard.primitives';

export const KnowledgeGraphSection = memo(function KnowledgeGraphSection({ cards, graphKeys, deckStyle }) {
  const headingId = useId();
  const web = useMemo(() => resolvePatternWeb(cards, graphKeys, deckStyle), [cards, graphKeys, deckStyle]);
  if (!web.triads.length && !web.dyads.length) return null;

  return (
    <section className={cn(styles.section, 'mt-4')} aria-labelledby={headingId}>
      <header className={styles.sectionHeader}>
        <div className="flex min-w-0 items-center gap-2">
          <Graph className={styles.sectionIcon} aria-hidden="true" />
          <div id={headingId} className={styles.sectionLabel}>Pattern web</div>
        </div>
      </header>
      <div className={styles.sectionBody}>
        <CardRelationshipGraph cards={cards} web={web} />
      </div>
    </section>
  );
});
