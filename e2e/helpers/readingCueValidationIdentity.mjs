// Shared by config, browser probes and borrowed qualification attachment.
export function validateCueOriginMappings(manifest) {
  const protectedPorts = [8787, 5175, 8789, 9235];
  const values = ['frontend', 'api', 'optimized'].map(kind => {
    const value = manifest.origins?.[kind];
    const url = new URL(value);
    const listeners = manifest.ownedResources?.listeners?.filter(listener => listener.kind === kind);
    if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || !url.port || protectedPorts.includes(Number(url.port))
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash || value !== url.origin
      || manifest.buildIdentity?.origins?.[kind] !== value || listeners?.length !== 1
      || listeners[0].host !== url.hostname || listeners[0].port !== Number(url.port)) {
      throw new Error('Owned origin/listener mapping mismatch.');
    }
    return value;
  });
  if (new Set(values).size !== values.length) throw new Error('Owned origins must be distinct.');
  return manifest.origins;
}

export function validateCueListenerIdentity(manifest, kind, actual) {
  validateCueOriginMappings(manifest);
  const identity = manifest.buildIdentity;
  if (!['frontend', 'optimized'].includes(kind) || actual.listenerKind !== kind || actual.servingOrigin !== manifest.origins[kind]
    || actual.runId !== identity.runId || actual.snapshotDigest !== identity.snapshotDigest
    || actual.apiMode !== 'offline-fail-closed' || identity.apiMode !== 'offline-fail-closed'
    || actual.outputIntegrity !== true || actual.outputDigest !== identity.outputDigest
    || !/^[a-f0-9]{64}$/.test(actual.outputDigest || '')
    || actual.servingFlags?.dev !== (kind === 'frontend') || actual.servingFlags?.prod !== (kind === 'optimized')
    || actual.servingFlags?.mode !== (kind === 'frontend' ? 'development' : 'reading-cue-validation')
    || actual.optimizedFlags?.dev !== false || actual.optimizedFlags?.prod !== true
    || actual.optimizedFlags?.mode !== 'reading-cue-validation'
    || JSON.stringify(actual.optimizedFlags) !== JSON.stringify(identity.optimizedFlags)) {
    throw new Error('Owned listener identity/output integrity mismatch.');
  }
  return actual;
}

export async function verifyCueListener(manifest, kind) {
  validateCueOriginMappings(manifest);
  const response = await fetch(new URL('/__cue_validation_identity', manifest.origins[kind]), { signal: AbortSignal.timeout(5000), cache: 'no-store', redirect: 'error' });
  if (response.status !== 200) throw new Error('Owned listener identity/output integrity unavailable.');
  return validateCueListenerIdentity(manifest, kind, await response.json());
}
