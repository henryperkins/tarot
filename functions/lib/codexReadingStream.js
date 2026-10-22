import { formatSSEEvent } from './readingStream.js';

/** Own generation, validation and request cleanup for the lifetime of the body. */
export function createCodexReadingStream({ source, guard, meta, signal, waitUntil, onComplete, onAccepted, onError, onFinally }) {
  const abortController = new AbortController();
  const encoder = new TextEncoder();
  let cancelled = false;
  let work;
  const settleCleanup = async (callback, payload, phase) => {
    try {
      await callback?.(payload);
    } catch {
      // Cleanup failures cannot replace terminal delivery or expose upstream
      // details. Keep an operational signal without logging private payloads.
      console.warn(`[codexReadingStream] ${phase} cleanup failed.`);
    }
  };
  const onAbort = () => abortController.abort(signal.reason);
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  return new ReadableStream({
    start(controller) {
      const emit = (type, data) => {
        abortController.signal.throwIfAborted();
        if (!cancelled) controller.enqueue(encoder.encode(formatSSEEvent(type, data)));
      };
      work = (async () => {
        let terminal = false;
        try {
          emit('meta', meta);
          for await (const event of source(abortController.signal)) {
            abortController.signal.throwIfAborted();
            if (event.type === 'delta') {
              for (const text of guard.push(event.text)) emit('delta', { text });
            } else if (event.type === 'done') {
              const tail = guard.finish();
              if (guard.fullText !== event.result.text) throw new Error('Reading source changed during delivery.');
              const completion = await onComplete(event.result, abortController.signal);
              abortController.signal.throwIfAborted();
              for (const text of tail) emit('delta', { text });
              emit('done', { ...completion, fullText: event.result.text, provider: 'codex-subscription' });
              terminal = true;
              await settleCleanup(onAccepted, undefined, 'Accepted');
              break;
            }
          }
          if (!terminal) throw new Error('Reading stream ended without completion.');
        } catch (error) {
          await settleCleanup(onError, error, 'Error');
          if (!cancelled) controller.enqueue(encoder.encode(formatSSEEvent('error', {
            code: error?.code === 'reading_stream_rejected' ? 'reading_stream_rejected' : 'reading_stream_failed',
            message: 'We could not finish this reading. Please try again.'
          })));
        } finally {
          abortController.abort();
          signal?.removeEventListener('abort', onAbort);
          await settleCleanup(onFinally, undefined, 'Final');
          if (!cancelled) controller.close();
        }
      })();
      if (typeof waitUntil === 'function') waitUntil(work);
      // start must return promptly; the ReadableStream owns work until terminal.
    },
    cancel(reason) {
      cancelled = true;
      abortController.abort(reason);
      return work;
    }
  });
}
