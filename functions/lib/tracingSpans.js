import { trace, SpanStatusCode } from '@opentelemetry/api';

function toAttributes(attributes) {
  if (!attributes || typeof attributes !== 'object') {
    return {};
  }
  return attributes;
}

export async function withSpan(spanName, attributes, fn) {
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
