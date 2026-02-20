import { NarrativePanel } from '../NarrativePanel';

export function NarrativeStagePanel({
  narrativePanelProps = null,
  children = null
}) {
  const hasNarrativeContent = Boolean(narrativePanelProps?.personalReading);
  if (!hasNarrativeContent) {
    return children;
  }

  return (
    <>
      <NarrativePanel {...narrativePanelProps} />
      {children ? <div className="mt-6 sm:mt-8">{children}</div> : null}
    </>
  );
}
