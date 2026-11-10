/** Serialize buffered card work; a full reading owns playback until terminal. */
export function createNarrationCoordinator({ speak, onWaiting = () => {} }) {
  let active = null;
  let queued = null;
  let waiting = false;
  const setWaiting = value => {
    if (waiting === value) return;
    waiting = value;
    onWaiting(value);
  };
  const discardQueued = () => {
    queued?.resolve();
    queued = null;
    setWaiting(false);
  };
  const cancelQueued = ({ preserveActive = false } = {}) => {
    discardQueued();
    if (!preserveActive) {
      active?.resolve();
      active = null;
    }
  };
  const fail = entry => {
    if (active !== entry) return;
    discardQueued();
    active = null;
    entry.resolve();
  };
  const dispatch = entry => {
    active = entry;
    setWaiting(false);
    // Install ownership before speak: the player emits state synchronously.
    let pending;
    try { pending = speak(entry.options); }
    catch { fail(entry); return; }
    Promise.resolve(pending).then(() => {
      entry.resolve();
      if (active !== entry) return;
      entry.settled = true;
      if (!entry.success) { fail(entry); return; }
      if (entry.options.context === 'full-reading' && !entry.terminal) return;
      if (queued) {
        const next = queued;
        queued = null;
        dispatch(next);
      } else if (entry.terminal) active = null;
    }, () => fail(entry));
  };
  const identity = options => JSON.stringify([
    options.text.trim(), options.context, options.provider, options.voice,
    options.speed, options.format, options.emotion
  ]);
  const request = options => {
    if (!options.enabled || !options.text?.trim()) return Promise.resolve();
    const full = options.context === 'full-reading';
    const key = identity(options);
    if (queued?.options.context === 'full-reading') return full && queued.key === key ? queued.promise : Promise.resolve();
    if (active?.options.context === 'full-reading') return full && active.key === key ? active.promise : Promise.resolve();
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    const entry = { options: { ...options }, key, promise, resolve, settled: false, success: false, terminal: false };
    if (active && !active.settled) {
      discardQueued();
      queued = entry;
      setWaiting(full);
    } else dispatch(entry);
    return promise;
  };
  const updateState = state => {
    const entry = active;
    if (!entry || state.reason === 'replaced') return;
    if (state.status === 'idle' || state.status === 'stopped') { cancelQueued(); return; }
    if (state.context !== entry.options.context) return;
    if (state.status === 'error' || state.status === 'unlock-failed') { fail(entry); return; }
    if (['playing', 'paused', 'completed'].includes(state.status)) entry.success = true;
    if (state.status === 'completed') {
      entry.terminal = true;
      if (entry.settled) active = null;
    }
  };
  return { request, updateState, cancelQueued };
}
