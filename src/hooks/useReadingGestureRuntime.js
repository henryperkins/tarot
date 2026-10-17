import { useEffect, useState } from 'react';

let runtime = null;
let pending = null;
function loadRuntime() {
  if (!pending) pending = import('../components/reading/narrative/readingGestureRuntime.jsx')
    .then(module => { runtime = module; return module; })
    .catch(error => { pending = null; throw error; });
  return pending;
}

/** No import or preload until a caller explicitly enables the reading UI. */
export function useReadingGestureRuntime(enabled) {
  const [loaded, setLoaded] = useState(() => runtime);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    loadRuntime().then(module => { if (active) setLoaded(module); })
      // Plain prose remains readable after a failed optional chunk request.
      .catch(() => {});
    return () => { active = false; };
  }, [enabled]);
  return enabled ? loaded : null;
}
