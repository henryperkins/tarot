import { randomUUID } from 'node:crypto';
import { createClaudeCodeServer } from '../../services/claude-code/server.mjs';
import { createCodexSubscriptionServer } from '../../services/codex-subscription/server.mjs';
import { ownerGatewayToken, ownerHostUrlBinding } from '../../shared/contracts/ownerSubscriptionHost.js';

export async function startOwnerSubscriptionHosts({ secret, codex = {}, claude = {} }) {
  const instance = randomUUID();
  const bindings = { OWNER_HOST_INSTANCE: instance };
  const servers = [];
  const close = () => Promise.all(servers.map(server => server.shutdown()));
  try {
    const providers = [
      ['codex-subscription', createCodexSubscriptionServer, codex],
      ['claude-code', createClaudeCodeServer, claude]
    ];
    for (const [provider, create, options] of providers) {
      const token = await ownerGatewayToken(secret, instance, provider);
      const server = create({ ...options, token });
      servers.push(server);
      await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
          server.removeListener('error', reject);
          resolve();
        });
      });
      bindings[ownerHostUrlBinding(provider)] = 'http://127.0.0.1:' + server.address().port;
    }
    return { bindings, close };
  } catch (error) {
    await close();
    throw error;
  }
}
