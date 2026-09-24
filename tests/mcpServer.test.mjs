import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';

import { connectMcpClient } from './helpers/mcpClient.mjs';

const OWNER = Object.freeze({
  id: 'user-1',
  username: 'henry',
  full_name: null,
  subscription_tier: 'plus',
  subscription_status: 'active',
  auth_provider: 'session'
});

const open = [];
async function connect(user = OWNER) {
  const connection = await connectMcpClient({ env: {}, user });
  open.push(connection);
  return connection.client;
}
after(async () => {
  await Promise.all(open.map((connection) => connection.close()));
});

describe('get_profile', () => {
  it('is advertised as the read-only OAuth profile tool', async () => {
    const client = await connect();
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === 'get_profile');

    assert.ok(tool, 'get_profile is listed');
    assert.deepEqual(tool.annotations, { readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    assert.equal(tool._meta['openai/profile'], true);
    assert.deepEqual(tool._meta.securitySchemes, [{ type: 'oauth2', scopes: ['tableu'] }]);
    assert.deepEqual(tool.outputSchema.required, ['id']);
    for (const key of ['openai/toolInvocation/invoking', 'openai/toolInvocation/invoked']) {
      assert.ok(tool._meta[key].length <= 64, `${key} is at most 64 characters`);
    }
  });

  it('returns the account the connection acts as', async () => {
    const client = await connect();
    const result = await client.callTool({ name: 'get_profile', arguments: {} });

    assert.deepEqual(result.structuredContent, { id: 'user-1', name: 'henry', nickname: 'Tableu · @henry' });
    assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
  });

  it('prefers the full name for display', async () => {
    const client = await connect({ ...OWNER, full_name: 'Henry Perkins' });
    const { structuredContent } = await client.callTool({ name: 'get_profile', arguments: {} });
    assert.equal(structuredContent.name, 'Henry Perkins');
  });

  it('returns only the id for an account with no username or name', async () => {
    const client = await connect({ ...OWNER, id: 'user-9', username: null, full_name: null });
    const { structuredContent, isError } = await client.callTool({ name: 'get_profile', arguments: {} });
    assert.equal(isError, undefined);
    assert.deepEqual(structuredContent, { id: 'user-9' });
  });
});

describe('server instructions', () => {
  it('tell the model the order of use and when saving is allowed', async () => {
    const client = await connect();
    const instructions = client.getInstructions();
    assert.match(instructions, /wait_for_tarot_reading/);
    assert.match(instructions, /explicitly asks to save/);
    assert.match(instructions, /never start a second job/i);
  });
});
