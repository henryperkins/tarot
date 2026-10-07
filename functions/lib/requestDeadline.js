/** A deadline covers retries, response bodies and nested provider/tool calls. */
export function createDeadline({ signal, timeoutMs = 120000, deadlineAt } = {}) {
  const controller = new AbortController();
  const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000;
  const expiresAt = Math.min(Date.now() + duration, Number.isFinite(deadlineAt) ? deadlineAt : Infinity);
  const onAbort = () => controller.abort(signal.reason || new DOMException('Request cancelled.', 'AbortError'));
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out.', 'TimeoutError')), Math.max(0, expiresAt - Date.now()));
  return {
    signal: controller.signal,
    deadlineAt: expiresAt,
    remainingMs: () => Math.max(0, expiresAt - Date.now()),
    run: (operation) => runWithSignal(operation, controller.signal),
    dispose() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  };
}

export function runWithSignal(operation, signal) {
  signal?.throwIfAborted();
  if (!signal) return Promise.resolve().then(operation);
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason || new DOMException('Request cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      signal.throwIfAborted();
      return operation();
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export function delayWithSignal(milliseconds, signal) {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', abort);
    const timer = setTimeout(() => { cleanup(); resolve(); }, Math.max(0, milliseconds));
    const abort = () => {
      clearTimeout(timer);
      cleanup();
      reject(signal.reason || new DOMException('Request cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export function getTaskTimeoutMs(env, kind = 'text') {
  const reading = kind === 'reading';
  const configured = Number(reading ? env?.READING_TASK_TIMEOUT_MS : env?.TEXT_TASK_TIMEOUT_MS);
  const fallback = reading ? 240000 : 120000;
  return Number.isFinite(configured) && configured > 0
    ? Math.min(reading ? 600000 : 300000, Math.max(1000, configured))
    : fallback;
}

/** Keep the deadline alive until the consumer finishes or cancels the body. */
export function streamWithDeadline(stream, deadline) {
  const reader = stream.getReader();
  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    deadline.dispose();
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await deadline.run(() => reader.read());
        if (done) {
          cleanup();
          reader.releaseLock();
          controller.close();
        } else controller.enqueue(value);
      } catch (error) {
        cleanup();
        // Cancellation can itself hang on a broken upstream body.
        reader.cancel(error).catch(() => {});
        controller.error(error);
      }
    },
    cancel(reason) {
      cleanup();
      reader.cancel(reason).catch(() => {});
    }
  });
}
