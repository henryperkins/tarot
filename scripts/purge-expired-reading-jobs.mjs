#!/usr/bin/env node
/**
 * Enforce retention on ReadingJob Durable Objects stored before deletion
 * alarms existed. Lists the namespace's objects that hold data (Cloudflare
 * API) and sends their ids to POST /api/admin/reading-jobs/retention, where
 * each job deletes itself if its retention has passed and otherwise
 * schedules its deletion alarm.
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID  list the namespace's objects
 *   READING_JOB_PURGE_TOKEN                      the route's token; set the
 *     same value as a Worker secret for the run, then delete the secret
 *
 * Usage (from the repository root):
 *   node scripts/purge-expired-reading-jobs.mjs --dry-run
 *   READING_JOB_PURGE_TOKEN=… node scripts/purge-expired-reading-jobs.mjs [--base-url URL] [--script NAME]
 */

const API = 'https://api.cloudflare.com/client/v4';
const BATCH_SIZE = 100;
const USER_AGENT = 'tableu-maintenance/1.0 (reading-job retention)';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function cloudflare(path, token) {
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw new Error(`${path}: HTTP ${response.status} ${JSON.stringify(body?.errors ?? body)}`);
  }
  return body;
}

async function findNamespace({ accountId, token, script }) {
  const { result } = await cloudflare(`/accounts/${accountId}/workers/durable_objects/namespaces?per_page=1000`, token);
  const namespace = result.find((candidate) => candidate.class === 'ReadingJob' && candidate.script === script);
  if (!namespace) throw new Error(`No ReadingJob namespace for script ${script}`);
  return namespace.id;
}

async function listObjectsWithData({ accountId, token, namespaceId }) {
  const ids = [];
  let listed = 0;
  let cursor = '';
  do {
    const query = `limit=10000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const body = await cloudflare(`/accounts/${accountId}/workers/durable_objects/namespaces/${namespaceId}/objects?${query}`, token);
    listed += body.result.length;
    ids.push(...body.result.filter((object) => object.hasStoredData).map((object) => object.id));
    cursor = body.result_info?.cursor || '';
  } while (cursor);
  return { listed, ids };
}

async function enforce({ baseUrl, purgeToken, ids }) {
  const totals = { purged: 0, scheduled: 0, failed: 0 };
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const response = await fetch(`${baseUrl}/api/admin/reading-jobs/retention`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${purgeToken}`,
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT
      },
      body: JSON.stringify({ ids: ids.slice(start, start + BATCH_SIZE) })
    });
    const counts = await response.json().catch(() => null);
    if (!response.ok || !counts) {
      throw new Error(`Batch starting at ${start}: HTTP ${response.status} ${JSON.stringify(counts)}`);
    }
    for (const key of Object.keys(totals)) totals[key] += counts[key] ?? 0;
    console.log(`Batch ${start / BATCH_SIZE + 1}: ${JSON.stringify(counts)}`);
  }
  return totals;
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !accountId) throw new Error('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.');
  const script = option('--script', 'tableau');
  const baseUrl = option('--base-url', 'https://tarot.lakefrontdev.com').replace(/\/$/, '');

  const namespaceId = await findNamespace({ accountId, token, script });
  const { listed, ids } = await listObjectsWithData({ accountId, token, namespaceId });
  console.log(`Namespace ${namespaceId}: ${listed} objects, ${ids.length} holding data.`);
  if (process.argv.includes('--dry-run') || ids.length === 0) return;

  const purgeToken = process.env.READING_JOB_PURGE_TOKEN;
  if (!purgeToken) throw new Error('Set READING_JOB_PURGE_TOKEN to the Worker secret for this run.');
  const totals = await enforce({ baseUrl, purgeToken, ids });
  console.log(`Done: ${JSON.stringify(totals)}`);
  if (totals.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
