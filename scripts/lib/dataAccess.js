/**
 * Shared data access helpers for R2, KV, and D1.
 */

import { spawn } from 'node:child_process';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

export function createR2Client(options = {}) {
  const accountId = options.accountId || process.env.CF_ACCOUNT_ID;
  const accessKeyId = options.accessKeyId || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = options.secretAccessKey || process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = options.endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : null);
  const region = options.region || 'auto';

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2 credentials. Set CF_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.');
  }

  return new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey }
  });
}

export async function listJsonFromR2(client, { bucket, prefix, cutoffDate = null } = {}) {
  if (!client) {
    throw new Error('R2 client is required');
  }
  if (!bucket) {
    throw new Error('R2 bucket is required');
  }

  const items = [];
  let continuationToken = null;

  do {
    const listCmd = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken || undefined
    });

    const listed = await client.send(listCmd);

    for (const obj of listed.Contents || []) {
      if (cutoffDate && obj.LastModified && new Date(obj.LastModified) < cutoffDate) {
        continue;
      }

      const getCmd = new GetObjectCommand({ Bucket: bucket, Key: obj.Key });
      const response = await client.send(getCmd);
      const body = await response.Body.transformToString();

      try {
        const data = JSON.parse(body);
        items.push({
          key: obj.Key,
          lastModified: obj.LastModified,
          data
        });
      } catch (err) {
        console.warn(`[dataAccess] Failed to parse ${obj.Key}: ${err.message}`);
      }
    }

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : null;
  } while (continuationToken);

  return items;
}

export async function fetchKvJsonRecords({ namespaceId, prefix, target = 'remote' } = {}) {
  if (!namespaceId) {
    return [];
  }

  const listArgs = [
    'wrangler',
    'kv',
    'key',
    'list',
    '--namespace-id',
    namespaceId
  ];

  if (prefix) {
    listArgs.push('--prefix', prefix);
  }

  addTarget(listArgs, target);

  const listOutput = await runWranglerCommand(listArgs);
  let keys;
  try {
    keys = JSON.parse(listOutput);
  } catch (err) {
    throw new Error(`Failed to parse KV key list: ${err.message}`);
  }

  const records = [];
  for (const entry of keys) {
    if (!entry?.name) continue;
    const record = await readKvJson({ namespaceId, key: entry.name, target });
    if (record) records.push(record);
  }
  return records;
}

export async function readKvJson({ namespaceId, key, target = 'remote' }) {
  const args = [
    'wrangler',
    'kv',
    'key',
    'get',
    key,
    '--namespace-id',
    namespaceId
  ];

  addTarget(args, target);

  const value = await runWranglerCommand(args);
  try {
    return JSON.parse(value);
  } catch (err) {
    console.warn(`[dataAccess] Failed to parse KV value for ${key}: ${err.message}`);
    return null;
  }
}

export async function executeD1Query({ dbName, sql, target = 'remote' }) {
  const args = [
    'wrangler',
    'd1',
    'execute',
    dbName,
    '--command',
    sql,
    '--json'
  ];

  addTarget(args, target);

  const result = await runWranglerCommand(args);
  let parsed;
  try {
    parsed = JSON.parse(result);
  } catch (err) {
    throw new Error(`Failed to parse D1 response: ${err.message}`);
  }

  const rows = Array.isArray(parsed)
    ? parsed.flatMap((entry) => entry?.results || [])
    : parsed?.results || [];

  return rows;
}

export async function runWranglerCommand(args) {
  return new Promise((resolve, reject) => {
    // Pass through Cloudflare API token from environment if available
    const env = { ...process.env };

    const child = spawn('npx', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${args.join(' ')} failed: ${stderr || stdout}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function addTarget(args, target) {
  if (target === 'local') {
    args.push('--local');
  } else if (target === 'remote') {
    args.push('--remote');
  }
}
