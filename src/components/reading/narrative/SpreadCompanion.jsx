import { CardTouchArt } from './CardTouchArt';
import { useNarrativeCardFocus, useNarrativeCardFocusApi } from './NarrativeCardFocus';
import { railColumns } from './spreadCompanionLayout';
import '../../../styles/narrative-card-touch.css';

function cardLabel(card) {
  return `${card.positionLabel}: ${card.name}${card.isReversed ? ', reversed' : ''}`;
}

// Height over width of the deck's card frame ("16 / 31" is a Marseille card).
function frameRatio(frame) {
  const [width, height] = String(frame || '').split('/').map(Number);
  return width > 0 && height > 0 ? Number((height / width).toFixed(3)) : 1.72;
}

// The rail fits the whole spread into one screen; the row shares the screen
// width between the cards.
function layoutVars(variant, cards) {
  const count = cards.length;
  if (variant === 'row') return { '--row-count': count };
  const cols = railColumns(count);
  return { '--rail-cols': cols, '--rail-rows': Math.ceil(count / cols), '--card-ratio': frameRatio(cards[0]?.frame) };
}

/**
 * The querent's cards, kept beside the reading. The rail stays in view on
 * wide screens; the row opens the reading on narrower ones.
 */
export function SpreadCompanion({ variant = 'rail' }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const cards = focus?.cards || [];
  if (cards.length === 0) return null;
  const { cardStates, calm } = focus;

  return (
    <aside
      className={`spread-companion spread-companion--${variant}`}
      aria-label="Your cards"
      data-count={cards.length}
      data-cols={variant === 'rail' ? railColumns(cards.length) : undefined}
      data-focus={cardStates ? 'true' : undefined}
      data-calm={calm ? 'true' : undefined}
      style={layoutVars(variant, cards)}
    >
      <ol className="spread-companion__list">
        {cards.map((card) => {
          const entry = cardStates?.states.get(card.index);
          const state = entry?.state || null;
          return (
            <li key={card.index} className="spread-companion__item" data-state={state || undefined}>
              <button
                type="button"
                className="spread-companion__card"
                data-state={state || undefined}
                aria-current={state === 'touched' ? 'true' : undefined}
                aria-label={`${cardLabel(card)}. Open card`}
                onClick={() => api?.selectCard(card.index)}
                onPointerEnter={() => api?.setSpreadHover(card.index)}
                onPointerLeave={() => api?.setSpreadHover(null)}
                onFocus={() => api?.setSpreadHover(card.index)}
                onBlur={() => api?.setSpreadHover(null)}
              >
                <CardTouchArt
                  card={card}
                  state={state}
                  touches={entry?.touches || []}
                  touchKey={cardStates?.key || ''}
                  calm={calm}
                />
              </button>
              <span className="spread-companion__label" aria-hidden="true">
                {card.shortLabel}
                {card.isReversed ? <span className="spread-companion__orientation">Reversed</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/**
 * The card set into the paragraph that opens its passage, for screens too
 * narrow to keep the whole spread beside the text.
 */
export function CardTouchPlate({ cardIndex }) {
  const focus = useNarrativeCardFocus();
  const api = useNarrativeCardFocusApi();
  const card = focus?.cards?.find((candidate) => candidate.index === cardIndex);
  if (!card) return null;
  const entry = focus.cardStates?.states.get(cardIndex);
  const state = entry?.state || null;

  return (
    <button
      type="button"
      className="card-touch-plate"
      data-state={state || undefined}
      data-calm={focus.calm ? 'true' : undefined}
      aria-label={`${cardLabel(card)}. Open card`}
      onClick={() => api?.selectCard(cardIndex)}
    >
      <CardTouchArt
        card={card}
        state={state}
        touches={entry?.touches || []}
        touchKey={focus.cardStates?.key || ''}
        calm={focus.calm}
      />
    </button>
  );
}
