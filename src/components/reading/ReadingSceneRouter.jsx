import {
  SceneShell,
  IdleScene,
  InterludeScene,
  CompleteScene
} from '../scenes';
import { ReadingTableScene } from '../scenes/ReadingTableScene';

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
  // Streaming and completion share one mounted narrative, selection and cue ledger.
  narrative: CompleteScene,
  complete: CompleteScene
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
