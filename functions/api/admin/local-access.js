import { hashPassword, verifyPassword } from '../../lib/auth.js';
import { sha256Hex, timingSafeEqual } from '../../lib/crypto.js';
import { isLocalLaunchChallenge, localLaunchProof } from '../../../shared/contracts/localAdminLaunch.js';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const localAddresses = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const sessionPattern = /^Bearer (local_admin_[a-f0-9]{64})$/;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const denied = () => json({ error: 'Admin authentication required.' }, 401);
const unavailable = () => json({ error: 'Local sign-in storage is unavailable.' }, 503);

export function isLocalAdminOrigin(request, env) {
  const peer = request.headers.get('CF-Connecting-IP');
  return env.AI_CONFIG_ENVIRONMENT === 'local' && localHosts.has(new URL(request.url).hostname)
    && (!peer || localAddresses.has(peer));
}

function hasAdminKey(request, env) {
  return Boolean(env.ADMIN_API_KEY) && timingSafeEqual(request.headers.get('Authorization'), 'Bearer ' + env.ADMIN_API_KEY);
}

export async function isLocalAdminSession(request, env) {
  const token = request.headers.get('Authorization')?.match(sessionPattern)?.[1];
  if (!token || !isLocalAdminOrigin(request, env)) return false;
  const pathname = new URL(request.url).pathname;
  if (!/^\/api\/admin\/(?:ai-configuration(?:\/|$)|quality-stats\/?$|local-access\/?$)/.test(pathname)) return false;
  return Boolean(await env.DB.prepare(
    'SELECT 1 FROM local_admin_sessions s JOIN local_admin_access a ON s.version = a.version WHERE s.digest = ? AND s.expires_at > ?'
  ).bind(await sha256Hex(token), Date.now()).first());
}

async function issueSession(db, version, passwordHash, accountChange) {
  const token = 'local_admin_' + [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const now = Date.now();
  const expiresAt = now + 8 * 60 * 60 * 1000;
  const receipts = await db.batch([
    ...(accountChange ? [accountChange] : []),
    db.prepare('DELETE FROM local_admin_sessions WHERE expires_at <= ? OR version < (SELECT version FROM local_admin_access WHERE id = 1)').bind(now),
    db.prepare('INSERT INTO local_admin_sessions (digest, version, expires_at) SELECT ?, version, ? FROM local_admin_access WHERE version = ? AND password_hash = ?')
      .bind(await sha256Hex(token), expiresAt, version, passwordHash)
  ]);
  return receipts.at(-1).meta.changes ? json({ token, expiresAt }) : json({ error: 'Password changed. Sign in again.' }, 409);
}

async function checkPassword(db, account, password) {
  if (typeof password !== 'string' || !password || password.length > 256) return denied();
  const now = Date.now();
  const receipt = await db.prepare(`UPDATE local_admin_access
    SET attempts = CASE WHEN window_ends <= ? THEN 1 ELSE attempts + 1 END,
        window_ends = CASE WHEN window_ends <= ? THEN ? ELSE window_ends END
    WHERE version = ? AND (attempts < 10 OR window_ends <= ?)`)
    .bind(now, now, now + 5 * 60 * 1000, account.version, now).run();
  if (!receipt.meta.changes) return json({ error: 'Too many attempts or password changed. Try again in five minutes.' }, 429);
  if (!await verifyPassword(password, account.password_hash, account.salt)) return json({ error: 'Incorrect local admin password.' }, 401);
  await db.prepare('UPDATE local_admin_access SET attempts = 0, window_ends = 0 WHERE version = ?').bind(account.version).run();
  return null;
}

export async function onRequestGet({ request, env }) {
  if (!isLocalAdminOrigin(request, env)) return json({ available: false });
  const url = new URL(request.url);
  const challenge = url.searchParams.get('challenge');
  if (challenge !== null) {
    if (!isLocalLaunchChallenge(challenge)) return json({ error: 'Invalid launch challenge.' }, 400);
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return json({ error: 'Use the local Worker dashboard for sign-in.' }, 403);
  }
  try {
    const account = await env.DB.prepare('SELECT 1 FROM local_admin_access WHERE id = 1').first();
    const state = { available: true, passwordConfigured: Boolean(account) };
    if (!account && challenge && env.LOCAL_ADMIN_SETUP_TOKEN) state.launchProof = await localLaunchProof(env.LOCAL_ADMIN_SETUP_TOKEN, challenge);
    return json(state);
  } catch { return unavailable(); }
}

export async function onRequestPost({ request, env }) {
  if (!isLocalAdminOrigin(request, env)) return json({ error: 'Local sign-in is unavailable here.' }, 403);
  if (request.headers.get('Origin') !== new URL(request.url).origin) return json({ error: 'Use the local Worker dashboard for sign-in.' }, 403);
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json') return json({ error: 'Expected JSON.' }, 415);
  if (Number(request.headers.get('Content-Length')) > 4096) return json({ error: 'Request too large.' }, 413);
  let body;
  try {
    const text = await request.text();
    if (text.length > 4096) return json({ error: 'Request too large.' }, 413);
    body = JSON.parse(text);
  } catch { return json({ error: 'Expected JSON.' }, 400); }
  if (!['setup', 'change', 'login', 'logout'].includes(body?.action)) return json({ error: 'Unknown sign-in action.' }, 400);
  const { action, password } = body;
  const db = env.DB;
  try {
    if (action === 'logout') {
      const token = request.headers.get('Authorization')?.match(sessionPattern)?.[1];
      if (token) await db.prepare('DELETE FROM local_admin_sessions WHERE digest = ?').bind(await sha256Hex(token)).run();
      return json({ signedOut: true });
    }
    const account = await db.prepare('SELECT password_hash, salt, version FROM local_admin_access WHERE id = 1').first();
    if (action === 'login') {
      if (!account) return denied();
      return await checkPassword(db, account, password) || await issueSession(db, account.version, account.password_hash);
    }
    if (action === 'setup') {
      if (account) return json({ error: 'A password is already configured. Sign in to change it.' }, 409);
      if (!hasAdminKey(request, env) && !(env.LOCAL_ADMIN_SETUP_TOKEN && timingSafeEqual(body.setupToken, env.LOCAL_ADMIN_SETUP_TOKEN))) {
        return json({ error: 'Reopen setup with npm run admin:open on this computer, or sign in with the admin API key.' }, 401);
      }
    } else {
      if (!account) return json({ error: 'Set up a local password first.' }, 409);
      if (!hasAdminKey(request, env)) {
        if (!await isLocalAdminSession(request, env)) return denied();
        const failure = await checkPassword(db, account, body.currentPassword);
        if (failure) return failure;
      }
    }
    if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
      return json({ error: 'Use a password between 12 and 256 characters.' }, 422);
    }
    const { hash, salt } = await hashPassword(password);
    const change = action === 'setup'
      ? db.prepare('INSERT INTO local_admin_access (id, password_hash, salt) VALUES (1, ?, ?) ON CONFLICT(id) DO NOTHING').bind(hash, salt)
      : db.prepare('UPDATE local_admin_access SET password_hash = ?, salt = ?, version = version + 1, attempts = 0, window_ends = 0 WHERE version = ?')
        .bind(hash, salt, account.version);
    return await issueSession(db, action === 'setup' ? 1 : account.version + 1, hash, change);
  } catch { return unavailable(); }
}

export const localAccess = { onRequestGet, onRequestPost };
