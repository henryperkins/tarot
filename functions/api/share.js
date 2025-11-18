import { validateSession, getSessionFromCookie } from '../lib/auth.js';
import { loadEntriesForUser, loadRecentEntries, buildShareMeta } from '../lib/shareUtils.js';

function buildShareResponseRow(row) {
  const meta = row.meta_json ? safeJson(row.meta_json, {}) : {};
  return {
    token: row.token,
    scope: row.scope,
    title: row.title || (row.scope === 'entry' ? 'Shared reading' : 'Journal snapshot'),
    createdAt: row.created_at * 1000,
    expiresAt: row.expires_at ? row.expires_at * 1000 : null,
    viewCount: row.view_count || 0,
    entryCount: meta.entryCount ?? row.entry_count ?? 0,
    spreadKeys: Array.isArray(meta.spreadKeys) ? meta.spreadKeys : [],
    contexts: Array.isArray(meta.contexts) ? meta.contexts : [],
    lastEntryTs: typeof meta.lastEntryTs === 'number' ? meta.lastEntryTs : null
  };
}

function safeJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await env.DB.prepare(`
      SELECT st.token, st.scope, st.title, st.created_at, st.expires_at, st.view_count, st.meta_json,
             (SELECT COUNT(*) FROM share_token_entries ste WHERE ste.token = st.token) AS entry_count
      FROM share_tokens st
      WHERE st.user_id = ?
      ORDER BY st.created_at DESC
      LIMIT 50
    `).bind(user.id).all();

    const shares = result.results.map(buildShareResponseRow);

    return new Response(JSON.stringify({ shares }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('GET /api/share error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

function normalizeEntryIds(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json().catch(() => ({}));
    const scope = body.scope === 'entry' ? 'entry' : 'journal';
    const entryIds = normalizeEntryIds(body.entryIds);
    const limit = Number(body.limit) > 0 ? Math.min(Number(body.limit), 10) : 5;
    const expiresInHours = Number(body.expiresInHours) > 0 ? Math.min(Number(body.expiresInHours), 24 * 30) : null;

    let entries = [];
    if (scope === 'entry') {
      if (entryIds.length !== 1) {
        return new Response(JSON.stringify({ error: 'entry share requires exactly one entryId' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      entries = await loadEntriesForUser(env, user.id, entryIds);
    } else if (entryIds.length > 0) {
      entries = await loadEntriesForUser(env, user.id, entryIds);
    } else {
      entries = await loadRecentEntries(env, user.id, limit);
    }

    if (!entries.length) {
      return new Response(JSON.stringify({ error: 'No entries available to share' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const shareToken = crypto.randomUUID().replace(/-/g, '');
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = expiresInHours ? now + expiresInHours * 3600 : null;
    const title = (body.title && typeof body.title === 'string') ? body.title.trim().slice(0, 80) : null;
    const meta = buildShareMeta(entries);

    await env.DB.prepare(`
      INSERT INTO share_tokens (token, user_id, scope, title, created_at, expires_at, view_count, meta_json)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).bind(
      shareToken,
      user.id,
      scope,
      title,
      now,
      expiresAt,
      JSON.stringify(meta)
    ).run();

    const insertStmt = env.DB.prepare(
      'INSERT INTO share_token_entries (token, entry_id, sort_index) VALUES (?, ?, ?)'
    );

    for (let index = 0; index < entries.length; index += 1) {
      await insertStmt.bind(shareToken, entries[index].id, index).run();
    }

    return new Response(
      JSON.stringify({
        token: shareToken,
        scope,
        url: `/share/${shareToken}`,
        entryCount: entries.length
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('POST /api/share error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
