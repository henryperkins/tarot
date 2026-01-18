/**
 * entry-card/index.js
 * Barrel export for the decomposed JournalEntryCard component.
 * 
 * Usage:
 *   import { JournalEntryCard } from './journal/entry-card';
 * 
 * Or import sub-components directly:
 *   import { CompactHeader } from './journal/entry-card/EntryHeader';
 *   import { QuestionSection } from './journal/entry-card/EntrySections';
 */

// Main component
export { JournalEntryCard } from './JournalEntryCard';

// Hooks (for custom implementations)
export { useEntryMetadata, useActionMenu, useEntryActions } from './hooks';

// Sub-components (for composition)
export { CompactHeader, ComfortableHeader } from './EntryHeader';
export { ActionMenu, ShareLinksPanel } from './EntryActions';
export {
  QuestionSection,
  CardsDrawnSection,
  ReflectionsSection,
  KeyThemesSection,
  FollowUpSection,
  NarrativeSection,
  KnowledgeGraphSection
} from './EntrySections';

// Primitives (for extending)
export { styles, cn, getSuitAccentVar, getEntryAccentColor } from './EntryCard.primitives';
