const IDLE_TIMEOUT_MS = 45000;
const MAX_RECONNECTS = 5;

function abortError() {
  return new DOMException('Reading stream paused.', 'AbortError');
}

async function waitForActivity(promise, signal) {
  let timer;
  let onAbort;
  const interrupted = new Promise((_, reject) => {
    onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
    timer = setTimeout(() => reject(new Error('Reading stream became silent.')), IDLE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, interrupted]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

function waitForRetry(delay, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function responseError(response, signal) {
  let payload;
  try {
    payload = await waitForActivity(response.json(), signal);
  } catch {
    // Proxy errors may be HTML rather than a public API error payload.
  }
  const fallbackByStatus = {
    401: 'Please sign in to generate a personal narrative.',
    403: 'This request couldn’t be resumed. Please try again.',
    404: 'This request couldn’t be resumed. Please try again.',
    409: 'This request couldn’t be completed. Please refresh and try again.',
    410: 'This request expired. Please generate a new narrative.',
    429: 'You’ve reached your reading limit. Please try again later.'
  };
  const message = typeof payload?.error === 'string' ? payload.error.trim() : '';
  const error = new Error((message && message.length <= 240 ? message : '') ||
    fallbackByStatus[response.status] || 'Unable to generate reading at this time. Please try again in a moment.');
  error.terminal = response.status >= 400 && response.status < 500 && response.status !== 408;
  return error;
}

// Reconnect the same durable job, preserving its cursor and the caller's text.
// Comments count as activity but never advance the replay cursor.
export async function* readReadingJobEvents({ jobId, jobToken, cursor = 0, signal, onReconnect }) {
  let reconnects = 0;
  while (true) {
    if (signal?.aborted) throw abortError();
    const connection = new AbortController();
    const onAbort = () => connection.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    let reader;
    try {
      const response = await waitForActivity(fetch(`/api/tarot-reading/jobs/${jobId}/stream?cursor=${cursor}`, {
        headers: { Accept: 'text/event-stream', 'X-Job-Token': jobToken },
        signal: connection.signal
      }), connection.signal);
      if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
        throw await responseError(response, connection.signal);
      }
      reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming response missing body.');
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { done, value } = await waitForActivity(reader.read(), connection.signal);
        buffer += done ? decoder.decode() + '\n\n' : decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          const event = block.match(/^event:[ \t]*(.+)$/m)?.[1]?.trim();
          const rawData = block.split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim()).join('\n');
          if (!event || !rawData) continue;
          let data;
          try {
            data = JSON.parse(rawData);
          } catch {
            continue;
          }
          const terminal = event === 'done' || event === 'error';
          const eventId = data?.eventId;
          // Terminal events may be replayed at the exact requested cursor.
          if (Number.isFinite(eventId)) {
            if (eventId <= cursor && !terminal) continue;
            if (eventId > cursor) {
              cursor = eventId;
              reconnects = 0;
            }
          }
          yield { event, data };
          if (terminal) return;
        }
        if (done) throw new Error('Reading stream ended before completion.');
      }
    } catch (error) {
      if (signal?.aborted) throw abortError();
      if (error.terminal) throw error;
      if (reconnects >= MAX_RECONNECTS) {
        throw new Error('The reading connection was interrupted. Please try again in a moment.');
      }
    } finally {
      connection.abort();
      signal?.removeEventListener('abort', onAbort);
      if (reader) {
        reader.cancel().catch(() => null);
        reader.releaseLock();
      }
    }
    reconnects += 1;
    onReconnect?.(reconnects);
    await waitForRetry(1000 * (2 ** (reconnects - 1)), signal);
  }
}
