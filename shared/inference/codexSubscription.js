import { Validator } from '@cfworker/json-schema';

export const CODEX_SUBSCRIPTION_DEFAULT_MODEL = 'gpt-6.1-sol';
export const CODEX_SUBSCRIPTION_DEFAULT_EFFORT = 'xhigh';
export const CODEX_SUBSCRIPTION_TASKS = Object.freeze(['reading', 'followup', 'followup-repair', 'question', 'journal-summary']);
export const CODEX_SUBSCRIPTION_MAX_BODY_BYTES = 262144;
export const CODEX_SUBSCRIPTION_MAX_OUTPUT_BYTES = 2097152;
export const CODEX_SUBSCRIPTION_EFFORTS = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);
// Model ids become CLI arguments, so they may not start with a dash.
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,99}$/i;

export const CODEX_SUBSCRIPTION_MAX_MODELS = 256;

export function validateCodexModelList(value) {
  const invalid = () => new Error('Invalid ChatGPT subscription model catalog.');
  if (value?.provider !== 'codex-subscription' || !Array.isArray(value.models)
    || value.models.length > CODEX_SUBSCRIPTION_MAX_MODELS) throw invalid();
  const ids = new Set();
  const models = value.models.map(entry => {
    const { id, label } = entry || {};
    if (typeof id !== 'string' || !MODEL_ID.test(id) || ids.has(id)
      || typeof label !== 'string' || !label.trim() || label.length > 160
      || /\p{Cc}|\p{Cf}/u.test(label)) throw invalid();
    ids.add(id);
    return { id, label: label.trim() };
  });
  return { provider: 'codex-subscription', models };
}

export function validateCodexRequest(value) {
  if (!value || !CODEX_SUBSCRIPTION_TASKS.includes(value.task)
    || typeof value.systemPrompt !== 'string' || !value.systemPrompt.trim()
    || value.systemPrompt.length > 100000 || !Array.isArray(value.messages)
    || !value.messages.length || value.messages.length > 24
    || value.messages.some(message => !['user', 'assistant'].includes(message?.role)
      || typeof message.content !== 'string' || !message.content.trim())) {
    throw new Error('Invalid Codex inference request.');
  }
  if (value.responseSchema !== undefined && (!value.responseSchema || typeof value.responseSchema !== 'object' || Array.isArray(value.responseSchema))) {
    throw new Error('Invalid Codex response schema.');
  }
  // exec has no documented hard token cap; do not silently accept one.
  if ((value.model !== undefined && (typeof value.model !== 'string' || !MODEL_ID.test(value.model)))
    || (value.effort !== undefined && !CODEX_SUBSCRIPTION_EFFORTS.includes(value.effort))
    || value.maxOutputTokens !== undefined) {
    throw new Error('Invalid Codex request settings.');
  }
  return value;
}

export function validateCodexResult(value, responseSchema) {
  if (!value || value.provider !== 'codex-subscription' || typeof value.model !== 'string' || !value.model
    || !['configured', 'reported'].includes(value.modelSource)
    || typeof value.text !== 'string' || (!value.text.trim() && !value.structured)
    || !value.usage || typeof value.usage !== 'object') {
    throw new Error('Codex returned an incomplete response.');
  }
  if (responseSchema && !new Validator(responseSchema).validate(value.structured).valid) {
    throw new Error('Codex returned invalid structured output.');
  }
  return value;
}
