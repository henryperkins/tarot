import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCodexReadingStream } from '../functions/lib/codexReadingStream.js';
import { createReadingPassageGuard } from '../functions/lib/readingPassageGuard.js';

const text = 'The Star offers hope.\n\n';
function setup(options) {
  const work = [];
  const stream = createCodexReadingStream({
    meta: { requestId: 'lifecycle-test', provider: 'codex-subscription' },
    guard: createReadingPassageGuard({ cardsInfo: [{ card: 'The Star' }], spreadKey: 'single' }),
    source: async function* () {
      yield { type: 'delta', text };
      yield { type: 'done', result: { text } };
    },
    onComplete: async () => ({ requestId: 'lifecycle-test' }),
    waitUntil(promise) { work.push(promise); promise.catch(() => {}); },
    ...options
  });
  return { stream, work };
}
async function events(stream) {
  const reader = stream.getReader();
  let timer;
  const collected = [];
  try {
    await Promise.race([
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = new TextDecoder().decode(value);
          collected.push({ type: chunk.match(/^event: (.+)/m)[1], data: JSON.parse(chunk.match(/^data: (.+)/m)[1]) });
        }
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('stream body did not close')), 250); })
    ]);
    return collected;
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

test('failing error cleanup cannot suppress the terminal error or reject background stream work', async () => {
  let finalized = 0;
  const { stream, work } = setup({
    source: async function* () { yield { type: 'delta', text }; throw new Error('private provider detail'); },
    onError: async () => { throw new Error('private refund detail'); },
    onFinally: async () => { finalized++; }
  });
  const received = await events(stream);
  assert.deepEqual(received.map(event => event.type), ['meta', 'delta', 'error']);
  assert.doesNotMatch(JSON.stringify(received), /private/);
  assert.equal(finalized, 1);
  assert.deepEqual((await Promise.allSettled(work)).map(result => result.status), ['fulfilled']);
});

test('failing final cleanup closes an already completed body without adding an error or rejecting background work', async () => {
  const { stream, work } = setup({ onFinally: async () => { throw new Error('private telemetry detail'); } });
  const received = await events(stream);
  assert.deepEqual(received.map(event => event.type), ['meta', 'delta', 'done']);
  assert.equal(received.at(-1).data.fullText, text);
  assert.deepEqual((await Promise.allSettled(work)).map(result => result.status), ['fulfilled']);
});
