import { memo, useId, useState } from 'react';
import { Fire, Drop, Wind, Leaf, Star, Triangle, Path, Infinity as InfinityIcon, CaretDown } from '@phosphor-icons/react';
import { useHandsetLayout } from '../hooks/useHandsetLayout';
import { buildSpreadInsightSections } from '../lib/spreadInsights.js';
import { getPassageSource } from '../../shared/passageSource.js';
import { DECK_CATALOG } from '../../shared/vision/deckCatalog.js';
import { InsightText } from './reading/InsightText';

const SUIT_ICONS = { Wands: Fire, Cups: Drop, Swords: Wind, Pentacles: Leaf };
const PATTERN_ICONS = {
  'partial-triad': Triangle,
  'fools-journey': Path,
  'high-dyad': InfinityIcon,
  'medium-high-dyad': InfinityIcon
};

function InsightItem({ item, cards, onSelectCard }) {
  const Icon = SUIT_ICONS[item.suit] || PATTERN_ICONS[item.type] || Star;
  return (
    <li className="flex items-start gap-3">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
      <div className="min-w-0 max-w-prose break-words text-base leading-relaxed text-main">
        {item.title ? (
          <><span className="font-semibold"><InsightText text={item.title} cards={cards} onSelectCard={onSelectCard} /></span>{' '}</>
        ) : null}
        <InsightText text={item.text} cards={cards} onSelectCard={onSelectCard} />
      </div>
    </li>
  );
}

function InsightList({ items, label, cards, onSelectCard }) {
  return (
    <ul className="space-y-4 text-main" role="list" aria-label={label}>
      {items.map((item, index) => (
        <InsightItem key={`${item.kind}-${item.id || item.key || item.type || 'insight'}-${index}`} item={item} cards={cards} onSelectCard={onSelectCard} />
      ))}
    </ul>
  );
}

function InsightSection({ title, children }) {
  const id = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <section className="border-t border-secondary/30">
      <h3>
        <button
          type="button"
          className="flex min-h-touch w-full items-center justify-between gap-3 rounded py-3 text-left text-base font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => setIsExpanded(expanded => !expanded)}
          aria-expanded={isExpanded}
          aria-controls={id}
        >
          <span className="min-w-0 break-words">{title}</span>
          <CaretDown className={`h-5 w-5 shrink-0 ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
      </h3>
      <div id={id} hidden={!isExpanded} className="pb-4 pt-1 space-y-4">
        {children}
      </div>
    </section>
  );
}

/** A short reading summary with supporting patterns and reference passages. */
export const SpreadPatterns = memo(function SpreadPatterns({ themes, spreadHighlights = [], passages = [], cards = [], onSelectCard }) {
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const isHandset = useHandsetLayout();
  const { highlights, spreadDetails, archetypes } = buildSpreadInsightSections(
    spreadHighlights, themes?.knowledgeGraph?.narrativeHighlights
  );
  const references = (Array.isArray(passages) ? passages : [])
    .filter(passage => passage && typeof passage.text === 'string' && passage.text.trim());
  const totalCount = highlights.length + spreadDetails.length + archetypes.length + references.length;
  const selectedDeck = DECK_CATALOG[themes?.deckStyle];
  const otherSources = [...new Set(references.map(getPassageSource)
    .filter(source => selectedDeck && source && source.deckStyle !== themes.deckStyle)
    .map(source => source.label))];

  if (!totalCount) return null;

  return (
    <div className="modern-surface spread-patterns-panel border border-secondary/40 p-4 sm:p-6">
      {isHandset ? (
        <h2>
          <button
            type="button"
            onClick={() => setIsExpanded(expanded => !expanded)}
            className="flex min-h-touch w-full items-center justify-between gap-2 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-expanded={isExpanded}
            aria-controls={contentId}
          >
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <Star className="h-5 w-5 text-accent" aria-hidden="true" />
              <span className="text-accent text-lg font-serif">Spread Insights</span>
              <span className="text-sm text-muted">({totalCount})</span>
            </span>
            <CaretDown className={`h-5 w-5 shrink-0 text-accent ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </h2>
      ) : (
        <h2 className="mb-5 flex items-center gap-2 text-accent">
          <Star className="h-5 w-5" aria-hidden="true" />
          <span className="text-lg font-serif">Spread Insights</span>
        </h2>
      )}

      <div id={contentId} hidden={isHandset && !isExpanded} className={isHandset ? 'mt-4' : ''}>
        {highlights.length > 0 ? (
          <div className="pb-5 space-y-3">
            <h3 className="text-base font-semibold text-accent">Highlights</h3>
            <InsightList items={highlights} label="Spread highlights" cards={cards} onSelectCard={onSelectCard} />
          </div>
        ) : null}
        {spreadDetails.length > 0 ? (
          <InsightSection title="More spread details">
            <InsightList items={spreadDetails} label="Supporting spread details" cards={cards} onSelectCard={onSelectCard} />
          </InsightSection>
        ) : null}
        {archetypes.length > 0 ? (
          <InsightSection title="Archetypal Patterns">
            <InsightList items={archetypes} label="Detected archetypal patterns" cards={cards} onSelectCard={onSelectCard} />
          </InsightSection>
        ) : null}
        {references.length > 0 ? (
          <InsightSection title="Traditional Wisdom">
            {otherSources.length > 0 ? (
              <p className="max-w-prose break-words text-base leading-relaxed text-muted">
                These references use {otherSources.join(' and ')} names and imagery. Your reading uses {selectedDeck.label}.
              </p>
            ) : null}
            <ul className="space-y-5 text-main" role="list" aria-label="Traditional wisdom passages">
              {references.map((passage, index) => {
                const source = getPassageSource(passage);
                return (
                  <li key={`${passage.id || passage.patternId || 'passage'}-${index}`}>
                    <article className="max-w-prose break-words space-y-2 text-base leading-relaxed">
                      <p className="font-semibold">
                        <InsightText text={passage.title || passage.theme} cards={cards} onSelectCard={onSelectCard} sourceDeck={source?.deckStyle} />
                      </p>
                      {source ? <p className="text-sm text-muted">{source.label} reference</p> : null}
                      <blockquote>
                        <InsightText text={passage.text} cards={cards} onSelectCard={onSelectCard} sourceDeck={source?.deckStyle} />
                      </blockquote>
                      {passage.source ? <p className="text-sm text-muted">— {passage.source}</p> : null}
                    </article>
                  </li>
                );
              })}
            </ul>
          </InsightSection>
        ) : null}
      </div>
    </div>
  );
});
