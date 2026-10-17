/** get_profile: which Tableu account this connection acts as (spec §5.4). */
import * as z from 'zod';

import { READ_ONLY, ok, toolMeta } from './common.js';

export const profileOutputSchema = z.object({
  id: z.string().min(1).regex(/\S/),
  name: z.string().optional(),
  email: z.string().optional(),
  nickname: z.string().optional()
}).strict();

function cleanText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

// Versioned domain separation for the profile id. Changing it gives every
// connected account a new id, which ChatGPT treats as a different account.
const PROFILE_ID_NAMESPACE = 'tableu:chatgpt-profile:v1:';

function base64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Stable, opaque profile id for ChatGPT: derived from the account id, so it
 * never changes for an account, but it doesn't reveal the internal id.
 */
export async function profileIdFor(userId) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${PROFILE_ID_NAMESPACE}${userId}`));
  return `acct_${base64Url(new Uint8Array(digest)).slice(0, 32)}`;
}

/** The resolved user as a profile. Unavailable fields are omitted, never invented. */
export async function buildProfile(user) {
  const username = cleanText(user?.username);
  const fullName = cleanText(user?.full_name);
  const profile = { id: await profileIdFor(String(user.id)) };
  const name = fullName || username;
  if (name) profile.name = name;
  if (username) profile.nickname = `Tableu · @${username}`;
  return profile;
}

export function registerProfileTool(server, { user }) {
  server.registerTool(
    'get_profile',
    {
      title: 'Get Tableu profile',
      description:
        'Returns the Tableu account this connection acts as: its display name and nickname when available, and `id`, an opaque identifier for this account that stays the same across token refresh, reconnection and display-name changes. Read-only.',
      inputSchema: z.object({}).strict(),
      outputSchema: profileOutputSchema,
      annotations: READ_ONLY,
      _meta: toolMeta({
        invoking: 'Checking your Tableu account…',
        invoked: 'Tableu account checked',
        'openai/profile': true
      })
    },
    async () => {
      const profile = await buildProfile(user);
      return ok(profile, JSON.stringify(profile));
    }
  );
}
