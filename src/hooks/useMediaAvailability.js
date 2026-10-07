import { useEffect, useState } from 'react';

let capabilityRequest = null;
let requestedAt = 0;

function fetchAvailability() {
  if (!capabilityRequest || Date.now() - requestedAt > 60000) {
    requestedAt = Date.now();
    capabilityRequest = fetch('/api/generate-card-video?capabilities=true', { credentials: 'same-origin' })
      .then(async response => response.ok && (await response.json()).cardVideo === true)
      .catch(() => false);
  }
  return capabilityRequest;
}

/** Fail closed while loading or when server capability discovery is unavailable. */
export function useMediaAvailability() {
  const [cardVideo, setCardVideo] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchAvailability().then(available => { if (!cancelled) setCardVideo(available); });
    return () => { cancelled = true; };
  }, []);
  return { cardVideo };
}
