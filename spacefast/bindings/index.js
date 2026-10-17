import { createDatabaseKV } from './kv.js';
import { createWorkersAI } from './ai.js';
import { createR2Bucket } from './r2.js';

export { KV_SCHEMA_SQL, createDatabaseKV, cleanupExpiredKV } from './kv.js';
export { createWorkersAI } from './ai.js';
export { createR2Bucket } from './r2.js';

// env.DB may already be the SQLite-to-MySQL application adapter. KV owns native
// MySQL SQL, so root integration retains the broker under TABLEU_NATIVE_DB.
export function createSpacefastBindings(env, options = {}) {
  const nativeDB = env.TABLEU_NATIVE_DB || env.DB;
  const bindings = {};
  for (const namespace of ['RATELIMIT', 'FEEDBACK_KV', 'METRICS_DB', 'OAUTH_KV']) {
    bindings[namespace] = createDatabaseKV(nativeDB, namespace, options);
  }
  bindings.AI = createWorkersAI(env, options);
  bindings.R2_LOGS = createR2Bucket(env, options);
  // emailService.js already uses RESEND_API_KEY when the EMAIL binding is absent.
  bindings.EMAIL = undefined;
  return bindings;
}
