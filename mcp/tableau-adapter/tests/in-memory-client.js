import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerJournalTools } from '../journal-tools.js';
import { createBackendClient } from '../backend.js';

export async function journalClient(fetchImpl, apiKey) {
  const server = new McpServer({ name: 'journal-render-test', version: '1.0.0' });
  registerJournalTools(server, createBackendClient({ baseUrl: 'https://example.test', apiKey, ownerUserId: 'owner', fetchImpl }));
  const client = new Client({ name: 'journal-render-client', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}
