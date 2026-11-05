import { useRef, useState, useId } from 'react';
import { Lock } from './icons';
import { SPREADS } from '../data/spreads';
import { SpreadPatternThumbnail } from './SpreadPatternThumbnail';
import { CarouselDots } from './CarouselDots';
import { CarouselEdges, ChosenMarks } from './ChoiceCarousel';
import { useChoiceCarousel } from '../hooks/useChoiceCarousel';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useLandscape } from '../hooks/useLandscape';
import { useSmallScreen } from '../hooks/useSmallScreen';
import { usePreferences } from '../contexts/PreferencesContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { UpgradeNudge } from './UpgradeNudge';
import { getSpreadFromDepth } from '../utils/personalization';
import { resolveFallbackSpreadKey } from '../utils/spreadEntitlements';
import { getSpreadArt } from '../utils/spreadArt';
import { LABEL_CLASS } from '../styles/labelClasses';

const SPREAD_KEYS = Object.keys(SPREADS);
const SPREAD_NAMES = SPREAD_KEYS.map(key => SPREADS[key]?.name || key);
// Onboarding's names for the reading-depth preference behind "Recommended".
const DEPTH_REASONS = {
  short: 'quick check-ins',
  standard: 'balanced readings',
  deep: 'deep dives'
};
// Handset cards have a 14rem minimum, then occupy 70% of the padded carousel.
// Account for the panel/card padding instead of requesting nearly a full viewport.
const SPREAD_PREVIEW_SIZES = '(max-width: 374px) 196px, (max-width: 639px) calc(70vw - 80px), (max-width: 1023px) 46vw, 340px';

// Accents are CSS colours (custom properties or color-mix), tinted by mixing
// with transparent.
const tint = (color, alpha) => `color-mix(in srgb, ${color} ${Math.round(alpha * 100)}%, transparent)`;

function createSpreadTheme({
  accent,
  borderAlpha = 0.22,
  borderActiveAlpha = 0.8,
  glowAlpha = 0.35
}) {
  return {
    accent,
    border: tint(accent, borderAlpha),
    borderActive: tint(accent, borderActiveAlpha),
    glow: tint(accent, glowAlpha)
  };
}

const FALLBACK_SPREAD_THEME = createSpreadTheme({
  accent: 'var(--brand-primary)',
  borderAlpha: 0.28,
  borderActiveAlpha: 0.8,
  glowAlpha: 0.35
});

const SPREAD_THEMES = {
  single: createSpreadTheme({
    accent: 'var(--brand-accent)',
    borderAlpha: 0.25,
    borderActiveAlpha: 0.8,
    glowAlpha: 0.38
  }),
  threeCard: createSpreadTheme({
    accent: 'var(--color-cups)',
    borderAlpha: 0.2,
    borderActiveAlpha: 0.78,
    glowAlpha: 0.32
  }),
  fiveCard: createSpreadTheme({
    accent: 'color-mix(in srgb, var(--color-cups) 72%, var(--brand-accent) 28%)',
    borderAlpha: 0.2,
    borderActiveAlpha: 0.75,
    glowAlpha: 0.35
  }),
  decision: createSpreadTheme({
    accent: 'var(--status-warning)',
    borderAlpha: 0.22,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.38
  }),
  relationship: createSpreadTheme({
    accent: 'color-mix(in srgb, var(--brand-primary) 62%, var(--color-cups) 38%)',
    borderAlpha: 0.24,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.34
  }),
  celtic: createSpreadTheme({
    accent: 'color-mix(in srgb, var(--brand-secondary) 58%, var(--color-cups) 42%)',
    borderAlpha: 0.24,
    borderActiveAlpha: 0.82,
    glowAlpha: 0.4
  })
};

