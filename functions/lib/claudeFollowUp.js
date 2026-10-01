import { callClaudeCode } from './claudeCode.js';
import { MEMORY_TOOL_DEFINITION } from './memoryTool.js';

const MEMORY_DECISION_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['response', 'memory'],
  properties: {
    response: { type: ['string', 'null'] },
    memory: { anyOf: [
      { type: 'null' },
      {
        ...MEMORY_TOOL_DEFINITION.input_schema,
        additionalProperties: false,
        properties: {
          ...MEMORY_TOOL_DEFINITION.input_schema.properties,
          text: { type: 'string', minLength: 3, maxLength: 200 },
          keywords: { type: 'array', maxItems: 5, items: { type: 'string', maxLength: 40 } }
        }
      }
    ] }
  }
};

const MEMORY_DECISION_INSTRUCTIONS = `
The application executes save_memory_note for you; there are no built-in tools to call.
Return a structured decision with exactly response and memory.
To answer, set response to your complete answer and memory to null.
To request save_memory_note, set response to null and memory to its arguments.
The application will return the real tool result, after which you should answer.
Never claim that a memory was saved before receiving a successful tool result.
Only save a new, durable insight; do not repeat a previous memory request.
Tool description: ${MEMORY_TOOL_DEFINITION.description}`;

export async function generateClaudeFollowUp(env, { systemPrompt, userPrompt, enableMemoryTool, onToolCall, signal }) {
  const messages = [{ role: 'user', content: userPrompt }];
  if (!enableMemoryTool) {
    return (await callClaudeCode(env, { task: 'followup', systemPrompt, messages, signal })).text;
  }
  const seenMemories = new Set();
  for (let round = 0; round <= 2; round++) {
    signal?.throwIfAborted();
    const result = await callClaudeCode(env, {
      task: 'followup', systemPrompt: `${systemPrompt}\n${MEMORY_DECISION_INSTRUCTIONS}`,
      messages, responseSchema: MEMORY_DECISION_SCHEMA, signal
    });
    const { response, memory } = result.structured;
    if (memory === null && typeof response === 'string' && response.trim()) return response.trim();
    if (response !== null || !memory || typeof onToolCall !== 'function') throw new Error('Invalid Claude memory decision.');
    if (round === 2) throw new Error('Claude memory tool round-trip limit reached.');
    const key = `${memory.category}:${memory.text.trim().toLowerCase()}`;
    if (seenMemories.has(key)) throw new Error('Claude repeated a memory request.');
    seenMemories.add(key);
    signal?.throwIfAborted();
    const toolResult = await onToolCall('save_memory_note', memory);
    messages.push({ role: 'assistant', content: JSON.stringify({ response: null, memory }) });
    messages.push({ role: 'user', content: `Application tool result for save_memory_note: ${JSON.stringify(toolResult)}. Continue with your answer.` });
  }
  throw new Error('Claude returned no follow-up answer.');
}
