// Keep the network reader behind playback, including while paused. A long
// narration must not fill either the SourceBuffer or an in-memory chunk queue.
const BUFFER_AHEAD_SECONDS = 60;
const KEEP_BEHIND_SECONDS = 15;
const APPEND_BYTES = 64 * 1024;

export async function streamAudioToMediaSource(response, mediaSource, { signal, getAudio, onError, contentType = 'audio/mpeg' }) {
  const reader = response.body.getReader();
  const lifetime = new AbortController();
  let audio;
  let playbackError;
  const abortError = () => new DOMException('Audio stream stopped', 'AbortError');
  const cancel = () => {
    lifetime.abort();
    void reader.cancel().catch(() => {});
  };
  const playbackFailed = () => {
    playbackError = new Error('Audio playback failed');
    cancel();
  };
  signal?.addEventListener('abort', cancel, { once: true });
  mediaSource.addEventListener('sourceclose', cancel, { once: true });

  // Both synchronous append failures and asynchronous decoder errors belong
  // to this promise, rather than escaping an updateend event handler.
  const operation = (target, event, start = () => {}) => new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, done);
      target.removeEventListener('error', failed);
      lifetime.signal.removeEventListener('abort', aborted);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('Audio buffer could not be decoded')); };
    const aborted = () => { cleanup(); reject(abortError()); };
    target.addEventListener(event, done, { once: true });
    target.addEventListener('error', failed, { once: true });
    lifetime.signal.addEventListener('abort', aborted, { once: true });
    if (lifetime.signal.aborted) { aborted(); return; }
    try { start(); } catch (error) { cleanup(); reject(error); }
  });

  const waitForPlayback = predicate => new Promise((resolve, reject) => {
    const audio = getAudio();
    if (!audio) { reject(new Error('Audio player is unavailable')); return; }
    const events = ['timeupdate', 'seeking', 'ended'];
    const cleanup = () => {
      events.forEach(event => audio.removeEventListener(event, check));
      audio.removeEventListener('error', failed);
      lifetime.signal.removeEventListener('abort', aborted);
    };
    const check = () => { if (predicate()) { cleanup(); resolve(); } };
    const failed = () => { cleanup(); reject(new Error('Audio playback failed')); };
    const aborted = () => { cleanup(); reject(abortError()); };
    events.forEach(event => audio.addEventListener(event, check));
    audio.addEventListener('error', failed, { once: true });
    lifetime.signal.addEventListener('abort', aborted, { once: true });
    if (lifetime.signal.aborted) aborted();
    else check();
  });

  try {
    if (signal?.aborted) cancel();
    if (lifetime.signal.aborted) throw abortError();
    if (mediaSource.readyState !== 'open') await operation(mediaSource, 'sourceopen');
    const buffer = mediaSource.addSourceBuffer(contentType);
    audio = getAudio();
    audio?.addEventListener('error', playbackFailed, { once: true });
    const currentTime = () => getAudio()?.currentTime || 0;
    const bufferedEnd = () => buffer.buffered.length ? buffer.buffered.end(buffer.buffered.length - 1) : 0;
    const evictPlayed = async (keepBehind = KEEP_BEHIND_SECONDS) => {
      const cutoff = currentTime() - keepBehind;
      if (!buffer.buffered.length || cutoff <= buffer.buffered.start(0)) return false;
      await operation(buffer, 'updateend', () => buffer.remove(0, cutoff));
      return true;
    };
    while (!lifetime.signal.aborted) {
      await waitForPlayback(() => bufferedEnd() - currentTime() < BUFFER_AHEAD_SECONDS);
      const { done, value } = await reader.read();
      if (lifetime.signal.aborted) throw abortError();
      if (done) break;
      if (!value?.byteLength) continue;
      for (let offset = 0; offset < value.byteLength; offset += APPEND_BYTES) {
        await waitForPlayback(() => bufferedEnd() - currentTime() < BUFFER_AHEAD_SECONDS);
        await evictPlayed();
        const chunk = value.subarray(offset, offset + APPEND_BYTES);
        while (true) {
          try {
            await operation(buffer, 'updateend', () => buffer.appendBuffer(chunk));
            break;
          } catch (error) {
            if (error.name !== 'QuotaExceededError') throw error;
            // Retry the SAME bytes after reclaiming played audio. If the
            // browser has a smaller quota, wait for consumption before retrying.
            if (await evictPlayed(0)) continue;
            const previousTime = currentTime();
            if (bufferedEnd() <= previousTime + 0.25) throw error;
            await waitForPlayback(() => currentTime() > previousTime + 0.25);
          }
        }
      }
    }
    if (!lifetime.signal.aborted && mediaSource.readyState === 'open') mediaSource.endOfStream();
  } catch (error) {
    if (!signal?.aborted) onError(playbackError || error);
  } finally {
    audio?.removeEventListener('error', playbackFailed);
    signal?.removeEventListener('abort', cancel);
    mediaSource.removeEventListener('sourceclose', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
