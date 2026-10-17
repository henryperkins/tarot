import { ReadingPreparationScreen } from '../reading/ReadingPreparationScreen';
import { getSceneModel } from './sceneModelUtils';

export function InterludeScene({
  className = '',
  sceneModels = {}
}) {
  const interludeModel = getSceneModel(sceneModels, 'interludeModel');
  const {
    isGenerating,
    personalReading,
    spreadName,
    userQuestion,
    spreadCards,
    onSelectCard,
    onCancel
  } = interludeModel;

  const isExiting = !isGenerating && Boolean(personalReading);

  // Keep DOM mounted during SceneShell overlay transition to prevent content flash
  if (isExiting) {
    return (
      <section
        className="scene-stage scene-stage--interlude opacity-0 pointer-events-none"
        data-scene="interlude"
        aria-hidden="true"
      />
    );
  }

  return (
    <section
      className={`scene-shell scene-stage scene-stage--interlude relative px-3 xs:px-4 sm:px-6 py-6 sm:py-8 ${className}`}
      data-scene="interlude"
    >
      <div className="relative z-2 max-w-3xl mx-auto">
        <ReadingPreparationScreen cards={spreadCards} spreadName={spreadName} question={userQuestion}
          onSelectCard={onSelectCard} onCancel={onCancel} />
      </div>
    </section>
  );
}
