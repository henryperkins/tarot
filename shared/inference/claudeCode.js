import { Validator } from '@cfworker/json-schema';

export const CLAUDE_CODE_TASKS = Object.freeze(['reading', 'followup', 'followup-repair', 'question', 'journal-summary']);
export const CLAUDE_CODE_MAX_BODY_BYTES = 262144;
export const CLAUDE_CODE_MAX_OUTPUT_BYTES = 2097152;
export const CLAUDE_CODE_EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);
// Model ids become CLI arguments, so they may not start with a dash.
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,99}$/i;

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
  // Optional per-request pins; release QA uses them to match the API request.
  if ((value.model !== undefined && (typeof value.model !== 'string' || !MODEL_ID.test(value.model)))
    || (value.effort !== undefined && !CLAUDE_CODE_EFFORTS.includes(value.effort))
    || (value.maxOutputTokens !== undefined && (!Number.isSafeInteger(value.maxOutputTokens)
      || value.maxOutputTokens < 1 || value.maxOutputTokens > 128000))) {
    throw new Error('Invalid Claude request settings.');
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
