// Provider-side fixture: split JSON records across arbitrary network reads.
export function modalSseResponse(text, {
  finishReason = 'stop',
  reasoning = 'Private provider reasoning must stay private.',
  fragmentSize = 19
} = {}) {
  const pieces = [text.slice(0, Math.ceil(text.length / 2)), text.slice(Math.ceil(text.length / 2))];
  const events = [
    { choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: reasoning }, finish_reason: null }] },
    ...pieces.map((content) => ({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })),
    { choices: [{ index: 0, delta: {}, finish_reason: finishReason }] },
    { choices: [], usage: { prompt_tokens: 200, completion_tokens: 300, total_tokens: 500, reasoning_tokens: 100 } }
  ];
  const bytes = new TextEncoder().encode(events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n');
  let offset = 0;
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + fragmentSize));
      offset += fragmentSize;
    }
  }), { headers: { 'content-type': 'text/event-stream' } });
}
