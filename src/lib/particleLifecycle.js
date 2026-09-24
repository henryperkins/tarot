// A canvas has one owner at a time, including while an asynchronous load is
// still resolving during StrictMode cleanup or a scene transition.
export function createParticleSession(loadEngine) {
  let pending = Promise.resolve();

  return {
    mount(parameters) {
      let cancelled = false;
      let container = null;
      const ready = pending.then(async () => {
        if (cancelled || !parameters.element.isConnected) return;
        const engine = await loadEngine();
        if (cancelled || !parameters.element.isConnected) return;
        let loaded;
        try {
          loaded = await engine.load(parameters);
        } catch (error) {
          // The engine registers its container before asynchronous startup.
          // Even a rejected load can own an observer on this session's canvas.
          const failed = (engine.dom?.() || []).filter(item => item.id.description === parameters.id);
          failed.forEach(item => item.destroy());
          throw error;
        }
        if (cancelled || !parameters.element.isConnected) loaded?.destroy();
        else container = loaded;
      });
      // A failed decorative load must not prevent a later scene from loading.
      pending = ready.catch(() => {});

      return {
        ready,
        dispose() {
          cancelled = true;
          container?.destroy();
          container = null;
        }
      };
    }
  };
}
