/**
 * User media library endpoints.
 *
 * GET /api/media
 *   - List media items for current user
 *   - If `contentId` query param is present, streams binary media content
 *
 * POST /api/media
 *   - Persist a generated media record for current user
 *
 * DELETE /api/media?id=...
 *   - Remove a media record for current user
 */

import { getUserFromRequest } from '../lib/auth.js';
import { getSubscriptionContext } from '../lib/entitlements.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { getMediaTierConfig } from '../../shared/monetization/media.js';

const VALID_MEDIA_TYPES = new Set(['image', 'video']);
const VALID_SOURCES = new Set(['story-art', 'card-reveal']);
const VALID_STORAGE_KEY_PREFIXES = ['generated-video/', 'generated-art/', 'media/'];

function isMissingMediaTableError(err) {
  const message = String(err?.message || err || '').toLowerCase();
  return message.includes('no such table') && message.includes('user_media');
}

function normalizeText(value, maxLength = 240) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeOptionalInteger(value) {
  if (value == null) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.floor(parsed);
}

function safeJsonParse(value, fallback = null) {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function extensionFromMimeType(mimeType) {
  const normalized = (mimeType || '').toLowerCase().trim();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'video/mp4') return 'mp4';
  if (normalized === 'video/webm') return 'webm';
  return 'bin';
}

