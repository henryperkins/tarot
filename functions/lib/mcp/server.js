/**
 * The Tableu MCP server (spec §6). One server per /mcp request, since the
 * transport is stateless. Every tool is bound to the user the OAuth grant
 * resolved to.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// Ajv (the SDK default) generates code at runtime, which Workers forbid.
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker-provider.js';

import { registerProfileTool } from './tools/profile.js';
import { registerReadingTools } from './tools/readings.js';
import { registerJournalTools } from './tools/journal.js';

export const MCP_SERVER_INFO = Object.freeze({ name: 'tableu', version: '1.0.0' });

export const MCP_INSTRUCTIONS = [
  "Tableu draws and interprets tarot readings and keeps them in the user's Tableu journal.",
  '1. Start a reading with draw_tarot_reading when Tableu should draw the cards, or with start_tarot_reading when the user supplies cards (keep their cards, positions and orientations exactly).',
  '2. Call wait_for_tarot_reading with the returned jobId and jobToken until the status is complete or error. If it is still running, call it again; never start a second job for the same request.',
  '3. Present each card as "Position — Card (orientation)" and make the returned narrative the centerpiece.',
  '4. Call save_reading_to_journal only when the user explicitly asks to save, journal, keep or remember the reading, or says yes right after you offer. Keep the returned entry id.',
  '5. Call add_reflection_to_journal_entry only when the user explicitly asks to save or attach something they said, or says yes right after you offer. Send their exact words.',
  'Never say something was saved unless the tool returned success. get_profile shows which Tableu account these tools act as.'
].join('\n');

/**
 * @param {object} options
 * @param {object} options.env - Worker bindings
 * @param {object} options.user - Resolved Tableu user (loadActiveUserById)
 * @param {Function} [options.waitUntil]
 * @param {(ms: number) => Promise<void>} [options.sleep] - Injected in tests
 * @param {() => number} [options.now] - Injected in tests
 */
export function createTableuMcpServer({ env, user, waitUntil, sleep, now } = {}) {
  const server = new McpServer(MCP_SERVER_INFO, {
    instructions: MCP_INSTRUCTIONS,
    jsonSchemaValidator: new CfWorkerJsonSchemaValidator()
  });
  registerProfileTool(server, { user });
  registerReadingTools(server, { env, user, sleep, now });
  registerJournalTools(server, { env, user, waitUntil });
  return server;
}
