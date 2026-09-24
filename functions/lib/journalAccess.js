/**
 * Journal access checks shared by the journal HTTP routes and the MCP tools.
 *
 * The synthetic GPT service account (GPT_SERVICE_TOKEN / GPT_OWNER_TOKEN)
 * is refused. Its users row can never sign in, so anything it saved would
 * sit in a journal no person can open. Personal credentials (session
 * cookie, bearer session token, `sk_` API key) are unaffected.
 */

import { buildTierLimitedPayload, isEntitled } from './entitlements.js';

export const SERVICE_ACCOUNT_JOURNAL_ERROR = Object.freeze({
  error: 'Journal requires a personal account',
  code: 'service_account_journal_forbidden'
});

export function isServiceAccount(user) {
  return user?.auth_provider === 'service' || user?.is_service_account === true;
}

/**
 * @param {object|null} user - Result of getUserFromRequest / loadActiveUserById
 * @returns {null | { status: 401|403, body: object }}
 */
export function checkJournalAccess(user) {
  if (!user) {
    return { status: 401, body: { error: 'Not authenticated' } };
  }
  if (isServiceAccount(user)) {
    return { status: 403, body: { ...SERVICE_ACCOUNT_JOURNAL_ERROR } };
  }
  if (!isEntitled(user, 'plus')) {
    return {
      status: 403,
      body: buildTierLimitedPayload({
        message: 'Cloud journal sync requires an active Plus or Pro subscription',
        user,
        requiredTier: 'plus'
      })
    };
  }
  return null;
}

/**
 * HTTP form of checkJournalAccess.
 * @returns {Response|null} A JSON error response, or null when access is allowed
 */
export function journalAccessDenied(user) {
  const denied = checkJournalAccess(user);
  if (!denied) return null;
  return new Response(JSON.stringify(denied.body), {
    status: denied.status,
    headers: { 'Content-Type': 'application/json' }
  });
}
