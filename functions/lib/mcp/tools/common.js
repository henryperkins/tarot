/** Shared descriptors and result helpers for the Tableu MCP tools. */
import { MCP_SCOPE } from '../config.js';

export const READ_ONLY = Object.freeze({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
export const WRITE = Object.freeze({ readOnlyHint: false, destructiveHint: false, openWorldHint: false });
export const DESTRUCTIVE = Object.freeze({ readOnlyHint: false, destructiveHint: true, openWorldHint: false });

/**
 * Tool descriptor `_meta`. ChatGPT reads each tool's OAuth requirement from
 * `securitySchemes`. The SDK passes custom descriptor fields only through
 * `_meta`, which OpenAI documents as the back-compatible mirror. Status
 * strings are at most 64 characters.
 */
export function toolMeta({ invoking, invoked, ...extra }) {
  return {
    securitySchemes: [{ type: 'oauth2', scopes: [MCP_SCOPE] }],
    'openai/toolInvocation/invoking': invoking,
    'openai/toolInvocation/invoked': invoked,
    ...extra
  };
}

/** Successful result: structured content plus a plain-language summary. */
export function ok(structuredContent, text) {
  return { structuredContent, content: [{ type: 'text', text }] };
}

/** Failed result. `text` states the outcome ("Not saved: …", "Could not confirm: …"). */
export function fail(text) {
  return { isError: true, content: [{ type: 'text', text }] };
}
