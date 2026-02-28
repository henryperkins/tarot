import { createContext, useContext } from 'react';

export const SceneContext = createContext({
  currentScene: 'idle',
  transitionTo: () => {},
  sceneData: {}
});

export function useScene() {
  return useContext(SceneContext);
}
