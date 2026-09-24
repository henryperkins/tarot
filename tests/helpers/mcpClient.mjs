/** Connect an MCP client to createTableuMcpServer over an in-memory transport. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

import { createTableuMcpServer } from '../../functions/lib/mcp/server.js';

export async function connectMcpClient(options) {
  const server = createTableuMcpServer(options);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'tableu-test-client', version: '1.0.0' });
  await client.connect(clientTransport);
  return {
    client,
    async close() {
      await client.close();
      await server.close();
    }
  };
}
