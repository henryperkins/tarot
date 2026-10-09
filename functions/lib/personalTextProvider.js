import { callClaudeCode, getClaudeCodeAccessError } from './claudeCode.js';
import { callCodexSubscription, getCodexSubscriptionAccessError } from './codexSubscription.js';

/** Subscription selection is explicit and never depends on gateway availability. */
export function getPersonalTextProvider(env) {
  const provider = String(env?.TEXT_PROVIDER || '').trim().toLowerCase();
  if (!provider || provider === 'legacy') return null;
  if (provider === 'claude-code' || provider === 'codex-subscription') return provider;
  throw new Error('Invalid TEXT_PROVIDER configuration.');
}

export function isPersonalTextProviderEnabled(env) {
  return getPersonalTextProvider(env) !== null;
}

export function getPersonalTextAccessError(env, user) {
  const provider = getPersonalTextProvider(env);
  if (provider === 'claude-code') return getClaudeCodeAccessError(env, user);
  if (provider === 'codex-subscription') return getCodexSubscriptionAccessError(env, user);
  return null;
}

export function callPersonalTextProvider(env, input) {
  const provider = getPersonalTextProvider(env);
  if (provider === 'claude-code') return callClaudeCode(env, input);
  if (provider === 'codex-subscription') return callCodexSubscription(env, input);
  throw new Error('Personal text inference is not selected.');
}
