import { configEnabled, ConfigError } from './aiConfigCatalog.js';
import { getPersonalTextProvider, resolvePersonalTextProviderEnv } from './personalTextProvider.js';
import { getOwnerHostStatus, withOwnerHostGateway } from './ownerSubscriptionHost.js';

const providers = [
  { id: 'codex-subscription', label: 'Codex / ChatGPT' },
  { id: 'claude-code', label: 'Claude Code' }
];

export function ownerLinkDatabase(env) {
  if (!env.DB?.prepare) throw new ConfigError(503, 'owner_storage_unavailable', 'Owner subscription storage is unavailable.');
  return env.DB.withSession?.('first-primary') || env.DB;
}

export async function readOwnerLink(db) {
  const row = await db.prepare('SELECT revision, owner_id, provider_id FROM owner_subscription WHERE id = 1').first();
  if (!row) throw new ConfigError(503, 'owner_storage_unavailable', 'Owner subscription settings are unavailable.');
  return row;
}

export function ownerRestriction(env) {
  if (env.AI_CONFIG_ENVIRONMENT !== 'local' || !configEnabled(env)) return 'Owner subscriptions require the enabled local dashboard.';
  if (getPersonalTextProvider(env) || [true, 'true'].includes(env.CODEX_SUBSCRIPTION_OWNER_ROUTING_ENABLED)) {
    return 'This Worker already has a deployment-managed subscription selection.';
  }
  return null;
}

export async function linkedGatewayEnv(env, row) {
  const gateway = await withOwnerHostGateway(env, row.provider_id);
  const ownerField = row.provider_id === 'claude-code' ? 'CLAUDE_CODE_OWNER_USER_ID' : 'CODEX_SUBSCRIPTION_OWNER_USER_ID';
  return { ...gateway, TEXT_PROVIDER: row.provider_id, [ownerField]: row.owner_id };
}

/** Preserve legacy deployments and leave unlinked readers on their usual route. */
export async function resolveOwnerSubscriptionEnv(env, user) {
  const existing = resolvePersonalTextProviderEnv(env, user);
  if (!user?.id || !user.sessionId || ['service', 'api_key'].includes(user.auth_provider) || ownerRestriction(env)) return existing;
  let row;
  try {
    row = await readOwnerLink(ownerLinkDatabase(env));
  } catch (error) {
    if (!env.OWNER_HOST_INSTANCE && /no such table: (?:main\.)?owner_subscription\b/i.test(error.message)) return existing;
    throw new ConfigError(503, 'owner_storage_unavailable', 'Owner subscription settings are unavailable.');
  }
  if (row.owner_id !== user.id) return existing;
  try { return await linkedGatewayEnv(env, row); } catch {
    throw new ConfigError(503, 'owner_gateway_unavailable', 'The local owner subscription host is unavailable.');
  }
}

export function assertOwner(row, userId) {
  if (!row.owner_id || row.owner_id !== userId) throw new ConfigError(403, 'owner_required', 'Sign in as the linked reader to use this owner subscription.');
}

export function assertRevision(row, revision) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw new ConfigError(422, 'invalid_revision', 'Expected a valid link revision.');
  if (row.revision !== revision) throw new ConfigError(409, 'owner_link_changed', 'The owner link changed. Refresh it and try again.');
}

export async function changeOwnerLink(db, reader, { baseRevision, providerId }) {
  if (providerId !== null && !providers.some(({ id }) => id === providerId)) {
    throw new ConfigError(422, 'invalid_provider', 'Choose a supported owner subscription.');
  }
  const row = await readOwnerLink(db);
  if (row.owner_id) assertOwner(row, reader.id);
  assertRevision(row, baseRevision);
  if (row.provider_id === providerId) return row;
  const saved = await db.prepare(`UPDATE owner_subscription
    SET owner_id = ?, provider_id = ?, revision = revision + 1
    WHERE id = 1 AND revision = ? AND (owner_id IS NULL OR owner_id = ?)
    AND EXISTS (SELECT 1 FROM users WHERE id = ? AND is_active = 1)`)
    .bind(providerId ? reader.id : null, providerId, baseRevision, reader.id, reader.id).run();
  if (!saved.meta.changes) throw new ConfigError(409, 'owner_link_changed', 'The owner link changed. Refresh it and try again.');
  return { revision: baseRevision + 1, owner_id: providerId ? reader.id : null, provider_id: providerId };
}

export async function describeOwnerLink(env, reader, row) {
  const ownedByReader = Boolean(row.owner_id && row.owner_id === reader.id);
  const foreignLink = row.owner_id && !ownedByReader;
  const readOnlyReason = ownerRestriction(env) || (foreignLink && 'A different reader is linked. Sign in as that reader to make changes.');
  const availability = foreignLink ? [] : await Promise.all(providers.map(async provider => {
    const { ready, reason } = await getOwnerHostStatus(env, provider.id);
    return { ...provider, configured: ready, ...(reason && { reason }) };
  }));
  return { reader: { id: reader.id, label: reader.email || reader.username },
    link: { revision: row.revision, providerId: ownedByReader ? row.provider_id : null, ownedByReader },
    providers: availability, editable: !readOnlyReason, ...(readOnlyReason && { readOnlyReason }) };
}
