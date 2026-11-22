// A status probe runs only the CLI's credential check and never returns account
// details. Share a pending check across simultaneous dashboard requests.
export function createSubscriptionStatus(provider, checkLogin) {
  const stopped = new AbortController();
  let pending;
  async function probe() {
    try {
      await checkLogin({ signal: AbortSignal.any([stopped.signal, AbortSignal.timeout(9000)]) });
      return { provider, ready: true };
    } catch (error) {
      const reason = ['login_required', 'unsupported_version'].includes(error?.code) ? error.code : 'cli_unavailable';
      return { provider, ready: false, reason };
    }
  }
  return {
    read() {
      pending ??= probe().finally(() => { pending = undefined; });
      return pending;
    },
    stop() {
      stopped.abort();
      return pending;
    }
  };
}
