import { useState } from 'react';
import { useJournal } from '../hooks/useJournal';
import { JournalEntryCard } from './journal/entry-card/JournalEntryCard';
import { publicVisualSnapshot } from '../lib/readingVisualStorage';
import star from '../../output/reading-motion/fixtures/three-card-transition.json';

const binding = { readingResultId: 'controlled-journal-star', sourceRevision: 0,
  spreadHash: 'a'.repeat(64), contextHash: 'b'.repeat(64),
  artworkEdition: 'rws-immanuelle-vector', catalogVersion: 'controlled-journal-v1' };

/** Development-only harness; uses the actual journal storage and renderer. */
export default function JournalVisualFixture() {
  const journal = useJournal();
  const [saved, setSaved] = useState(false);
  const save = async () => {
    const entry = { personalReading: star.excerpt, question: star.userQuestion, reflections: star.reflectionsText,
      cards: star.cards.map(card => ({ name: card.card, position: card.position, orientation: card.orientation })),
      spread: 'Three-Card Story', spreadKey: 'threeCard', deckId: 'rws-1909', readingResultId: binding.readingResultId,
      visualBinding: binding, visual: publicVisualSnapshot({ binding, raw: star.excerpt, status: 'pending' }) };
    const result = await journal.saveEntry(entry, { visualResume: { readingResultId: binding.readingResultId,
      visualBinding: binding, visualJobToken: 'controlled-private-resume' } });
    setSaved(result.success);
  };
  return <main className="mx-auto max-w-5xl p-4" data-testid="journal-visual-fixture">
    <button type="button" onClick={save} disabled={saved || journal.entries.length > 0}>Save pending reading</button>
    <output data-testid="journal-count">{journal.entries.length}</output>
    {journal.entries.map(entry => <JournalEntryCard key={entry.id} entry={entry} defaultExpanded gestureStudyEnabled
      onDelete={() => journal.deleteEntry(entry.id)} />)}
  </main>;
}
