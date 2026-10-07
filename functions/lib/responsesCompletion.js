/** Refuse partial Responses streams, including a connection ending without completion. */
export function validateResponsesStream(source, { onComplete, onError } = {}) {
  const reader = source.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  let responseMeta = null;
  let settled = false;
  const finish = async (error) => {
    if (settled) return;
    settled = true;
    if (error) await onError?.(error, responseMeta);
    else await onComplete?.(responseMeta);
  };
  const inspect = (block) => {
    if (!block.trim()) return;
    let type = '';
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) type = line.slice(6).trim();
      if (line.startsWith('data:')) data.push(line.slice(5).trim());
    }
    if (!data.length || data.join('\n') === '[DONE]') return;
    let parsed;
    try { parsed = JSON.parse(data.join('\n')); }
    catch { throw new Error('Responses API returned malformed stream data.'); }
    type = parsed.type || type;
    if (parsed.response) responseMeta = parsed.response;
    if (['response.incomplete', 'response.failed', 'response.error', 'error'].includes(type)) {
      const error = new Error(`Responses API returned ${type}; a complete answer is required.`);
      error.code = 'response_incomplete';
      error.model = parsed.response?.model || null;
      error.usage = parsed.response?.usage || null;
      throw error;
    }
    if (type === 'response.completed') {
      if (parsed.response?.status && parsed.response.status !== 'completed') {
        throw new Error('Responses API returned an incomplete answer.');
      }
      completed = true;
    }
  };
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = done ? '' : blocks.pop() || '';
        for (const block of blocks) inspect(block);
        if (done) {
          if (!completed) throw new Error('Responses API stream ended before completion.');
          await finish();
          reader.releaseLock();
          controller.close();
        } else controller.enqueue(value);
      } catch (error) {
        await finish(error);
        reader.cancel(error).catch(() => {});
        controller.error(error);
      }
    },
    async cancel(reason) {
      reader.cancel(reason).catch(() => {});
      await finish(new DOMException('Response consumption cancelled.', 'AbortError'));
    }
  });
}
