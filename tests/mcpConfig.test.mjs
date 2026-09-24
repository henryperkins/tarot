import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_MCP_RESOURCE_URL,
  getMcpResourceUrl,
  isAllowedMcpUser,
  MCP_SCOPE,
  parseAllowedUserIds,
  protectedResourceMetadataUrl
} from '../functions/lib/mcp/config.js';

describe('MCP config', () => {
  it('uses the tableu scope and the production resource by default', () => {
    assert.equal(MCP_SCOPE, 'tableu');
    assert.equal(getMcpResourceUrl({}), DEFAULT_MCP_RESOURCE_URL);
    assert.equal(DEFAULT_MCP_RESOURCE_URL, 'https://tarot.lakefrontdev.com/mcp');
    assert.equal(getMcpResourceUrl({ MCP_RESOURCE_URL: ' https://tarot.example/mcp ' }), 'https://tarot.example/mcp');
  });

  it('builds the path-suffixed protected-resource metadata URL', () => {
    assert.equal(
      protectedResourceMetadataUrl({ MCP_RESOURCE_URL: 'https://tarot.example/mcp' }),
      'https://tarot.example/.well-known/oauth-protected-resource/mcp'
    );
  });

  it('matches allowlisted ids pasted with spaces, commas and newlines', () => {
    const env = { MCP_ALLOWED_USER_IDS: ' user-1 ,user-2\n' };
    assert.deepEqual([...parseAllowedUserIds(env)], ['user-1', 'user-2']);
    assert.equal(isAllowedMcpUser(env, 'user-1'), true);
    assert.equal(isAllowedMcpUser(env, 'user-2'), true);
    assert.equal(isAllowedMcpUser(env, 'user-3'), false);
  });

  it('allows nobody when the allowlist is unset or blank', () => {
    for (const env of [{}, { MCP_ALLOWED_USER_IDS: '' }, { MCP_ALLOWED_USER_IDS: ' , ' }]) {
      assert.equal(isAllowedMcpUser(env, 'user-1'), false);
    }
    assert.equal(isAllowedMcpUser({ MCP_ALLOWED_USER_IDS: 'user-1' }, ''), false);
    assert.equal(isAllowedMcpUser({ MCP_ALLOWED_USER_IDS: 'user-1' }, undefined), false);
  });
});
