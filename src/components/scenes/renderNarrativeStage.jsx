export function renderNarrativeStage({
  narrativePanel = null,
  children = null,
  showChildren = true
}) {
  if (!children || !showChildren) {
    return narrativePanel;
  }

  if (!narrativePanel) {
    return children;
  }

  return (
    <>
      {narrativePanel}
      <div className="mt-6 sm:mt-8">{children}</div>
    </>
  );
}
