import { Star } from '@phosphor-icons/react';
import { HelperToggle } from './HelperToggle';
import { MobileInfoSection } from './MobileInfoSection';

export function NarrativeGuidancePanel({
  toneLabel,
  frameLabel,
  isHandset,
  isNewbie,
  compact = false,
  className = ''
}) {
  const guidanceContent = (
    <div className="space-y-2">
      <p className="text-sm text-muted leading-relaxed">
        This narrative braids together your spread positions, card meanings, and reflections into a single through-line. Read slowly, notice echoes and contrasts between cards, and trust what resonates more than any script.
      </p>
      <p className="text-sm text-muted leading-relaxed">
        {`Style: a ${toneLabel.toLowerCase()} tone with a ${frameLabel.toLowerCase()} lens. Let your own sense of meaning carry as much weight as any description.`}
      </p>
      <p className="text-xs sm:text-sm text-muted/90 leading-relaxed">
        Reflective guidance only—not medical, mental health, legal, financial, or safety advice.
      </p>
    </div>
  );

  const headingClass = compact
    ? 'text-sm sm:text-base font-serif text-accent/90 flex items-center gap-2'
    : 'text-base sm:text-lg font-serif text-accent flex items-center gap-2';

  return (
    <div className={`${compact ? 'space-y-1.5 sm:space-y-2' : 'space-y-2 sm:space-y-3'} ${className}`}>
      {!isHandset && (
        <h3 className={headingClass}>
          <Star className={compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5'} />
          Narrative style & guidance
        </h3>
      )}
      {isHandset ? (
        <MobileInfoSection
          title="Narrative style & guidance"
          variant="block"
          defaultOpen={isNewbie}
          buttonClassName={compact ? 'border-secondary/25 bg-surface/40 text-sm' : ''}
          contentClassName={compact ? 'bg-transparent border-transparent px-0 py-0 text-sm' : ''}
        >
          {guidanceContent}
        </MobileInfoSection>
      ) : (
        <HelperToggle
          className={compact ? 'mt-1' : 'mt-2'}
          defaultOpen={isNewbie}
          buttonClassName={compact ? 'px-0 text-xs sm:text-sm' : ''}
          contentClassName={compact ? 'bg-transparent border-transparent p-0' : ''}
        >
          {guidanceContent}
        </HelperToggle>
      )}
    </div>
  );
}
