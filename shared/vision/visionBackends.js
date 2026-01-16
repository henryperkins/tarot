// Lazy load TarotVisionPipeline to avoid bundling @xenova/transformers at import time
// This prevents Workers runtime errors when the vision code is loaded but not used
const IS_BROWSER = typeof window !== 'undefined';
let TarotVisionPipelineClass = null;
let LlamaVisionPipelineClass = null;
let HybridVisionPipelineClass = null;

async function getTarotVisionPipeline() {
  if (!TarotVisionPipelineClass) {
    const module = await import('./tarotVisionPipeline.js');
    TarotVisionPipelineClass = module.TarotVisionPipeline;
  }
  return TarotVisionPipelineClass;
}

async function getLlamaVisionPipeline() {
  if (!LlamaVisionPipelineClass) {
    const module = await import('./llamaVisionPipeline.js');
    LlamaVisionPipelineClass = module.LlamaVisionPipeline;
  }
  return LlamaVisionPipelineClass;
}

async function getHybridVisionPipeline() {
  if (!HybridVisionPipelineClass) {
    const module = await import('./hybridVisionPipeline.js');
    HybridVisionPipelineClass = module.HybridVisionPipeline;
  }
  return HybridVisionPipelineClass;
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

if (!IS_BROWSER) {
  VISION_BACKENDS['llama-vision'] = {
    id: 'llama-vision',
    label: 'Llama 3.2 Vision (server)',
    serverOnly: true,
    requiresEnv: ['AI'],
    create: async (options = {}) => {
      const Pipeline = await getLlamaVisionPipeline();
      return new Pipeline(options);
    }
  };

  VISION_BACKENDS['hybrid'] = {
    id: 'hybrid',
    label: 'Hybrid CLIP + Llama (server)',
    serverOnly: true,
    requiresEnv: ['AI'],
    create: async (options = {}) => {
      const Pipeline = await getHybridVisionPipeline();
      return new Pipeline(options);
    }
  };
}

function resolveBackendDescriptor(backendId, options = {}) {
  const requested = backendId && VISION_BACKENDS[backendId]
    ? VISION_BACKENDS[backendId]
    : VISION_BACKENDS['clip-default'];

  if (requested.serverOnly && IS_BROWSER) {
    return VISION_BACKENDS['clip-default'];
  }

  if (requested.requiresEnv && requested.requiresEnv.length > 0) {
    const missing = requested.requiresEnv.filter((key) => !options?.env?.[key]);
    if (missing.length > 0) {
      throw new Error(`Vision backend "${requested.id}" missing env: ${missing.join(', ')}`);
    }
  }

  return requested;
}

export async function createVisionBackend(options = {}) {
  const descriptor = resolveBackendDescriptor(options.backendId, options);
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
