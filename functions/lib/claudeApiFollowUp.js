import { callClaudeMessages, ClaudeApiError } from './anthropicMessages.js';
import { MEMORY_TOOL_DEFINITION } from './memoryTool.js';

// Thinking counts toward max_tokens; the prompt keeps the reply itself short.
const FOLLOW_UP_MAX_TOKENS = 8000;
const FOLLOW_UP_EFFORT = 'medium';
const MAX_MEMORY_ROUNDS = 2;

/**
 * Answer a follow-up question with Claude through the Anthropic API.
 *
 * When the memory tool is enabled, Claude may call save_memory_note. The
 * application runs it through `onToolCall`, sends the real result back, and
 * Claude continues. Text from every turn is joined, as on the Responses path.
 *
 * @returns {Promise<{ text: string, model: string }>}
 */
export async function generateClaudeApiFollowUp(env, {
  systemPrompt,
  userPrompt,
  enableMemoryTool,
  onToolCall,
  signal,
  requestId
}) {
  const messages = [{ role: 'user', content: userPrompt }];
  const tools = enableMemoryTool ? [MEMORY_TOOL_DEFINITION] : undefined;
  const textParts = [];

  for (let round = 0; ; round++) {
    const result = await callClaudeMessages(env, {
      system: systemPrompt,
      messages,
      tools,
      maxTokens: FOLLOW_UP_MAX_TOKENS,
      effort: FOLLOW_UP_EFFORT,
      signal,
      requestId
    });
    if (result.text) textParts.push(result.text);

    if (result.stopReason !== 'tool_use') {
      const text = textParts.join('\n\n').trim();
      if (!text) throw new ClaudeApiError('Claude returned no follow-up text.');
      return { text, model: result.model };
    }
    if (round >= MAX_MEMORY_ROUNDS) {
      throw new ClaudeApiError('Claude memory tool round-trip limit reached.');
    }

    const toolResults = [];
    for (const block of result.message.content) {
      if (block.type !== 'tool_use') continue;
      let output;
      if (block.name === MEMORY_TOOL_DEFINITION.name && typeof onToolCall === 'function') {
        signal?.throwIfAborted();
        output = await onToolCall(block.name, block.input);
      } else {
        output = { success: false, message: 'Unknown tool' };
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(output ?? null),
        ...(output?.success === false ? { is_error: true } : {})
      });
    }
    if (!toolResults.length) {
      throw new ClaudeApiError('Claude stopped for tool use without a tool call.');
    }
    // Send the assistant turn back unchanged; its thinking blocks must stay intact.
    messages.push({ role: 'assistant', content: result.message.content });
    messages.push({ role: 'user', content: toolResults });
  }
}
