import { Suspense, lazy } from 'react';
import { NarrativeSkeleton } from '../NarrativeSkeleton';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useLandscape } from '../../hooks/useLandscape';

const AtmosphericInterlude = lazy(() =>
  import('../AtmosphericInterlude').then((module) => ({ default: module.AtmosphericInterlude }))
);

export function InterludeScene({
  title = 'Interlude',
  message = 'Gathering insight...',
  showTitle = true,
  className = '',
  sceneData = {}
}) {
  const prefersReducedMotion = useReducedMotion();
  const isLandscape = useLandscape();
  const {
    isGenerating,
    personalReading,
    reasoningSummary,
    narrativePhase,
    narrativeAtmosphereClasses,
    shouldShowInterlude,
    spreadName,
    displayName,
    userQuestion,
    readingCount,
    reasoning
  } = sceneData;

  if (!isGenerating || personalReading) return null;

  const hasAnyContent = reasoningSummary || (personalReading?.raw || personalReading?.normalized);
  const shouldShowAtmosphericInterlude = shouldShowInterlude && !hasAnyContent;

  return (
    <section
      className={`scene-stage scene-stage--interlude relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`}
      data-scene="interlude"
    >
      <div className="scene-stage__panel scene-stage__panel--interlude relative z-[2] max-w-5xl mx-auto p-4 sm:p-6 text-center">
        {showTitle ? (
          <>
            <h2 className="text-xl sm:text-2xl font-serif text-accent mb-2">{title}</h2>
            <p className="text-sm sm:text-base text-muted mb-4">{message}</p>
          </>
        ) : null}
        <div
          className={`bg-surface/95 backdrop-blur-xl rounded-2xl border border-secondary/40 shadow-2xl shadow-secondary/40 max-w-full sm:max-w-5xl mx-auto ${
            isLandscape ? 'p-3' : 'px-3 xxs:px-4 py-4 xs:px-5 sm:p-6 md:p-8'
          } ${prefersReducedMotion ? '' : 'animate-fade-in'}`}
        >
          {shouldShowAtmosphericInterlude ? (
            <Suspense fallback={
              <NarrativeSkeleton
                hasQuestion={Boolean(userQuestion)}
                displayName={displayName}
                spreadName={spreadName}
                cardCount={readingCount || 3}
                narrativePhase={narrativePhase}
                atmosphereClassName={narrativeAtmosphereClasses}
              />
            }>
              <AtmosphericInterlude
                message={`Channeling ${spreadName || 'your reading'}...`}
                theme={narrativeAtmosphereClasses}
              />
            </Suspense>
          ) : (
            <NarrativeSkeleton
              hasQuestion={Boolean(userQuestion)}
              displayName={displayName}
              spreadName={spreadName}
              cardCount={readingCount || 3}
              reasoningSummary={reasoningSummary}
              reasoning={reasoning}
              narrativePhase={narrativePhase}
              atmosphereClassName={narrativeAtmosphereClasses}
            />
          )}
        </div>
      </div>
    </section>
  );
}
