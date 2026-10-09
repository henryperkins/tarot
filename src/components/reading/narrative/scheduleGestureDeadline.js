/**
 * Timers can wake before a fractional performance.now() deadline. Recheck the
 * clock rather than dispatching an early no-op that leaves motion running.
 */
export function scheduleGestureDeadline(deadline, onDeadline, {
  now = () => performance.now(),
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = timer => globalThis.clearTimeout(timer)
} = {}) {
  let cancelled = false;
  let timer;
  const schedule = () => {
    timer = setTimer(() => {
      if (cancelled) return;
      const current = now();
      if (current < deadline) schedule();
      else {
        cancelled = true;
        onDeadline(current);
      }
    }, Math.max(1, Math.ceil(deadline - now())));
  };
  schedule();
  return () => {
    cancelled = true;
    clearTimer(timer);
  };
}
