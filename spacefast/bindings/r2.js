// R2's documented S3 API keeps the existing private bucket in use through HTTPS.
// Signing uses Web Crypto, without a Node/AWS SDK dependency in the Worker.
const encoder = new TextEncoder();
const EMPTY_BODY = new Uint8Array();
const METADATA_CASE_HEADER = 'x-amz-meta-tableu-key-map';
const HTTP_METADATA = {
  contentType: 'content-type',
  contentLanguage: 'content-language',
  contentDisposition: 'content-disposition',
  contentEncoding: 'content-encoding',
  cacheControl: 'cache-control',
  cacheExpiry: 'expires',
};

function hex(bytes) {
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  return hex(await crypto.subtle.digest('SHA-256', value));
}

async function hmac(key, message) {
  const imported = await crypto.subtle.importKey('raw', typeof key === 'string' ? encoder.encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', imported, encoder.encode(message));
}

function uriEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(url) {
  return [...url.searchParams.entries()].map(([key, value]) => [uriEncode(key), uriEncode(value)])
    .sort(([keyA, valueA], [keyB, valueB]) => keyA < keyB ? -1 : keyA > keyB ? 1 : valueA < valueB ? -1 : valueA > valueB ? 1 : 0)
    .map(([key, value]) => `${key}=${value}`).join('&');
}

export async function signR2Request({ url, method, headers = new Headers(), body = EMPTY_BODY,
  accessKeyId, secretAccessKey, now = new Date() }) {
  const parsed = new URL(url);
  const signedHeaders = new Headers(headers);
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = timestamp.slice(0, 8);
  const digest = await sha256(body);
  signedHeaders.set('host', parsed.host);
  signedHeaders.set('x-amz-date', timestamp);
  signedHeaders.set('x-amz-content-sha256', digest);
  const entries = [...signedHeaders.entries()].filter(([key]) => key !== 'authorization')
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const names = entries.map(([key]) => key).join(';');
  const canonicalHeaders = entries.map(([key, value]) => `${key}:${value.trim().replace(/\s+/g, ' ')}\n`).join('');
  const canonical = [method, parsed.pathname, canonicalQuery(parsed), canonicalHeaders, names, digest].join('\n');
  const scope = `${date}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', timestamp, scope, await sha256(encoder.encode(canonical))].join('\n');
  const dateKey = await hmac(`AWS4${secretAccessKey}`, date);
  const regionKey = await hmac(dateKey, 'auto');
  const serviceKey = await hmac(regionKey, 's3');
  const signingKey = await hmac(serviceKey, 'aws4_request');
  const signature = hex(await hmac(signingKey, toSign));
  signedHeaders.set('authorization', `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names}, Signature=${signature}`);
  return signedHeaders;
}

function validateKey(key) {
  if (typeof key !== 'string' || !key || key.split('/').some(part => part === '.' || part === '..')) {
    throw new TypeError('Invalid R2 object key.');
  }
}

function decodeXml(value) {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return String.fromCodePoint(code);
    }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity.toLowerCase()];
  });
}

function xmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  if (!match) return null;
  const value = match[1];
  if (value.startsWith('<![CDATA[') && value.endsWith(']]>')) return value.slice(9, -3);
  return decodeXml(value);
}

function responseMetadata(response, key, knownSize) {
  const httpMetadata = {};
  for (const [property, header] of Object.entries(HTTP_METADATA)) {
    const value = response.headers.get(header);
    if (value !== null) httpMetadata[property] = property === 'cacheExpiry' ? new Date(value) : value;
  }
  const customMetadataEntries = [];
  const keyMapValue = response.headers.get(METADATA_CASE_HEADER);
  let originalNames = {};
  if (keyMapValue) {
    try { originalNames = JSON.parse(decodeURIComponent(keyMapValue)); } catch { /* Older objects use S3 names. */ }
  }
  for (const [header, value] of response.headers) {
    if (header.startsWith('x-amz-meta-') && header !== METADATA_CASE_HEADER) {
      const name = header.slice(11);
      customMetadataEntries.push([Object.hasOwn(originalNames, name) ? originalNames[name] : name, value]);
    }
  }
  const etag = response.headers.get('etag') || '';
  const length = response.headers.get('content-length');
  const size = knownSize ?? (length === null ? undefined : Number(length));
  const lastModified = response.headers.get('last-modified');
  return {
    key,
    etag: etag.replace(/^"|"$/g, ''),
    httpEtag: etag,
    size,
    uploaded: lastModified ? new Date(lastModified) : undefined,
    httpMetadata,
    customMetadata: Object.fromEntries(customMetadataEntries),
    writeHttpMetadata(headers) {
      for (const [property, header] of Object.entries(HTTP_METADATA)) {
        if (httpMetadata[property] !== undefined) {
          headers.set(header, property === 'cacheExpiry' ? httpMetadata[property].toUTCString() : httpMetadata[property]);
        }
      }
    },
  };
}

function requestError(method, response) {
  const error = new Error(`R2 ${method} failed (HTTP ${response.status}).`);
  error.status = response.status;
  return error;
}

export function createR2Bucket(env, { fetch: fetchRequest = globalThis.fetch, now = () => new Date() } = {}) {
  const account = env.R2_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID;
  const accessKeyId = typeof env.R2_ACCESS_KEY_ID === 'string' ? env.R2_ACCESS_KEY_ID.trim() : '';
  const secretAccessKey = typeof env.R2_SECRET_ACCESS_KEY === 'string' ? env.R2_SECRET_ACCESS_KEY.trim() : '';
  if (!accessKeyId || !secretAccessKey || (!account && !env.R2_ENDPOINT)) return undefined;
  const endpoint = new URL(env.R2_ENDPOINT || `https://${account}.r2.cloudflarestorage.com`);
  if (endpoint.protocol !== 'https:' || !/^[a-z0-9.-]+\.r2\.cloudflarestorage\.com$/.test(endpoint.hostname)
    || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/' || endpoint.port) {
    throw new TypeError('R2_ENDPOINT must be a Cloudflare R2 HTTPS API origin.');
  }
  const bucketName = env.R2_BUCKET_NAME || 'tarot-logs';
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucketName)) throw new TypeError('Invalid R2 bucket name.');

  function objectUrl(key) {
    const path = `/${uriEncode(bucketName)}${key === undefined ? '' : `/${key.split('/').map(uriEncode).join('/')}`}`;
    return new URL(path, endpoint.origin);
  }

  async function request(method, key, { headers = new Headers(), body, query, signal } = {}) {
    const url = objectUrl(key);
    for (const [name, value] of Object.entries(query || {})) {
      if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
    }
    const bytes = body === undefined ? EMPTY_BODY : new Uint8Array(await new Response(body).arrayBuffer());
    const signed = await signR2Request({ url, method, headers, body: bytes, accessKeyId, secretAccessKey, now: now() });
    const response = await fetchRequest(url.toString(), {
      method, headers: signed, ...(method === 'PUT' ? { body: bytes } : {}), signal, redirect: 'error',
    });
    if (response.status === 404 && key !== undefined && (method === 'GET' || method === 'HEAD')) return null;
    if (!response.ok) throw requestError(method, response);
    return { response, bytes };
  }

  return {
    async get(key) {
      validateKey(key);
      const result = await request('GET', key);
      if (!result) return null;
      const { response } = result;
      return {
        ...responseMetadata(response, key),
        body: response.body,
        get bodyUsed() { return response.bodyUsed; },
        arrayBuffer: () => response.arrayBuffer(),
        text: () => response.text(),
        json: () => response.json(),
        blob: () => response.blob(),
      };
    },

    async head(key) {
      validateKey(key);
      const result = await request('HEAD', key);
      return result ? responseMetadata(result.response, key) : null;
    },

    async put(key, value, { httpMetadata = {}, customMetadata = {} } = {}) {
      validateKey(key);
      const headers = new Headers();
      for (const [property, header] of Object.entries(HTTP_METADATA)) {
        if (httpMetadata[property] !== undefined) {
          headers.set(header, property === 'cacheExpiry' ? new Date(httpMetadata[property]).toUTCString() : httpMetadata[property]);
        }
      }
      const originalNames = Object.create(null);
      for (const [name, metadata] of Object.entries(customMetadata)) {
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new TypeError('Invalid R2 custom metadata name.');
        if (name.toLowerCase() === METADATA_CASE_HEADER.slice(11) || Object.hasOwn(originalNames, name.toLowerCase())) {
          throw new TypeError('R2 custom metadata names must be unique without regard to case.');
        }
        originalNames[name.toLowerCase()] = name;
        headers.set(`x-amz-meta-${name}`, String(metadata));
      }
      // S3 lowercases metadata names. Retain the original names Tableu stores.
      if (Object.keys(originalNames).length) headers.set(METADATA_CASE_HEADER, encodeURIComponent(JSON.stringify(originalNames)));
      const { response, bytes } = await request('PUT', key, { headers, body: value });
      return {
        ...responseMetadata(response, key, bytes.byteLength),
        httpMetadata: { ...httpMetadata },
        customMetadata: { ...customMetadata },
      };
    },

    async delete(key) {
      const keys = Array.isArray(key) ? key : [key];
      keys.forEach(validateKey);
      for (const objectKey of keys) await request('DELETE', objectKey);
    },

    async list({ prefix = '', limit = 1000, cursor, delimiter, startAfter } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new TypeError('R2 list limit must be 1 through 1000.');
      const { response } = await request('GET', undefined, { query: {
        'list-type': 2, 'encoding-type': 'url', 'max-keys': limit, prefix,
        'continuation-token': cursor, delimiter, 'start-after': startAfter,
      } });
      const xml = await response.text();
      if (!/<ListBucketResult(?:\s[^>]*)?>/.test(xml) || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
        throw new Error('R2 returned an invalid object listing.');
      }
      const encoded = xmlValue(xml, 'EncodingType') === 'url';
      const decodeKey = key => encoded ? decodeURIComponent(key) : key;
      const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(([, block]) => {
        const key = xmlValue(block, 'Key');
        const rawSize = xmlValue(block, 'Size');
        const size = Number(rawSize);
        const uploaded = new Date(xmlValue(block, 'LastModified') || '');
        if (key === null || rawSize === null || !Number.isFinite(size) || size < 0 || !Number.isFinite(uploaded.getTime())) {
          throw new Error('R2 returned an invalid object listing.');
        }
        const httpEtag = xmlValue(block, 'ETag') || '';
        return {
          key: decodeKey(key), size,
          etag: httpEtag.replace(/^"|"$/g, ''), httpEtag,
          uploaded,
        };
      });
      const truncatedText = xmlValue(xml, 'IsTruncated');
      if (truncatedText !== 'true' && truncatedText !== 'false') throw new Error('R2 returned an invalid object listing.');
      const truncated = truncatedText === 'true';
      const nextCursor = xmlValue(xml, 'NextContinuationToken');
      if (truncated && !nextCursor) throw new Error('R2 returned a truncated listing without a cursor.');
      return {
        objects, truncated, ...(truncated ? { cursor: nextCursor } : {}),
        delimitedPrefixes: [...xml.matchAll(/<CommonPrefixes>([\s\S]*?)<\/CommonPrefixes>/g)]
          .map(([, block]) => decodeKey(xmlValue(block, 'Prefix') || '')),
      };
    },
  };
}
