export function getSceneModel(sceneModels, modelKey) {
  if (!sceneModels || typeof sceneModels !== 'object') {
    return {};
  }

  if (sceneModels[modelKey] && typeof sceneModels[modelKey] === 'object') {
    return sceneModels[modelKey];
  }

  const nested = sceneModels.sceneData;
  if (nested && typeof nested === 'object' && nested[modelKey] && typeof nested[modelKey] === 'object') {
    return nested[modelKey];
  }

  return sceneModels;
}
