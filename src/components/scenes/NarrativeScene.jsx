import { NarrativeStageLayout } from '../reading/NarrativeStageLayout';
import { getSceneModel } from './sceneModelUtils';

export function NarrativeScene({
  sceneModels = {}
}) {
  const narrativeModel = getSceneModel(sceneModels, 'narrativeModel');
  const narrativePanel = narrativeModel?.narrativePanel || null;
  const secondaryContent = narrativeModel?.secondaryContent || null;

  return (
    <NarrativeStageLayout
      scene="narrative"
      panelVariant="narrative"
      narrativePanel={narrativePanel}
      secondaryContent={secondaryContent}
    />
  );
}