export function SpreadSelector({
  selectedSpread,
  onSelectSpread,
  onSpreadConfirm,
  // Phones introduce this panel with the reading step line directly above it.
  showHeader = true,
  // On phones the chosen spread's artwork is the largest paint of the setup
  // screen, so it loads first. On wider screens the deck panel comes first and
  // the spread art sits at or below the fold, so it waits its turn (lazy).
  prioritizeChosenArt = false
}) {
  // The locked spread that opened the upgrade dialog gets focus back when it closes.
  const lockedReturnFocusRef = useRef(null);
  const idBase = useId();
  const [lockedSpreadKey, setLockedSpreadKey] = useState(null);
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const isSmallScreen = useSmallScreen();
  const { personalization } = usePreferences();
  const { subscription } = useSubscription();
  const canUseSpread = subscription?.canUseSpread ?? (() => true);
  const isExperienced = personalization?.tarotExperience === 'experienced';

  // Recommend only a spread the reader can use: when the plan lacks the one
  // their depth preference points to, recommend the substitute the reading
  // starts with instead (useTarotState's plan fallback).
  const depth = personalization?.preferredSpreadDepth;
  const preferredSpread = getSpreadFromDepth(depth);
  const preferredIsUsable = canUseSpread(preferredSpread);
  const recommendedSpread = preferredIsUsable
    ? preferredSpread
    : resolveFallbackSpreadKey(preferredSpread, subscription?.config?.spreads);
  const recommendationReason = DEPTH_REASONS[depth]
    ? `for ${DEPTH_REASONS[depth]}${preferredIsUsable ? '' : ' on your plan'}`
    : '';

  const {
    carouselRef,
    frameRef,
    itemRefs,
    activeIndex,
    showStartFade,
    showEndFade,
    scrollToIndex,
    markChosenHere,
    step,
    onItemKeyDown,
    onItemFocus,
    onGroupBlur,
    tabStopKey
  } = useChoiceCarousel({
    keys: SPREAD_KEYS,
    selectedKey: selectedSpread,
    onChoose: key => handleSpreadSelection(key),
    prefersReducedMotion,
    artworkSelector: '.spread-card__preview'
  });

  // In landscape the card lays its art beside the text (tarot.css), so it
  // needs the width for one readable card rather than two cramped ones.
  const cardBasisClass = isLandscape
    ? 'basis-[78%]'
    : 'basis-[82%] xs:basis-[70%]';

  const isCompactCopy = isSmallScreen && !isLandscape;

  const handleSpreadSelection = key => {
    const opener = itemRefs.current[key] || null;
    // Check if spread is locked (requires subscription)
    if (!canUseSpread(key)) {
      // Safari does not focus a clicked button, so name the opener explicitly.
      lockedReturnFocusRef.current = opener;
      setLockedSpreadKey(key);
      return;
    }

    // The parent may first ask before a drawn reading is cleared (it returns
    // false then); scroll and mark the tap only once the choice is made, so a
    // kept reading leaves the carousel on its own spread.
    if (onSelectSpread?.(key, { opener }) === false) return;
    markChosenHere(key);
    onSpreadConfirm?.(key);
  };

  return (
    <section className="panel-mystic spread-selector-panel animate-fade-in mb-6 sm:mb-8">
      <div className="relative z-10 space-y-5">
        {showHeader ? (
          <header className={`flex flex-col ${isLandscape ? 'gap-1' : 'gap-2'} sm:flex-row sm:items-center sm:justify-between`}>
            <div className="space-y-1">
              <h2 className={`${LABEL_CLASS} text-accent`}>Spread Selection</h2>
              {!isLandscape && (
                <p className="text-base leading-relaxed text-muted max-w-[65ch] text-pretty">
                  Choose how your reading unfolds.
                </p>
              )}
            </div>
          </header>
        ) : (
          // Phones show the reading step line above this panel instead of a
          // header; the heading still lets screen readers jump to the choice.
          <h2 className="sr-only">Spread Selection</h2>
        )}

        {/* Carousel wrapper with edge fade indicators and navigation */}
        <div ref={frameRef} className="spread-carousel-frame relative">
          <CarouselEdges
            showStart={showStartFade}
            showEnd={showEndFade}
            onStep={step}
            previousLabel="Previous spread"
            nextLabel="Next spread"
          />

          <div
            ref={carouselRef}
            role="radiogroup"
            aria-label="Spread selection"
            onBlur={onGroupBlur}
            className={`spread-selector-grid ${isLandscape ? 'spread-selector-grid--landscape' : ''} flex ${isLandscape ? 'gap-2 pb-2' : 'gap-3 pb-3'} overflow-x-auto snap-x snap-mandatory scroll-smooth sm:overflow-visible sm:snap-none sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 sm:gap-4`}
            style={{ scrollPaddingLeft: '1rem', scrollPaddingRight: '1rem' }}
          >
          {Object.entries(SPREADS).map(([key, spread]) => {
            const isActive = selectedSpread === key;
            const isLocked = !canUseSpread(key);
            const isRecommended = key === recommendedSpread;
            const baseDescription = spread.description || 'Guided snapshot for your focus.';
            const maxCards = typeof spread.maxCards === 'number' ? spread.maxCards : null;
            const baseCount = typeof spread.drawCount === 'number' ? spread.drawCount : spread.count;
            const cardNoun = baseCount === 1 ? 'card' : 'cards';
            const cardLabel = maxCards && maxCards > baseCount
              ? `${baseCount} ${cardNoun} + clarifiers`
              : `${baseCount} ${cardNoun}`;
            const showDescription = !isLandscape && !isExperienced;
            const theme = SPREAD_THEMES[key] || FALLBACK_SPREAD_THEME;
            const resolvedBorder = isActive
              ? (theme.borderActive || FALLBACK_SPREAD_THEME.borderActive)
              : (theme.border || FALLBACK_SPREAD_THEME.border);
            const previewArt = getSpreadArt(key, { alt: spread.preview?.alt }) || spread.preview;
            // The radio is named by its title alone; the badges, kind and card
            // count, and description follow as its description.
            const ids = {
              title: `${idBase}-${key}-title`,
              locked: `${idBase}-${key}-locked`,
              recommended: `${idBase}-${key}-recommended`,
              meta: `${idBase}-${key}-meta`,
              description: `${idBase}-${key}-description`
            };
            const describedBy = [
              isLocked && ids.locked,
              isRecommended && ids.recommended,
              ids.meta,
              showDescription && ids.description
            ].filter(Boolean).join(' ');

            return (
              <button
                key={key}
                ref={el => { itemRefs.current[key] = el; }}
                type="button"
                role="radio"
                tabIndex={key === tabStopKey ? 0 : -1}
                aria-checked={isActive}
                aria-labelledby={ids.title}
                aria-describedby={describedBy}
                onClick={() => handleSpreadSelection(key)}
                onFocus={() => onItemFocus(key)}
                onKeyDown={event => onItemKeyDown(event, key)}
                className={`spread-card relative flex h-full flex-col ${isLandscape ? 'gap-2' : 'gap-3'} cursor-pointer select-none shrink-0 ${cardBasisClass} snap-center snap-always sm:basis-auto sm:shrink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-(--focus-ring-color) focus-visible:ring-offset-2 focus-visible:ring-offset-main ${isActive ? 'spread-card--active' : ''}`}
                style={{
                  '--spread-accent': theme.accent || FALLBACK_SPREAD_THEME.accent,
                  '--spread-border': resolvedBorder,
                  '--spread-glow': theme.glow || FALLBACK_SPREAD_THEME.glow
                }}
              >
                {isActive && <ChosenMarks />}
                {/* Lock indicator for premium-only spreads; "Requires Plus" below names it. */}
                {!isActive && isLocked && (
                  <div className="spread-card__lock absolute top-3 right-3 z-20" aria-hidden="true">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center border border-accent/40 bg-accent/15 backdrop-blur-sm"
                      style={{
                        boxShadow: '0 8px 20px -12px var(--accent-45)'
                      }}
                    >
                      <Lock className="w-3.5 h-3.5 text-accent" weight="fill" />
                    </div>
                  </div>
                )}

                <SpreadPatternThumbnail
                  spreadKey={key}
                  preview={previewArt ? { ...previewArt, sizes: SPREAD_PREVIEW_SIZES } : null}
                  spreadName={spread.name}
                  className="spread-card__preview w-full"
                  priority={prioritizeChosenArt && isActive}
                  decorative
                />

                <div className="spread-card__body">
                  <div className="spread-card__title text-accent">
                    <span id={ids.title} className="spread-card__title-text font-serif text-lg font-semibold leading-tight text-balance">{spread.name}</span>
                    {isLocked && (
                      <span id={ids.locked} className="spread-card__badge inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 font-sans text-xs font-semibold uppercase tracking-wide text-accent">
                        <Lock className="w-3 h-3" weight="fill" aria-hidden="true" />
                        Requires Plus
                      </span>
                    )}
                    {isRecommended && (
                      <span id={ids.recommended} className="spread-card__badge font-sans text-xs font-semibold uppercase tracking-wide text-accent bg-accent/15 border border-accent/40 px-2 py-0.5 rounded-full">
                        Recommended
                        {recommendationReason && <span className="sr-only normal-case"> {recommendationReason}</span>}
                      </span>
                    )}
                  </div>
                  <div id={ids.meta} className="mt-1 mb-2 flex flex-wrap items-baseline gap-x-2 text-xs font-medium uppercase tracking-widest leading-normal text-muted">
                    <span>{spread.tag || 'Guided spread'}</span>
                    {/* Keep "· 3 cards" together; longer counts may wrap at large zoom. */}
                    <span>{`·\u00A0${cardLabel.replace(' ', '\u00A0')}`}</span>
                  </div>

                  {showDescription && (
                    <p id={ids.description} className="spread-card__description text-sm text-muted leading-normal text-pretty">
                      {isCompactCopy ? (spread.mobileDescription || baseDescription) : baseDescription}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          </div>
        </div>

        {/* Mobile pagination dots */}
        <div className="sm:hidden">
          <CarouselDots
            activeIndex={activeIndex}
            totalItems={SPREAD_KEYS.length}
            onSelectItem={scrollToIndex}
            labels={SPREAD_NAMES}
            ariaLabel="Browse spreads"
            variant="compact"
          />
        </div>

      </div>

      {/* Upgrade dialog for locked spreads (rendered on document.body) */}
      {lockedSpreadKey && (
        <UpgradeNudge
          feature={SPREADS[lockedSpreadKey]?.name || 'This spread'}
          requiredTier="plus"
          variant="modal"
          dismissible={true}
          onDismiss={() => setLockedSpreadKey(null)}
          returnFocusRef={lockedReturnFocusRef}
        />
      )}

    </section>
  );
}
