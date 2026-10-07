// Provider-side fixture: a Messages API event stream, as the Anthropic SDK reads it.
export const CLAUDE_API_URL_PREFIX = 'https://api.anthropic.com/v1/messages';

export function claudeSseResponse(content, {
  model = 'claude-opus-5-5',
  stopReason = 'end_turn',
  stopDetails = null,
  inputTokens = 120,
  outputTokens = 80
} = {}) {
  const blocks = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
  const events = [['message_start', {
    type: 'message_start',
    message: {
      id: 'msg_test', type: 'message', role: 'assistant', model, content: [],
      stop_reason: null, stop_sequence: null,
      usage: { input_tokens: inputTokens, output_tokens: 1 }
    }
  }]];
  blocks.forEach((block, index) => {
    if (block.type === 'thinking') {
      events.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '', signature: '' } }]);
      events.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: 'test-signature' } }]);
    } else if (block.type === 'tool_use') {
      events.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: block.id, name: block.name, input: {} } }]);
      events.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(block.input) } }]);
    } else {
      events.push(['content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }]);
      events.push(['content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: block.text } }]);
    }
    events.push(['content_block_stop', { type: 'content_block_stop', index }]);
  });
  events.push(['message_delta', {
    type: 'message_delta',
    delta: { stop_reason: stopReason, stop_sequence: null, ...(stopDetails ? { stop_details: stopDetails } : {}) },
    usage: { output_tokens: outputTokens }
  }]);
  events.push(['message_stop', { type: 'message_stop' }]);
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream', 'request-id': 'req_test' } });
}

export function claudeErrorResponse(status, message = 'private upstream details') {
  return new Response(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message } }), {
    status,
    headers: { 'content-type': 'application/json', 'request-id': 'req_test_error' }
  });
}
