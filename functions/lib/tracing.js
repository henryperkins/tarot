import {
  OTLPExporter,
  isHeadSampled,
  isRootErrorSpan,
  multiTailSampler,
} from '@microlabs/otel-cf-workers';

export { withSpan, withSpanSync } from './tracingSpans.js';
import { setExporterActive } from './tracingSpans.js';

const DEFAULT_DEV_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';

const TRACE_PROPAGATION_HOSTS = [
  '.openai.azure.com',
  '.cognitiveservices.azure.com',
  '.ai.azure.com',
  '.services.ai.azure.com',
  'api.anthropic.com',
  'api.openai.com',
  'models.inference.ai.azure.com',
];

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'api-key',
  'x-api-key',
  'ocp-apim-subscription-key',
  'cookie',
  'set-cookie',
]);

function parseSampleRatio(value, fallback) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < 0) return 0;
  if (parsed > 1) return 1;
  return parsed;
}

function shouldPropagateTraceContext(request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return TRACE_PROPAGATION_HOSTS.some(
    (suffix) => hostname === suffix || hostname.endsWith(suffix)
  );
}

function scrubSensitiveHeaders(spans) {
  for (const span of spans) {
    const attrs = span.attributes;
    if (!attrs) continue;
    for (const key of Object.keys(attrs)) {
      const lowerKey = key.toLowerCase();
      if (!lowerKey.includes('header.')) continue;
      const headerName = lowerKey.split('.').pop() || '';
      const normalizedName = headerName.replace(/_/g, '-');
      if (SENSITIVE_HEADER_NAMES.has(normalizedName)) {
        attrs[key] = '[REDACTED]';
      }
    }
  }

  return spans;
}

export function createTracingConfig(overrides = {}) {
  return (env) => {
    const isProduction = Boolean(env?.CF_VERSION_METADATA?.id);
    const configuredEndpoint = typeof env?.OTLP_ENDPOINT === 'string'
      ? env.OTLP_ENDPOINT.trim()
      : '';
    const endpoint = configuredEndpoint || (isProduction ? '' : DEFAULT_DEV_OTLP_ENDPOINT);

    const headers = {};
    if (env?.OTLP_AUTH_HEADER) {
      headers.Authorization = env.OTLP_AUTH_HEADER;
    }

    const defaultRatio = isProduction ? 0.1 : 1.0;
    const sampleRatio = parseSampleRatio(env?.OTEL_TRACE_SAMPLE_RATIO, defaultRatio);

    const baseConfig = {
      service: {
        name: overrides.serviceName || 'tableau-worker',
        namespace: 'tableau',
        version: overrides.serviceVersion || env?.CF_VERSION_METADATA?.id || '1.0.0',
      },
      handlers: {
        fetch: {
          acceptTraceContext: true,
        },
      },
      fetch: {
        includeTraceContext: shouldPropagateTraceContext,
      },
      sampling: {
        headSampler: {
          acceptRemote: true,
          ratio: sampleRatio,
        },
        tailSampler: multiTailSampler([isHeadSampled, isRootErrorSpan]),
      },
      postProcessor: scrubSensitiveHeaders,
      instrumentation: {
        instrumentGlobalFetch: true,
        instrumentGlobalCache: true,
      },
    };

    if (!endpoint) {
      setExporterActive(false);
      return {
        ...baseConfig,
        spanProcessors: []
      };
    }

    setExporterActive(true);
    return {
      ...baseConfig,
      exporter: new OTLPExporter({
        url: endpoint,
        headers,
      })
    };
  };
}

export function createDOTracingConfig(doName) {
  return createTracingConfig({
    serviceName: `tableau-do-${doName.toLowerCase()}`,
  });
}
