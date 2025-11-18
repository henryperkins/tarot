// Lazy load TarotVisionPipeline to avoid bundling @xenova/transformers at import time
// This prevents Workers runtime errors when the vision code is loaded but not used
let TarotVisionPipelineClass = null;

async function getTarotVisionPipeline() {
  if (!TarotVisionPipelineClass) {
    const module = await import('./tarotVisionPipeline.js');
    TarotVisionPipelineClass = module.TarotVisionPipeline;
  }
  return TarotVisionPipelineClass;
}

const VISION_BACKENDS = {
  'clip-default': {
    id: 'clip-default',
    label: 'TarotVision CLIP ViT (default)',
    create: async (options = {}) => {
      const Pipeline = await getTarotVisionPipeline();
      return new Pipeline(options);
    }
  }
};

function resolveBackendDescriptor(backendId) {
  if (backendId && VISION_BACKENDS[backendId]) {
    return VISION_BACKENDS[backendId];
  }
  return VISION_BACKENDS['clip-default'];
}

export async function createVisionBackend(options = {}) {
  const descriptor = resolveBackendDescriptor(options.backendId);
  const instance = await descriptor.create(options);
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
