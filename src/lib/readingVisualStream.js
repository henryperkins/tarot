import { readingGesturesEnabled } from './readingGestureSettings.js';

const TERMINAL = new Set(['complete', 'failed', 'cancelled', 'expired', 'revoked']);
export const isVisualJobTerminal = status => TERMINAL.has(status);

function aborted() { return new DOMException('Visual subscription closed.', 'AbortError'); }
async function wait(promise, signal, timeout = 45000) {
  let timer;
  let abort;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      abort = () => reject(aborted());
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();
      timer = setTimeout(() => reject(new Error('Visual connection timed out.')), timeout);
    })]);
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
async function delay(ms, signal) {
  let timer;
  try { await wait(new Promise(resolve => { timer = setTimeout(resolve, ms); }), signal, ms + 1000); }
  finally { clearTimeout(timer); }
}

function checkResponse(response) {
  if (response.ok) return;
  const error = new Error('Visual accompaniment is temporarily unavailable.');
  // A not-yet-initialized job may briefly return 404 after narrative start.
  error.terminal = [401, 403, 410].includes(response.status);
  throw error;
}

/** Independent, bounded subscription. EOF recovers a full snapshot, never a delta.
 * Saved replays are addressed by their fresh server-issued visualJobId; original
 * handles keep the narrative result route. Every request here is a GET. */
export async function* readVisualJobEvents({ readingResultId, visualJobId = null, visualJobToken, signal, cursor = 0,
  fetchImpl = globalThis.fetch, retryDelay = 1000, maxFailures = 6 }) {
  const base = visualJobId ? `/api/tarot-reading/visual-replays/${encodeURIComponent(visualJobId)}`
    : `/api/tarot-reading/visuals/${encodeURIComponent(readingResultId)}`;
  const headers = { Accept: 'text/event-stream', ...(visualJobToken ? { 'X-Visual-Token': visualJobToken } : {}) };
  let failures = 0;
  let snapshotFirst = false;
  while (!signal?.aborted) {
    const connection = new AbortController();
    const abort = () => connection.abort();
    signal?.addEventListener('abort', abort, { once: true });
    let reader;
    let progressed = false;
    try {
      if (snapshotFirst) {
        const response = await wait(fetchImpl(base, { headers, signal: connection.signal }), connection.signal);
        checkResponse(response);
        const data = await wait(response.json(), connection.signal);
        if (Number.isSafeInteger(data.eventId)) cursor = Math.max(cursor, data.eventId);
        yield { event: 'snapshot', data };
        if (isVisualJobTerminal(data.status)) return;
      }
      const response = await wait(fetchImpl(`${base}/stream?cursor=${cursor}`, { headers, signal: connection.signal }), connection.signal);
      checkResponse(response);
      if (!response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Visual stream unavailable.');
      reader = response.body?.getReader();
      if (!reader) throw new Error('Visual response has no stream.');
      let buffer = '';
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await wait(reader.read(), connection.signal);
        buffer += done ? decoder.decode() + '\n\n' : decoder.decode(value, { stream: true });
        if (buffer.length > 2000000) throw new Error('Visual event exceeded its size limit.');
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || '';
        for (const block of blocks) {
          const event = block.match(/^event:[ \t]*(.+)$/m)?.[1]?.trim();
          const json = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
          if (!event || !json) continue;
          let data;
          try { data = JSON.parse(json); } catch { continue; }
          if (Number.isSafeInteger(data?.eventId)) {
            if (data.eventId < cursor) continue;
            if (data.eventId > cursor) { cursor = data.eventId; progressed = true; }
          }
          yield { event, data };
          if (event === 'done' || event === 'error' || isVisualJobTerminal(data?.status)) return;
        }
        if (done) break;
      }
    } catch (error) {
      if (signal?.aborted) throw aborted();
      if (error.terminal) throw error;
    } finally {
      connection.abort();
      signal?.removeEventListener('abort', abort);
      if (reader) { reader.cancel().catch(() => {}); reader.releaseLock(); }
    }
    failures = progressed ? 0 : failures + 1;
    if (failures >= maxFailures) throw new Error('Visual connection could not be restored.');
    snapshotFirst = true;
    await delay(Math.min(retryDelay * 2 ** failures, 10000), signal);
  }
  throw aborted();
}

const RETRY_FAILURES = new Map([[400, 'invalid-source'], [401, 'forbidden'], [403, 'forbidden'], [404, 'not-found']]);

/** One explicit saved-visual retry request. Cloud retries name only the owned
 * entry; the server reads the saved source itself. Local retries submit only
 * the explicit saved prose/context: IDs, bindings, capabilities and cached
 * sidecars confer no authority and are never sent. Callers never repeat this
 * automatically; failures are typed so the reading stays saved and readable. */
export async function postSavedVisualRetry({ cloud = false, entryId = null, savedSource = null, signal,
  fetchImpl = globalThis.fetch, timeout = 30000 } = {}) {
  const init = { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', ...(readingGesturesEnabled() ? { 'X-Reading-Cue-Display': '1' } : {}) }, signal };
  if (!cloud) {
    const source = { raw: savedSource?.raw, cards: savedSource?.cards, deckId: savedSource?.deckId,
      question: savedSource?.question, reflections: savedSource?.reflections };
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify({ savedSource: source });
  }
  const url = cloud ? `/api/journal/${encodeURIComponent(entryId)}/visual-retry` : '/api/tarot-reading/visual-retry';
  let response;
  try { response = await wait(fetchImpl(url, init), signal, timeout); } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw aborted();
    return { ok: false, reason: 'offline' };
  }
  let data = null;
  try { data = await wait(response.json(), signal, timeout); } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw aborted();
  }
  if (!response.ok) return { ok: false, reason: RETRY_FAILURES.get(response.status) || 'server', status: response.status };
  if (!data || typeof data !== 'object' || !Object.hasOwn(data, 'state')) return { ok: false, reason: 'invalid-response' };
  return { ok: true, state: data.state ?? null, resumeHandle: data.resumeHandle ?? null };
}
