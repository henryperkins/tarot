/**
 * KnowledgeGraphSection.jsx
 * Displays the pattern web / knowledge graph visualization.
 */
import { memo } from 'react';
import CardRelationshipGraph from '../../../charts/CardRelationshipGraph';
import { styles, cn } from '../EntryCard.primitives';

export const KnowledgeGraphSection = memo(function KnowledgeGraphSection({ cards, graphKeys }) {
  if (!graphKeys) return null;

  return (
    <section className={cn(styles.section, 'mt-4')}>
      <CardRelationshipGraph cards={cards} graphKeys={graphKeys} />
    </section>
  );
});
