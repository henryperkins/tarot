import { TarotVisionPipeline } from './tarotVisionPipeline.js';

const VISION_BACKENDS = {
  'clip-default': {
    id: 'clip-default',
    label: 'TarotVision CLIP ViT (default)',
    create: (options = {}) => new TarotVisionPipeline(options)
  }
};

function resolveBackendDescriptor(backendId) {
  if (backendId && VISION_BACKENDS[backendId]) {
    return VISION_BACKENDS[backendId];
  }
  return VISION_BACKENDS['clip-default'];
}

export function createVisionBackend(options = {}) {
  const descriptor = resolveBackendDescriptor(options.backendId);
  const instance = descriptor.create(options);
  return {
    id: descriptor.id,
    label: descriptor.label,
    instance,
    analyzeImages: (inputs, analysisOptions) => instance.analyzeImages(inputs, analysisOptions),
    warmup: () => (typeof instance._ensureCardEmbeddings === 'function' ? instance._ensureCardEmbeddings() : Promise.resolve()),
    getDeckProfile: () => instance.deckProfile
  };
}

export function listVisionBackends() {
  return Object.keys(VISION_BACKENDS);
}
