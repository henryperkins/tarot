/**
 * Configuration for the ChatGPT MCP endpoint (spec §5).
 */

export const MCP_SCOPE = 'tableu';
export const DEFAULT_MCP_RESOURCE_URL = 'https://tarot.lakefrontdev.com/mcp';

/** Canonical RFC 8707 resource for /mcp (var MCP_RESOURCE_URL). */
export function getMcpResourceUrl(env) {
  const configured = typeof env?.MCP_RESOURCE_URL === 'string' ? env.MCP_RESOURCE_URL.trim() : '';
  return configured || DEFAULT_MCP_RESOURCE_URL;
}

/** RFC 9728 metadata URL in the path-suffixed form MCP clients request. */
export function protectedResourceMetadataUrl(env) {
  const resource = new URL(getMcpResourceUrl(env));
  return new URL(`/.well-known/oauth-protected-resource${resource.pathname}`, resource.origin).href;
}

export const MCP_ACCESS_MODES = Object.freeze(['public', 'allowlist', 'off']);

/**
 * Who can link ChatGPT and use existing tokens (var MCP_ACCESS_MODE):
 * - `public`: any active personal Tableu account;
 * - `allowlist` (default): only ids in the MCP_ALLOWED_USER_IDS secret;
 * - `off`: nobody. This is the kill switch, and every token stops working.
 * An unrecognized value counts as `off`, so a typo can't open access.
 */
export function getMcpAccessMode(env) {
  const raw = typeof env?.MCP_ACCESS_MODE === 'string' ? env.MCP_ACCESS_MODE.trim().toLowerCase() : '';
  if (!raw) return 'allowlist';
  return MCP_ACCESS_MODES.includes(raw) ? raw : 'off';
}

/**
 * Allowlist from the MCP_ALLOWED_USER_IDS secret. Ids can be separated by
 * commas, spaces or newlines. In allowlist mode, an unset or blank secret
 * allows nobody.
 */
export function parseAllowedUserIds(env) {
  const raw = typeof env?.MCP_ALLOWED_USER_IDS === 'string' ? env.MCP_ALLOWED_USER_IDS : '';
  return new Set(raw.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean));
}

export function isAllowedMcpUser(env, userId) {
  if (typeof userId !== 'string' || userId.length === 0) return false;
  const mode = getMcpAccessMode(env);
  if (mode === 'public') return true;
  if (mode === 'allowlist') return parseAllowedUserIds(env).has(userId);
  return false;
}
