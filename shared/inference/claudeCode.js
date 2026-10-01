import { Validator } from '@cfworker/json-schema';

export const CLAUDE_CODE_TASKS = Object.freeze(['reading', 'followup', 'followup-repair', 'question', 'journal-summary']);
export const CLAUDE_CODE_MAX_BODY_BYTES = 262144;
export const CLAUDE_CODE_MAX_OUTPUT_BYTES = 2097152;

export function validateClaudeRequest(value) {
  if (!value || !CLAUDE_CODE_TASKS.includes(value.task)
    || typeof value.systemPrompt !== 'string' || !value.systemPrompt.trim()
    || value.systemPrompt.length > 100000 || !Array.isArray(value.messages)
    || !value.messages.length || value.messages.length > 24
    || value.messages.some(message => !['user', 'assistant'].includes(message?.role)
      || typeof message.content !== 'string' || !message.content.trim())) {
    throw new Error('Invalid Claude inference request.');
  }
  if (value.responseSchema !== undefined && (!value.responseSchema || typeof value.responseSchema !== 'object' || Array.isArray(value.responseSchema))) {
    throw new Error('Invalid Claude response schema.');
  }
  return value;
}

export function validateClaudeResult(value, responseSchema) {
  if (!value || value.provider !== 'claude-code' || typeof value.model !== 'string' || !value.model
    || typeof value.text !== 'string' || (!value.text.trim() && !value.structured)
    || !value.usage || typeof value.usage !== 'object') {
    throw new Error('Claude returned an incomplete response.');
  }
  if (responseSchema && !new Validator(responseSchema).validate(value.structured).valid) {
    throw new Error('Claude returned invalid structured output.');
  }
  return value;
}
