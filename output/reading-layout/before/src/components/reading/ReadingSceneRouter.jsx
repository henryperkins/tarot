import {
  SceneShell,
  IdleScene,
  RitualScene,
  RevealScene,
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
  ritual: (props) => (
    <RitualScene
      {...props}
      showTitle={false}
    />
  ),
  reveal: (props) => (
    <RevealScene
      {...props}
      showTitle={false}
    />
  ),
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
  const className = orchestrator?.activeScene === 'interlude' ? '' : 'scene-shell';

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
