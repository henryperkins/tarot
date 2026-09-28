export const MEMORY_REQUEST_TIMEOUT_MS = 15000;

/** Read JSON without surfacing gateway HTML, parser errors, or internal service details. */
export async function requestMemoryJson(url, options = {}, action = 'load memories', timeoutMs = MEMORY_REQUEST_TIMEOUT_MS) {
  const { signal, ...requestOptions } = options;
  const controller = new AbortController();
  const cancel = () => controller.abort(signal.reason);
  if (signal?.aborted) cancel();
  else signal?.addEventListener('abort', cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const failure = `We could not ${action}. Please try again.`;

  try {
    const response = await fetch(url, { credentials: 'include', ...requestOptions, signal: controller.signal });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error('Your session has expired. Sign in again to manage your memories.');
      if (response.status === 403) throw new Error('You do not have access to these memories. Check that you are signed in to the right account.');
      if (response.status === 429) throw new Error('Too many memory requests. Wait a moment and try again.');
      if (response.status === 400 && typeof data?.error === 'string') throw new Error(data.error);
      throw new Error(failure);
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(failure);
    if (requestOptions.method && requestOptions.method !== 'GET' && data.success !== true) throw new Error(failure);
    return data;
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timedOut) {
      throw new Error(action === 'load memories'
        ? 'Loading memories took too long. Check your connection and try again.'
        : 'We could not confirm the change to your memories. Refresh memories before trying again.');
    }
    if (error instanceof TypeError) {
      throw new Error(action === 'load memories'
        ? 'We could not load your memories. Check your connection and try again.'
        : 'We could not confirm the change to your memories. Check your connection and refresh memories before trying again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export function parseMemoryList(data) {
  if (!Array.isArray(data?.memories) || data.memories.some(memory => !memory
    || typeof memory.id !== 'string' || !memory.id
    || typeof memory.text !== 'string')) {
    throw new Error('We could not load your memories. Please try again.');
  }
  return data.memories;
}
