import { NarrativeStagePanel } from './NarrativeStagePanel';

export function NarrativeScene({
  children,
  sceneData = {}
}) {
  const narrativePanelProps = sceneData?.narrativePanelProps || null;
  const contentClassName =
    'scene-stage__panel scene-stage__panel--narrative relative z-[2] max-w-5xl mx-auto p-4 sm:p-6';

  return (
    <section
      className="scene-stage scene-stage--narrative relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8"
      data-scene="narrative"
    >
      <div className={contentClassName}>
        <NarrativeStagePanel narrativePanelProps={narrativePanelProps}>
          {children}
        </NarrativeStagePanel>
      </div>
    </section>
  );
}
