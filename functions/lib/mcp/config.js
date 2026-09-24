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

/**
 * Owner allowlist from the MCP_ALLOWED_USER_IDS secret. Ids can be separated
 * by commas, spaces or newlines. An unset or blank secret allows nobody.
 */
export function parseAllowedUserIds(env) {
  const raw = typeof env?.MCP_ALLOWED_USER_IDS === 'string' ? env.MCP_ALLOWED_USER_IDS : '';
  return new Set(raw.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean));
}

export function isAllowedMcpUser(env, userId) {
  return typeof userId === 'string' && userId.length > 0 && parseAllowedUserIds(env).has(userId);
}
