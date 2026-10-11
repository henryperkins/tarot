import { getSubscriptionContext, isMachineCredential } from './entitlements.js';

const capabilities = new WeakMap();
const WEB_PATHS = [/^\/api\/tarot-reading\/jobs$/, /^\/api\/tarot-reading\/visual-retry$/, /^\/api\/journal\/[^/]+\/visual-retry$/];

/** Explicit opt-in only. Invalid entries invalidate the whole allowlist. */
function allowedTiers(env) {
  let tiers;
  try { tiers = JSON.parse(env?.VISUAL_CUE_ALLOWED_TIERS); } catch { return []; }
  return Array.isArray(tiers) && tiers.every(tier => tier === 'plus' || tier === 'pro') ? tiers : [];
}

/** Mint only after web-route authentication; JSON fields never confer authority. */
export function createWebVisualCapability({ env, request, user }) {
  if (!user?.id || isMachineCredential(user) || request?.headers.get('X-Reading-Cue-Display') !== '1') return null;
  // Cue-displaying web clients use cookie sessions. Any presented Authorization
  // (including empty, ambiguous or machine-token variants) denies visuals; prose
  // keeps the existing credential resolution and forwarding behavior.
  if (request.headers.has('Authorization')) return null;
  let pathname;
  try { pathname = new URL(request.url).pathname; } catch { return null; }
  if (request.method !== 'POST' || !WEB_PATHS.some(pattern => pattern.test(pathname))) return null;
  const effectiveTier = getSubscriptionContext(user).effectiveTier;
  if (!allowedTiers(env).includes(effectiveTier)) return null;
  const capability = Object.freeze({});
  capabilities.set(capability, { env, userId: user.id, effectiveTier });
  return capability;
}

/** Exact environment/owner binding also rejects forged and copied objects. */
export function hasWebVisualCapability({ env, capability, userId, principal = null }) {
  const trusted = capabilities.get(capability);
  return !principal && !!trusted && trusted.env === env && trusted.userId === userId
    && allowedTiers(env).includes(trusted.effectiveTier);
}
