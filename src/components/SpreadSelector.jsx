import { useRef } from 'react';
import { Sparkle, Check, Star } from './icons';
import { Icon, ICON_SIZES } from './Icon';
import { SPREADS } from '../data/spreads';
import { SpreadPatternThumbnail } from './SpreadPatternThumbnail';

const STAR_TOTAL = 3;

export function SpreadSelector({
  selectedSpread,
  onSelectSpread,
  onSpreadConfirm
}) {
  const spreadRefs = useRef({});

  const handleSpreadSelection = key => {
    if (onSelectSpread) {
      onSelectSpread(key);
    }
    if (onSpreadConfirm) {
      onSpreadConfirm(key);
    }
  };

  const handleCardKeyDown = (event, key) => {
    const spreadKeys = Object.keys(SPREADS);
    const currentIndex = spreadKeys.indexOf(key);

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSpreadSelection(key);
      return;
    }

    let nextIndex = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (currentIndex + 1) % spreadKeys.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (currentIndex - 1 + spreadKeys.length) % spreadKeys.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = spreadKeys.length - 1;
    }

    if (nextIndex !== -1) {
      const nextKey = spreadKeys[nextIndex];
      const nextElement = spreadRefs.current[nextKey];
      if (nextElement && typeof nextElement.focus === 'function') {
        nextElement.focus();
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  const renderStars = stars => (
    <div className="flex items-center gap-0.5 text-primary">
      {Array.from({ length: STAR_TOTAL }).map((_, index) => (
        <Icon
          key={`${index}-star`}
          icon={Star}
          size="sm"
          weight={index < stars ? 'fill' : 'regular'}
          className={index < stars
            ? 'text-primary drop-shadow-[0_0_10px_rgba(244,223,175,0.35)]'
            : 'text-secondary/60'}
          decorative
        />
      ))}
    </div>
  );

  return (
    <div className="spread-selector-panel p-5 sm:p-7 mb-6 sm:mb-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-5">
        <Icon
          icon={Sparkle}
          size={ICON_SIZES.md}
          className="text-primary drop-shadow-[0_0_12px_rgba(244,223,175,0.35)] sm:w-5 sm:h-5"
          decorative
        />
        <h2 className="text-lg sm:text-xl font-serif text-accent leading-tight">Choose Your Spread</h2>
      </div>

      <div
        role="radiogroup"
        aria-label="Choose your spread"
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 sm:gap-4"
      >
        {Object.entries(SPREADS).map(([key, spread], index) => {
          const isActive = selectedSpread === key;
          const baseDescription = spread.mobileDescription || spread.description || 'Guided snapshot for your focus.';
          const isFirstSpread = index === 0;
          const isTabbable = isActive || (!selectedSpread && isFirstSpread);
          const stars = spread.complexity?.stars ?? 0;
          const complexityLabel = spread.complexity?.label || 'Beginner';

          return (
            <article
              key={key}
              ref={el => { spreadRefs.current[key] = el; }}
              role="radio"
              tabIndex={isTabbable ? 0 : -1}
              aria-checked={isActive}
              onClick={() => handleSpreadSelection(key)}
              onKeyDown={event => handleCardKeyDown(event, key)}
              className={`spread-card group relative flex flex-col gap-3 min-h-[320px] sm:min-h-[340px] cursor-pointer select-none shrink-0 basis-[82%] xs:basis-[70%] snap-center sm:basis-auto sm:shrink ${isActive ? 'spread-card--active' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-main`}
            >
              {isActive && (
                <div className="absolute top-3 right-3 z-10">
                  <div className="w-7 h-7 rounded-full bg-primary text-surface shadow-[0_0_0_2px_rgba(12,10,16,0.75),0_0_0_10px_rgba(212,184,150,0.25)] flex items-center justify-center">
                    <Check className="w-4 h-4" weight="bold" aria-hidden="true" />
                  </div>
                </div>
              )}

              <div className="text-[15px] sm:text-base font-semibold text-main leading-snug pr-8">
                {spread.name}
              </div>

              <SpreadPatternThumbnail
                spreadKey={key}
                preview={spread.preview}
                spreadName={spread.name}
                className="spread-card__preview w-full"
              />

              <div className="spread-card__meta">
                <div className="spread-card__complexity">
                  <span className="text-[11px] text-accent/90">Complexity:</span>
                  {renderStars(stars)}
                  <span className="text-[12px] text-muted capitalize">{complexityLabel}</span>
                </div>
              </div>

              <p className="text-sm text-muted leading-snug mt-auto">
                {baseDescription}
              </p>
            </article>
          );
        })}
      </div>
      <p className="sm:hidden text-center text-xs text-muted mt-3">Swipe horizontally to browse spreads.</p>
    </div>
  );
}