function sanitizeFileName(value, fallback) {
  const base = normalizeText(value, 80) || fallback;
  return base
    .replace(/[^a-z0-9-_ ]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || fallback;
}

function createRequestId(prefix = 'media') {
  if (crypto?.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function logMediaError(label, details = {}) {
  const payload = { ...details };
  const error = payload.error;
  if (error && typeof error === 'object') {
    payload.error = {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: typeof error.stack === 'string' ? error.stack : null
    };
  }
  console.error(`[media] ${label}`, payload);
}

function toClientRecord(record) {
  return {
    id: record.id,
    mediaType: record.media_type,
    source: record.source,
    title: record.title,
    question: record.prompt_question,
    cardName: record.card_name,
    positionLabel: record.position_label,
    styleId: record.style_id,
    formatId: record.format_id,
    mimeType: record.mime_type,
    storageProvider: record.storage_provider,
    storageKey: record.storage_key,
    bytes: normalizeOptionalInteger(record.bytes),
    metadata: safeJsonParse(record.metadata_json, {}),
    createdAt: Number(record.created_at) * 1000,
    updatedAt: Number(record.updated_at) * 1000,
    contentUrl: `/api/media?contentId=${encodeURIComponent(record.id)}`,
    downloadUrl: `/api/media?contentId=${encodeURIComponent(record.id)}&download=1`
  };
}

async function requireMediaAccess(request, env) {
  const user = await getUserFromRequest(request, env);
  if (!user) {
    return { response: jsonResponse({ error: 'Authentication required' }, 401) };
  }

  const subscription = getSubscriptionContext(user);
  const tier = subscription?.effectiveTier || 'free';
  const mediaConfig = getMediaTierConfig(tier);
  if (!mediaConfig.gallery.enabled) {
    return {
      response: jsonResponse({
        error: 'Media gallery requires a Plus or Pro subscription',
        tierLimited: true,
        requiredTier: 'plus',
        currentTier: tier
      }, 403)
    };
  }

  return { user, tier, mediaConfig };
}

async function fetchMediaRecordById(env, userId, id) {
  return env.DB
    .prepare(`
      SELECT
        id,
        user_id,
        created_at,
        updated_at,
        media_type,
        source,
        title,
        prompt_question,
        card_name,
        position_label,
        style_id,
        format_id,
        mime_type,
        storage_provider,
        storage_key,
        bytes,
        metadata_json
      FROM user_media
      WHERE user_id = ? AND id = ?
      LIMIT 1
    `)
    .bind(userId, id)
    .first();
}

async function handleContentRequest(context, user) {
  const { request, env } = context;
  const requestId = createRequestId('media_content');
  const url = new URL(request.url);
  const contentId = normalizeText(url.searchParams.get('contentId'), 120);
  const wantsDownload = url.searchParams.get('download') === '1';

  if (!contentId) {
    return jsonResponse({ error: 'contentId is required' }, 400);
  }

  let record;
  try {
    record = await fetchMediaRecordById(env, user.id, contentId);
  } catch (err) {
    if (isMissingMediaTableError(err)) {
      logMediaError('content lookup failed: missing user_media table', {
        requestId,
        userId: user?.id || null,
        contentId
      });
      return jsonResponse({ error: 'Media storage is not available yet. Run migrations first.' }, 503);
    }
    logMediaError('content lookup failed', {
      requestId,
      userId: user?.id || null,
      contentId,
      error: err
    });
    return jsonResponse({
      error: 'Media storage backend is unavailable',
      requestId
    }, 503);
  }

  if (!record) {
    return jsonResponse({ error: 'Media not found' }, 404);
  }

  if (!env.R2_LOGS) {
    logMediaError('content fetch failed: missing R2_LOGS binding', {
      requestId,
      userId: user?.id || null,
      contentId,
      storageKey: record.storage_key
    });
    return jsonResponse({
      error: 'Media storage backend is unavailable',
      requestId
    }, 503);
  }

  let object = null;
  try {
    object = await env.R2_LOGS.get(record.storage_key);
    // Fallback to legacy keys stored without file extension
    if (!object && !record.storage_key.includes('.')) {
      const ext = extensionFromMimeType(record.mime_type);
      if (ext) {
        object = await env.R2_LOGS.get(`${record.storage_key}.${ext}`);
      }
    }
  } catch (err) {
    logMediaError('R2 get failed while serving media content', {
      requestId,
      userId: user?.id || null,
      contentId,
      storageKey: record.storage_key,
      error: err
    });
    return jsonResponse({
      error: 'Media storage backend is unavailable',
      requestId
    }, 503);
  }

  if (!object) {
    return jsonResponse({ error: 'Media file is unavailable' }, 404);
  }

  const extension = extensionFromMimeType(record.mime_type);
  const titleBase = sanitizeFileName(
    record.title || `${record.source}-${record.media_type}`,
    `${record.source}-${record.media_type}`
  );
  const headers = new Headers({
    'content-type': record.mime_type || object.httpMetadata?.contentType || 'application/octet-stream',
    'cache-control': 'private, max-age=300'
  });

  if (Number.isFinite(object.size)) {
    headers.set('content-length', String(object.size));
  }

  if (wantsDownload) {
    headers.set('content-disposition', `attachment; filename="${titleBase}.${extension}"`);
  }

  return new Response(object.body, { status: 200, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const access = await requireMediaAccess(request, env);
  if (access.response) return access.response;

  const { user } = access;
  const url = new URL(request.url);
  const contentId = normalizeText(url.searchParams.get('contentId'), 120);

  if (contentId) {
    return handleContentRequest(context, user);
  }

  const typeFilter = normalizeText(url.searchParams.get('type'), 20)?.toLowerCase() || null;
  const sourceFilter = normalizeText(url.searchParams.get('source'), 20)?.toLowerCase() || null;
  const rawLimit = Number.parseInt(url.searchParams.get('limit') || '24', 10);
  const rawOffset = Number.parseInt(url.searchParams.get('offset') || '0', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 24;
  const offset = Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0;

  if (typeFilter && !VALID_MEDIA_TYPES.has(typeFilter)) {
    return jsonResponse({ error: `Invalid type '${typeFilter}'` }, 400);
  }
  if (sourceFilter && !VALID_SOURCES.has(sourceFilter)) {
    return jsonResponse({ error: `Invalid source '${sourceFilter}'` }, 400);
  }

  const queryParts = ['user_id = ?'];
  const queryBindings = [user.id];
  if (typeFilter) {
    queryParts.push('media_type = ?');
    queryBindings.push(typeFilter);
  }
  if (sourceFilter) {
    queryParts.push('source = ?');
    queryBindings.push(sourceFilter);
  }
  const whereClause = queryParts.join(' AND ');

  try {
    const rows = await env.DB
      .prepare(`
        SELECT
          id,
          user_id,
          created_at,
          updated_at,
          media_type,
          source,
          title,
          prompt_question,
          card_name,
          position_label,
          style_id,
          format_id,
          mime_type,
          storage_provider,
          storage_key,
          bytes,
          metadata_json
        FROM user_media
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...queryBindings, limit, offset)
      .all();

    const countRow = await env.DB
      .prepare(`SELECT COUNT(*) AS total FROM user_media WHERE ${whereClause}`)
      .bind(...queryBindings)
      .first();

    const media = (rows?.results || []).map(toClientRecord);
    const total = Number(countRow?.total || 0);

    return jsonResponse({
      media,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + media.length < total,
        nextOffset: offset + media.length
      }
    });
  } catch (err) {
    if (isMissingMediaTableError(err)) {
      return jsonResponse({ error: 'Media storage is not available yet. Run migrations first.' }, 503);
    }
    console.error('[media] list failed:', err);
    return jsonResponse({ error: 'Failed to load media' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const access = await requireMediaAccess(request, env);
  if (access.response) return access.response;
  const { user } = access;

  let payload;
  try {
    payload = await readJsonBody(request);
  } catch (_err) {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400);
  }

  const mediaType = normalizeText(payload.mediaType, 20)?.toLowerCase() || '';
  const source = normalizeText(payload.source, 40)?.toLowerCase() || '';
  const storageKey = normalizeText(payload.storageKey, 260);
  const mimeType = normalizeText(payload.mimeType, 120);

  if (!VALID_MEDIA_TYPES.has(mediaType)) {
    return jsonResponse({ error: 'mediaType must be image or video' }, 400);
  }
  if (!VALID_SOURCES.has(source)) {
    return jsonResponse({ error: 'source must be story-art or card-reveal' }, 400);
  }
  if (!storageKey) {
    return jsonResponse({ error: 'storageKey is required' }, 400);
  }
  // Validate storage key uses a known server-generated prefix
  if (!VALID_STORAGE_KEY_PREFIXES.some((p) => storageKey.startsWith(p))) {
    return jsonResponse({ error: 'Invalid storageKey format' }, 400);
  }
  if (!mimeType) {
    return jsonResponse({ error: 'mimeType is required' }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  const title = normalizeText(payload.title, 140);
  const promptQuestion = normalizeText(payload.question, 500);
  const cardName = normalizeText(payload.cardName, 120);
  const positionLabel = normalizeText(payload.positionLabel, 120);
  const styleId = normalizeText(payload.styleId, 80);
  const formatId = normalizeText(payload.formatId, 80);
  const bytes = normalizeOptionalInteger(payload.bytes);
  const metadataJson = payload.metadata && typeof payload.metadata === 'object'
    ? JSON.stringify(payload.metadata)
    : null;

  try {
    const existing = await env.DB
      .prepare('SELECT id FROM user_media WHERE user_id = ? AND storage_key = ? LIMIT 1')
      .bind(user.id, storageKey)
      .first();

    let recordId = existing?.id || null;

    if (recordId) {
      await env.DB
        .prepare(`
          UPDATE user_media
          SET
            updated_at = ?,
            media_type = ?,
            source = ?,
            title = ?,
            prompt_question = ?,
            card_name = ?,
            position_label = ?,
            style_id = ?,
            format_id = ?,
            mime_type = ?,
            bytes = ?,
            metadata_json = ?
          WHERE id = ? AND user_id = ?
        `)
        .bind(
          now,
          mediaType,
          source,
          title,
          promptQuestion,
          cardName,
          positionLabel,
          styleId,
          formatId,
          mimeType,
          bytes,
          metadataJson,
          recordId,
          user.id
        )
        .run();
    } else {
      recordId = crypto.randomUUID
        ? crypto.randomUUID()
        : `media_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      await env.DB
        .prepare(`
          INSERT INTO user_media (
            id,
            user_id,
            created_at,
            updated_at,
            media_type,
            source,
            title,
            prompt_question,
            card_name,
            position_label,
            style_id,
            format_id,
            mime_type,
            storage_provider,
            storage_key,
            bytes,
            metadata_json
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'r2', ?, ?, ?)
        `)
        .bind(
          recordId,
          user.id,
          now,
          now,
          mediaType,
          source,
          title,
          promptQuestion,
          cardName,
          positionLabel,
          styleId,
          formatId,
          mimeType,
          storageKey,
          bytes,
          metadataJson
        )
        .run();
    }

    const saved = await fetchMediaRecordById(env, user.id, recordId);
    if (!saved) {
      return jsonResponse({ error: 'Media saved but could not be loaded' }, 500);
    }

    return jsonResponse({
      success: true,
      media: toClientRecord(saved)
    }, existing?.id ? 200 : 201);
  } catch (err) {
    if (isMissingMediaTableError(err)) {
      return jsonResponse({ error: 'Media storage is not available yet. Run migrations first.' }, 503);
    }
    console.error('[media] save failed:', err);
    return jsonResponse({ error: 'Failed to save media' }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const access = await requireMediaAccess(request, env);
  if (access.response) return access.response;
  const { user } = access;

  const url = new URL(request.url);
  const id = normalizeText(url.searchParams.get('id'), 120);
  if (!id) {
    return jsonResponse({ error: 'id is required' }, 400);
  }

  try {
    const existing = await fetchMediaRecordById(env, user.id, id);
    if (!existing) {
      return jsonResponse({ error: 'Media not found' }, 404);
    }

    // Delete DB record first — an orphaned R2 blob is harmless, but a DB
    // record pointing to a missing blob creates a visible broken entry.
    await env.DB
      .prepare('DELETE FROM user_media WHERE id = ? AND user_id = ?')
      .bind(id, user.id)
      .run();

    // Clean up R2 blob(s), including legacy keys stored without extension
    if (env.R2_LOGS && existing.storage_key) {
      try {
        await env.R2_LOGS.delete(existing.storage_key);
        if (!existing.storage_key.includes('.')) {
          const ext = extensionFromMimeType(existing.mime_type);
          if (ext) {
            await env.R2_LOGS.delete(`${existing.storage_key}.${ext}`);
          }
        }
      } catch (r2Err) {
        console.error('[media] R2 delete failed (DB record already removed):', r2Err.message);
      }
    }

    return jsonResponse({ success: true, id });
  } catch (err) {
    if (isMissingMediaTableError(err)) {
      return jsonResponse({ error: 'Media storage is not available yet. Run migrations first.' }, 503);
    }
    console.error('[media] delete failed:', err);
    return jsonResponse({ error: 'Failed to delete media' }, 500);
  }
}

export default { onRequestGet, onRequestPost, onRequestDelete };
