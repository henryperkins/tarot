import dotenv from 'dotenv';
import { createBackendClient } from '../backend.js';

dotenv.config({ quiet: true });

// Read-only verification. Supply the app session locally through the process
// environment, never in a prompt, source file, command argument, or PR artifact.
try {
  const backend = createBackendClient({
    baseUrl: process.env.TABLEAU_BASE_URL,
    apiKey: process.env.TABLEAU_API_KEY,
    ownerUserId: process.env.TABLEAU_OWNER_USER_ID
  });
  const session = process.env.TABLEAU_APP_SESSION_TOKEN;
  if (!session) throw new Error('Set TABLEAU_APP_SESSION_TOKEN locally from your signed-in app session.');
  const bearerUser = await backend.verifyOwner();
  const response = await fetch(new URL('/api/auth/me', process.env.TABLEAU_BASE_URL), {
    headers: { Cookie: `session=${session}` }, redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error('App session identity could not be verified.');
  const { user } = await response.json();
  if (!user?.id || user.id !== bearerUser.id || user.auth_provider === 'service') {
    throw new Error('App session and backend credential do not resolve to the same account.');
  }
  console.log(JSON.stringify({ verified: true, sameUserId: true, userId: user.id, backendAuthProvider: bearerUser.auth_provider }));
} catch {
  console.error('Identity verification failed. Check local owner id, personal backend credential and app session. No journal write was attempted.');
  process.exitCode = 1;
}
