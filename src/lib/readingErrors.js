import { formatReading } from './formatting.js';

export function createReadingError(payload = {}) {
  const message = typeof payload.message === 'string' && payload.message.trim()
    ? payload.message.trim()
    : 'Unable to generate reading at this time. Please try again in a moment.';
  const error = new Error(message);
  error.code = typeof payload.code === 'string' ? payload.code : null;
  error.retryable = payload.retryable === true;
  return error;
}

export function formatReadingFailure(error) {
  const message = typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'Unable to generate reading at this time. Please try again in a moment.';
  return {
    ...formatReading(message),
    isError: true,
    isStreaming: false,
    isServerStreamed: false,
    errorCode: error?.code || null,
    retryable: error?.retryable === true
  };
}
