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

export function getVisionBackendConfiguration(backendId, env) {
  const descriptor = Object.hasOwn(VISION_BACKENDS, backendId) ? VISION_BACKENDS[backendId] : VISION_BACKENDS['clip-default'];
  const missing = (descriptor.requiresEnv || []).filter(key => key === 'AI' ? typeof env?.AI?.run !== 'function' : !env?.[key]);
  return { id: descriptor.id, missing };
}

export async function createVisionBackend(options = {}) {
  const { id, missing } = getVisionBackendConfiguration(options.backendId, options.env);
  if (missing.length) throw new Error(`Vision backend "${id}" missing env: ${missing.join(', ')}`);
  const descriptor = VISION_BACKENDS[id];
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
