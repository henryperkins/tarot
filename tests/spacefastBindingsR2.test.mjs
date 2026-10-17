import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createR2Bucket, signR2Request } from '../spacefast/bindings/r2.js';

const credentials = { R2_ACCOUNT_ID: 'example-account', R2_ACCESS_KEY_ID: 'test-access', R2_SECRET_ACCESS_KEY: 'test-secret' };
const now = () => new Date('2026-10-09T05:06:07.000Z');
const key = 'exports/a b+?é.pdf';

describe('Spacefast R2 S3 HTTP adapter', () => {
  it('matches an independently calculated SigV4 signature for encoded keys, query order and a signed payload', async () => {
    const headers = await signR2Request({
      url: 'https://example-account.r2.cloudflarestorage.com/tarot-logs/exports/a%20b%2B%3F%C3%A9.pdf?z=last&a=first',
      method: 'PUT', headers: new Headers({ 'content-type': 'application/pdf' }),
      body: new TextEncoder().encode('hello'), accessKeyId: 'test-access', secretAccessKey: 'test-secret', now: now(),
    });
    assert.equal(headers.get('x-amz-content-sha256'), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    assert.equal(headers.get('x-amz-date'), '20261009T050607Z');
    assert.equal(headers.get('authorization'), 'AWS4-HMAC-SHA256 Credential=test-access/20261009/auto/s3/aws4_request, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=58b3cfedb8ff3023e5502c83375432c482972738f128d537b758da5d96555718');
  });

  it('writes exact private object bytes and HTTP/custom metadata through signed requests', async () => {
    let request;
    const r2 = createR2Bucket(credentials, { now, fetch: async (url, init) => {
      request = { url, init };
      return new Response(null, { status: 200, headers: { etag: '"object-etag"' } });
    } });
    const result = await r2.put(key, new Uint8Array([0, 255, 3]), {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, max-age=300' },
      customMetadata: { userId: 'reader-1', expiresAt: '2026-11-08T00:00:00.000Z' },
    });
    assert.equal(request.url, 'https://example-account.r2.cloudflarestorage.com/tarot-logs/exports/a%20b%2B%3F%C3%A9.pdf');
    assert.equal(request.init.method, 'PUT');
    assert.equal(request.init.redirect, 'error');
    assert.deepEqual(request.init.body, new Uint8Array([0, 255, 3]));
    assert.equal(request.init.headers.get('content-type'), 'application/pdf');
    assert.equal(request.init.headers.get('cache-control'), 'private, max-age=300');
    assert.equal(request.init.headers.get('x-amz-meta-userid'), 'reader-1');
    assert.equal(request.init.headers.get('x-amz-meta-expiresat'), '2026-11-08T00:00:00.000Z');
    assert.deepEqual(JSON.parse(decodeURIComponent(request.init.headers.get('x-amz-meta-tableu-key-map'))), { userid: 'userId', expiresat: 'expiresAt' });
    assert.match(request.init.headers.get('authorization'), /^AWS4-HMAC-SHA256 /);
    assert.equal(result.size, 3);
    assert.equal(result.etag, 'object-etag');
    assert.deepEqual(result.customMetadata, { userId: 'reader-1', expiresAt: '2026-11-08T00:00:00.000Z' });
  });

  it('serves binary object bodies and reconstructs stored metadata names without leaking the internal map', async () => {
    const r2 = createR2Bucket(credentials, { now, fetch: async (_url, init) => {
      assert.equal(init.method, 'GET');
      return new Response(new Uint8Array([0, 255, 3]), { headers: {
        'content-type': 'application/pdf', 'content-length': '3', 'cache-control': 'private', etag: '"etag"',
        'last-modified': 'Fri, 09 Oct 2026 05:06:07 GMT', 'x-amz-meta-userid': 'reader-1',
        'x-amz-meta-tableu-key-map': encodeURIComponent(JSON.stringify({ userid: 'userId' })),
      } });
    } });
    const object = await r2.get(key);
    assert.equal(object.size, 3);
    assert.equal(object.httpMetadata.contentType, 'application/pdf');
    assert.deepEqual(object.customMetadata, { userId: 'reader-1' });
    assert.equal(object.uploaded.toISOString(), now().toISOString());
    assert.equal(object.bodyUsed, false);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    assert.equal(headers.get('content-type'), 'application/pdf');
    assert.equal(headers.get('cache-control'), 'private');
    assert.deepEqual(new Uint8Array(await object.arrayBuffer()), new Uint8Array([0, 255, 3]));
    assert.equal(object.bodyUsed, true);
  });

  it('preserves legacy S3 metadata and does not invent a zero-byte object size', async () => {
    const r2 = createR2Bucket(credentials, { now, fetch: async () => new Response('legacy', { headers: { 'x-amz-meta-card': 'Sun' } }) });
    const object = await r2.get('legacy');
    assert.equal(object.size, undefined);
    assert.deepEqual(object.customMetadata, { card: 'Sun' });
    assert.equal(await object.text(), 'legacy');
  });

  it('decodes S3 list responses and retains opaque cursors for account-deletion pagination', async () => {
    const requests = [];
    const xml = `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
      <EncodingType>url</EncodingType><IsTruncated>true</IsTruncated><NextContinuationToken>opaque&amp;+value</NextContinuationToken>
      <Contents><Key>exports/readings/user%2B1/a%20b.pdf</Key><Size>17</Size><ETag>&quot;etag-1&quot;</ETag><LastModified>2026-10-09T05:06:07.000Z</LastModified></Contents>
      <CommonPrefixes><Prefix>exports/readings/user%2B1/</Prefix></CommonPrefixes></ListBucketResult>`;
    const r2 = createR2Bucket(credentials, { now, fetch: async (url, init) => {
      requests.push({ url, init });
      return new Response(requests.length === 1 ? xml : '<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>');
    } });
    const page = await r2.list({ prefix: 'exports/readings/user+1/', limit: 1 });
    assert.equal(page.truncated, true);
    assert.equal(page.cursor, 'opaque&+value');
    assert.deepEqual(page.objects, [{ key: 'exports/readings/user+1/a b.pdf', size: 17, etag: 'etag-1', httpEtag: '"etag-1"', uploaded: now() }]);
    assert.deepEqual(page.delimitedPrefixes, ['exports/readings/user+1/']);
    const query = new URL(requests[0].url).searchParams;
    assert.equal(query.get('list-type'), '2');
    assert.equal(query.get('encoding-type'), 'url');
    assert.equal(query.get('max-keys'), '1');
    assert.equal(query.get('prefix'), 'exports/readings/user+1/');
    await r2.delete(page.objects[0].key);
    assert.equal(requests[1].init.method, 'DELETE');
    assert.match(requests[1].init.headers.get('authorization'), /SignedHeaders=host;x-amz-content-sha256;x-amz-date/);
    const final = await r2.list({ prefix: 'exports/readings/user+1/', cursor: page.cursor });
    assert.equal(new URL(requests[2].url).searchParams.get('continuation-token'), 'opaque&+value');
    assert.equal(final.truncated, false);
    assert.equal(final.cursor, undefined);
  });

  it('returns null only for missing objects and rejects authorization/provider errors', async () => {
    const r2 = createR2Bucket(credentials, { now, fetch: async () => new Response('PRIVATE', { status: 404 }) });
    assert.equal(await r2.get('missing'), null);
    assert.equal(await r2.head('missing'), null);
    await assert.rejects(r2.list(), error => error.status === 404 && !error.message.includes('PRIVATE'));
    const denied = createR2Bucket(credentials, { now, fetch: async () => new Response('PRIVATE', { status: 403 }) });
    await assert.rejects(denied.get('private'), error => error.status === 403 && !error.message.includes('PRIVATE'));
    await assert.rejects(denied.put('private', 'data'), { status: 403 });
  });

  it('rejects malformed or incomplete listings instead of reporting incomplete deletion as success', async () => {
    for (const xml of ['not XML', '<ListBucketResult></ListBucketResult>',
      '<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>',
      '<ListBucketResult><IsTruncated>false</IsTruncated><Contents><Key>key</Key></Contents></ListBucketResult>']) {
      const r2 = createR2Bucket(credentials, { now, fetch: async () => new Response(xml) });
      await assert.rejects(r2.list(), /invalid object listing|without a cursor/);
    }
  });

  it('does not sign unsafe endpoints, dot segments or ambiguous metadata keys', async () => {
    assert.equal(createR2Bucket({}), undefined);
    assert.throws(() => createR2Bucket({ ...credentials, R2_ENDPOINT: 'https://unrelated.example' }), /R2_ENDPOINT/);
    const r2 = createR2Bucket(credentials, { now, fetch: async () => { throw new Error('Must not fetch'); } });
    await assert.rejects(r2.get('a/../private'), /Invalid R2 object key/);
    await assert.rejects(r2.put('key', 'data', { customMetadata: { userId: 'one', userid: 'two' } }), /unique/);
    await assert.rejects(r2.put('key', 'data', { customMetadata: { 'tableu-key-map': 'reserved' } }), /unique/);
  });
});
