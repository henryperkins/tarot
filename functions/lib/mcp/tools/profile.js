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

/** The resolved user as a profile. Unavailable fields are omitted, never invented. */
export function buildProfile(user) {
  const username = cleanText(user?.username);
  const fullName = cleanText(user?.full_name);
  const profile = { id: String(user.id) };
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
        'Returns the Tableu account this connection acts as. `id` is the Tableu user id: opaque, unique, and unchanged across token refresh, reconnection, and display-name changes. Read-only.',
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
      const profile = buildProfile(user);
      return ok(profile, JSON.stringify(profile));
    }
  );
}
