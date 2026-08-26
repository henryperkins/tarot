import {
  SceneShell,
  IdleScene,
  ReadingClothScene,
  InterludeScene,
  NarrativeScene,
  CompleteScene
} from '../scenes';

const SCENE_COMPONENTS = {
  idle: ({ children }) => (
    <IdleScene showTitle={false}>
      {children}
    </IdleScene>
  ),
  ritual: ReadingClothScene,
  reveal: ReadingClothScene,
  interlude: (props) => (
    <InterludeScene
      {...props}
      showTitle={false}
    />
  ),
  narrative: (props) => (
    <NarrativeScene {...props} />
  ),
  complete: (props) => (
    <CompleteScene {...props} />
  )
};

export function ReadingSceneRouter({
  orchestrator,
  sceneModels,
  colorScript,
  colorScriptOwner,
  isMobileStableMode = false
}) {
  const activeScene = orchestrator?.activeScene;
  const className = activeScene === 'interlude'
    ? ''
    : `scene-shell${activeScene === 'ritual' || activeScene === 'reveal' ? ' scene-shell--cloth' : ''}`;

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
