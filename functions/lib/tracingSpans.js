let trace = {
  getTracer() {
    return {
      startActiveSpan(_spanName, _options, fn) {
        return fn({
          setAttribute() {},
          setStatus() {},
          recordException() {},
          end() {}
        });
      }
    };
  }
};

let SpanStatusCode = {
  OK: 'ok',
  ERROR: 'error'
};

/**
 * Whether a real OTLP exporter is configured.
 * When false, withSpan / withSpanSync skip span creation entirely
 * to avoid allocating spans that are immediately discarded.
 */
let _exporterActive = false;

const NOOP_SPAN = {
  setAttribute() {},
  setStatus() {},
  recordException() {},
  end() {}
};

try {
  const otelApi = await import('@opentelemetry/api');
  trace = otelApi.trace;
  SpanStatusCode = otelApi.SpanStatusCode;
} catch {
  // Local test/dev environments can run without the optional tracing package
  // because spans are skipped entirely unless an exporter is activated.
}

/**
 * Called once from tracing.js after resolving the OTLP endpoint.
 */
export function setExporterActive(active) {
  _exporterActive = Boolean(active);
}

function toAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') {
    return {};
  }
  return attributes;
}

export async function withSpan(spanName, attributes, fn) {
  // Fast-path: skip span machinery when no exporter will consume spans
  if (!_exporterActive) {
    return fn(NOOP_SPAN);
  }

  const tracer = trace.getTracer('tableau-worker');
  return tracer.startActiveSpan(spanName, { attributes: toAttributes(attributes) }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export function withSpanSync(spanName, attributes, fn) {
  // Fast-path: skip span machinery when no exporter will consume spans
  if (!_exporterActive) {
    return fn(NOOP_SPAN);
  }

  const tracer = trace.getTracer('tableau-worker');
  return tracer.startActiveSpan(spanName, { attributes: toAttributes(attributes) }, (span) => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error?.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
