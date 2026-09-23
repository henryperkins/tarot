function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export function NarrativeStageLayout({
  scene = 'narrative',
  panelVariant = 'narrative',
  narrativePanel = null,
  secondaryContent = null,
  wrapSecondaryWithTopSpacing = true,
  className = '',
  panelClassName = ''
}) {
  const hasNarrativePanel = Boolean(narrativePanel);
  const hasSecondaryContent = Boolean(secondaryContent);

  const secondaryNode = hasSecondaryContent
    ? (
        wrapSecondaryWithTopSpacing && hasNarrativePanel
          ? <div className="mt-6 sm:mt-8">{secondaryContent}</div>
          : secondaryContent
      )
    : null;

  return (
    <section
      className={joinClasses(
        'scene-stage relative px-0 sm:px-6 py-6 sm:py-8',
        `scene-stage--${panelVariant}`,
        className
      )}
      data-scene={scene}
    >
      <div
        className={joinClasses(
          'scene-stage__panel relative z-[2] min-w-0 max-w-5xl mx-auto p-0 sm:p-6',
          `scene-stage__panel--${panelVariant}`,
          panelClassName
        )}
      >
        {hasNarrativePanel ? narrativePanel : null}
        {secondaryNode}
      </div>
    </section>
  );
}
