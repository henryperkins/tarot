import { createContext, useContext } from 'react';

export const SceneContext = createContext({
  activeScene: 'idle',
  currentScene: 'idle',
  transitionTo: () => {},
  sceneModels: {},
  sceneData: {}
});

export function useScene() {
  return useContext(SceneContext);
}
