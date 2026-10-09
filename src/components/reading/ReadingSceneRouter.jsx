import {
  SceneShell,
  IdleScene,
  InterludeScene,
  CompleteScene
} from '../scenes';
import { useScene } from '../scenes/SceneContext';
import { ReadingTableScene } from '../scenes/ReadingTableScene';

function ReadingNarrativeScene({ sceneModels }) {
  const { activeScene } = useScene();
  return <CompleteScene sceneModels={sceneModels} isComplete={activeScene === 'complete'} />;
}

const SCENE_COMPONENTS = {
  idle: ({ children }) => (
    <IdleScene showTitle={false}>
      {children}
    </IdleScene>
  ),
  // The same component identity preserves the table through deal, reveal, reset.
  ritual: ReadingTableScene,
  reveal: ReadingTableScene,
  interlude: (props) => (
    <InterludeScene
      {...props}
      showTitle={false}
    />
  ),
  // Completion adds controls below the same mounted reading. Preserve held
  // inspection, observed passages and animation ownership through narrative done.
  narrative: ReadingNarrativeScene,
  complete: ReadingNarrativeScene
};

export function ReadingSceneRouter({
  orchestrator,
  sceneModels,
  colorScript,
  colorScriptOwner,
  isMobileStableMode = false
}) {
  const activeScene = orchestrator?.activeScene;
  const isReadingScene = activeScene === 'narrative' || activeScene === 'complete';
  const isTableScene = activeScene === 'ritual' || activeScene === 'reveal';
  const className = activeScene === 'interlude' ? '' : `scene-shell ${isReadingScene ? 'scene-shell--reading' : ''} ${isTableScene ? 'scene-shell--table' : ''}`;

  return (
    <SceneShell
      orchestrator={orchestrator}
      scenes={SCENE_COMPONENTS}
      sceneModels={sceneModels}
      colorScript={colorScript}
      colorScriptOwner={colorScriptOwner}
      isMobileStableMode={isMobileStableMode}
      className={className}
    />
  );
}
