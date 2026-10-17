// Dedicated local qualification instrumentation. No content, capabilities or
// binding objects leave these probes. Ordinary dev and production are inert.
export function cueTimingProbeActive() {
  return Boolean(import.meta.env?.DEV && import.meta.env?.VITE_CUE_TIMING_PROBE === 'true'
    && globalThis.__cueTimingSink?.active === true && typeof globalThis.__cueTimingSink.emit === 'function');
}
const fields = new Set(['runId', 'sourceRevision', 'eventId', 'eventType', 'start', 'end', 'cueId', 'ledgerRevision', 'complete', 'mode', 'sha256', 'serverAvailableAt', 'serverAnnotationStartedAt', 'serverAnnotationFinishedAt', 'serverLedgerCommittedAt']);
export function emitCueTiming(type, value) {
  if (!cueTimingProbeActive()) return;
  const event = { type, at: performance.now() };
  for (const [key, item] of Object.entries(value)) {
    if (fields.has(key) && (typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))
      || (typeof item === 'string' && item.length <= 200))) event[key] = item;
  }
  globalThis.__cueTimingSink.emit(event);
}

// Runs after association wrapping; leaf spans describe exact source projection,
// never opportunities/cues. Any number of overlapping anchors can reference the
// same leaf without DOM nesting/splitting or changing the gesture reducer.
export function remarkCueSourcePositions({ raw = '', enabled = cueTimingProbeActive() } = {}) {
  return tree => {
    if (!enabled) return;
    const visit = node => {
      if (['code', 'inlineCode', 'html', 'link', 'image'].includes(node.type)) return;
      if (!node.children) return;
      node.children = node.children.map(child => {
        if (child.type !== 'text') { visit(child); return child; }
        const start = child.position?.start?.offset;
        const end = child.position?.end?.offset;
        if (!Number.isInteger(start) || !Number.isInteger(end) || raw.slice(start, end) !== child.value) return child;
        return { type: 'cueSourceFragment', position: child.position,
          data: { hName: 'span', hProperties: { dataCueSourceStart: String(start), dataCueSourceEnd: String(end) } },
          children: [child] };
      });
      // These exact delimiter intervals are recognized by the parser, not
      // inferred by stripping characters from arbitrary raw prose.
      if (['strong', 'emphasis', 'delete'].includes(node.type) && node.children.length) {
        const start = node.position?.start?.offset;
        const end = node.position?.end?.offset;
        const first = node.children[0].position?.start?.offset;
        const last = node.children.at(-1).position?.end?.offset;
        if ([start, end, first, last].every(Number.isInteger)) {
          node.data = { ...node.data, hProperties: { ...node.data?.hProperties,
            dataCueSyntax: `${start}:${first} ${last}:${end}` } };
        }
      }
    };
    visit(tree);
  };
}

export async function emitCueSourceDigest({ runId, sourceRevision, raw }) {
  if (!cueTimingProbeActive()) return;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  emitCueTiming('source-digest', { runId, sourceRevision, end: raw.length,
    sha256: Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('') });
}
