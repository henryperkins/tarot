/* eslint-disable react-refresh/only-export-components */
/**
 * JournalEntryCard.jsx
 * 
 * Re-exports the decomposed JournalEntryCard from the new modular structure.
 * This file is kept for backward compatibility with existing imports.
 * 
 * The actual implementation is now in ./journal/entry-card/
 * 
 * @see ./journal/entry-card/JournalEntryCard.jsx - Main orchestrator
 * @see ./journal/entry-card/EntryCard.primitives.js - Design tokens
 * @see ./journal/entry-card/hooks/ - Custom hooks
 * @see ./journal/entry-card/EntryHeader/ - Header components
 * @see ./journal/entry-card/EntrySections/ - Section components
 * @see ./journal/entry-card/EntryActions/ - Action menu components
 */
export { JournalEntryCard } from './journal/entry-card';

// Also export sub-components for advanced usage
export {
  // Hooks
  useEntryMetadata,
  useActionMenu,
  useEntryActions,
  // Header variants
  CompactHeader,
  ComfortableHeader,
  // Sections
  QuestionSection,
  CardsDrawnSection,
  ReflectionsSection,
  KeyThemesSection,
  FollowUpSection,
  NarrativeSection,
  KnowledgeGraphSection,
  // Actions
  ActionMenu,
  ShareLinksPanel,
  // Primitives
  styles as entryCardStyles,
  cn,
  getSuitAccentVar,
  getEntryAccentColor
} from './journal/entry-card';
