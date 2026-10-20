import { useCallback, useMemo, useRef, useState } from 'react';
import { StreamingNarrative } from '../../StreamingNarrative';
import { NarrativeSafetyNotice } from '../../NarrativeSafetyNotice';
import { NarrativePanelHeader } from './NarrativePanelHeader';
import { ReadingSpread, ReadingCardFigure, ReadingChapterCards } from './ReadingSpread';
import { ReadingContents } from './ReadingContents';
import { ReadingCompletionActions } from '../complete/ReadingCompletionActions';
import { getReadingSections, getSectionKeyFromHeading, getReadingChapterCards } from '../../../lib/narrativeSections';

const EMPTY_CARDS = [];
const normalized = value => String(value || '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const nodeText = node => node.value ?? node.children?.map(nodeText).join('') ?? '';

export function ReadingDocument({ model, callbacks }) {
  const root = useRef(null);
  const [hasViewedOverview, setHasViewedOverview] = useState(false);
  const sections = useMemo(() => getReadingSections(model.narrativeText), [model.narrativeText]);
  const starts = useMemo(() => new Set(sections.filter(section => section.depth !== null).map(section => section.headingStart)), [sections]);
  const cards = model.displayCards || model.spreadCards || EMPTY_CARDS;
  const headingProps = useCallback(node => starts.has(node.position?.start?.offset) ? {
    id: `reading-section-${node.position.start.offset}`, 'data-reading-section': true, tabIndex: -1
  } : {}, [starts]);
  const headingLead = useCallback(node => {
    const title = normalized(nodeText(node));
    const mentioned = getReadingChapterCards(nodeText(node), cards);
    const matches = mentioned.length === 1 ? mentioned.filter(card => [card.name, card.canonicalName].some(name => {
      const cardName = normalized(name);
      if (!cardName || !title.includes(cardName)) return false;
      const rest = title.replace(cardName, '').replace(/\b(?:upright|reversed)\b/g, '').trim().replace(/^the\s+/, '').replace(/^\d+\s*/, '');
      return rest === '' || [card.positionLabel, card.fullPositionLabel].some(label => rest === normalized(label));
    })) : [];
    if (matches.length === 1) return <ReadingCardFigure card={matches[0]} onSelectCard={callbacks.onSelectCard} compact />;
    const chapter = sections.find(section => section.headingStart === node.position?.start?.offset);
    if (!chapter || cards.length <= 3 || getSectionKeyFromHeading(chapter.title) === 'opening') return null;
    const mentionedCards = getReadingChapterCards(model.narrativeText.slice(chapter.start, chapter.end), cards);
    return mentionedCards.length ? <ReadingChapterCards cards={mentionedCards} onSelectCard={callbacks.onSelectCard} /> : null;
  }, [cards, callbacks.onSelectCard, model.narrativeText, sections]);

  return <div className="reading-screen__column" ref={root}>
    <NarrativePanelHeader />
    {model.question && <div className="reading-question"><span>Your question</span><p>{model.question}</p></div>}
    {Object.values(model.originalContext?.reflections || {}).some(value => typeof value === 'string' && value.trim())
      && <details className="reading-options"><summary>Your notes</summary>
        {Object.entries(model.originalContext.reflections).filter(([, value]) => typeof value === 'string' && value.trim()).map(([key, value]) => {
          const card = /^\d+$/.test(key) ? cards.find(card => card.index === Number(key)) : null;
          return <div key={key} className="mb-4">
            <h3 className="font-serif text-lg">{card ? card.positionLabel + ' · ' + card.name : key}</h3>
            <p className="whitespace-pre-wrap text-main leading-relaxed">{value}</p>
          </div>;
        })}
      </details>}
    {cards.length <= 3 ? <ReadingSpread cards={cards} onSelectCard={callbacks.onSelectCard} /> : <details className="reading-spread-disclosure"
      onToggle={event => { if (event.currentTarget.open) setHasViewedOverview(true); }}>
      <summary>View drawn cards <span>{cards.length} cards</span></summary>
      {hasViewedOverview && <ReadingSpread cards={cards} onSelectCard={callbacks.onSelectCard} showSummary />}
    </details>}
    <ReadingContents sections={sections} readingRef={root} controlsModel={model.controlsModel}
      onNarrate={callbacks.onNarrationStart} onStopNarration={callbacks.onStopNarration} compactTabs={cards.length <= 3} />
    {sections[0]?.depth === null && (sections.length > 1 ? <h3 id={sections[0].id} data-reading-section tabIndex={-1}
      className="reading-screen__section-title">{sections[0].title}</h3> : <div id={sections[0].id} data-reading-section tabIndex={-1} />)}
    <div className="reading-prose">
      <StreamingNarrative text={model.narrativeText} useMarkdown={Boolean(model.personalReading?.hasMarkdown || sections.some(section => section.depth !== null))}
        headingBaseLevel={3} isStreamingEnabled={model.shouldStreamNarrative} isReadingStreaming={model.isReadingStreaming}
        autoNarrate={model.canAutoNarrate} onNarrationStart={callbacks.onNarrationStart} onDone={callbacks.onNarrativeComplete}
        displayName={model.displayName} highlightPhrases={model.narrativeHighlightPhrases} emotionalTone={model.emotionalTone}
        onHighlightPhrase={callbacks.onHighlightPhrase} onSectionEnter={callbacks.onSectionEnter} wordBoundary={model.activeWordBoundary}
        cardLinks={model.gestureStudyEnabled && model.personalReading?.hasMarkdown ? model.cardLinkCatalog : null}
        gestureSource={model.gestureSource} getHeadingProps={headingProps} renderHeadingLead={headingLead} />
    </div>
    {!model.isHandset && !model.isReadingStreaming && <div className="reading-completion-actions">
      {model.saveController ? <ReadingCompletionActions saveController={model.saveController}
        onViewJournalEntry={callbacks.onViewJournalEntry} onOpenFollowUp={callbacks.onOpenFollowUp} /> : <>
      <button type="button" className="reading-screen__primary" disabled={model.controlsModel?.isSaving}
        onClick={() => model.savedEntryId ? callbacks.onViewJournalEntry?.(model.savedEntryId) : callbacks.onSaveReading?.()}>
        {model.savedEntryId ? 'View saved entry' : model.controlsModel?.isSaving ? 'Saving…' : 'Save to journal'}
      </button>
      {callbacks.onOpenFollowUp && <button type="button" className="reading-screen__secondary" onClick={callbacks.onOpenFollowUp}>Ask about this reading</button>}
      </>}
    </div>}
    <details className="reading-about"><summary>About this reading</summary><NarrativeSafetyNotice compact />
      {model.focusToggleAvailable && <button type="button" className="min-h-touch text-sm" aria-pressed={model.isNarrativeFocus}
        onClick={callbacks.onToggleNarrativeFocus}>Hide extra panels: {model.isNarrativeFocus ? 'on' : 'off'}</button>}
    </details>
  </div>;
}
