import { useEffect, useState } from 'react';
import { ReadingSpread } from './narrative/ReadingSpread';
import '../../styles/reading-screen.css';

// This is an outline, not a progress meter. Actual contents come from the
// received document, whose headings can vary by spread and reading style.
const CROSS_OUTLINE = ['Opening', 'The Heart of It', 'How You Got Here, and Where It Leans', 'Above and Below', 'The Staff', 'The Pattern in the Reversals', "Where It’s Quietly Leading", 'Gentle Next Steps', 'Closing'];
const SHORT_OUTLINE = ['Opening', 'The Story', 'Next steps'];

export function ReadingPreparationScreen({ cards = [], spreadName = '', question = '', onSelectCard, onCancel }) {
  const shortSpreadName = spreadName.replace(/\s*\([^)]*\)\s*$/, '');
  const [showCards, setShowCards] = useState(false);
  const [extendedWait, setExtendedWait] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setExtendedWait(true), 12000);
    return () => clearTimeout(timer);
  }, []);

  if (showCards) return <div className="reading-screen reading-screen--spread">
    <h2 className="reading-screen__title">{shortSpreadName || 'Your spread'}</h2>
    {question && <div className="reading-question"><span>Your question</span><p>{question}</p></div>}
    <ReadingSpread cards={cards} spreadName={spreadName} onSelectCard={onSelectCard} showSummary />
    <button type="button" className="reading-screen__primary" onClick={() => setShowCards(false)}>View reading status</button>
  </div>;

  return <div className="reading-screen reading-screen--preparing">
    <h2 className="reading-screen__title">Preparing your reading</h2>
    <p className="reading-screen__subtitle">{shortSpreadName}</p>
    <div className="reading-preparation__status" role="status" aria-live="polite">
      <span className="reading-preparation__spinner" aria-hidden="true" />
      <p>Your {cards.length || ''} cards are drawn.<br />Your interpretation will appear here when it is ready.</p>
      {extendedWait && <p className="reading-preparation__wait">This is taking longer than usual. Your reading is still being prepared.</p>}
    </div>
    <div className="reading-rule" aria-hidden="true"><span /></div>
    <div className="reading-preparation__outline">
      <h3>Reading outline</h3>
      <ol>{(cards.length === 10 ? CROSS_OUTLINE : SHORT_OUTLINE).map(title => <li key={title}>
        <span className="reading-contents__marker" aria-hidden="true" />{title}
      </li>)}</ol>
    </div>
    <button type="button" className="reading-preparation__cards" onClick={() => setShowCards(true)}>View drawn cards</button>
    {onCancel && <button type="button" className="reading-screen__secondary reading-preparation__cancel" onClick={onCancel}>Cancel generation</button>}
  </div>;
}
