import { computeJournalStats } from '../../../shared/journal/stats.js';
import { validateSession, getSessionFromCookie } from '../../lib/auth.js';
import { loadShareRecord, loadShareEntries, loadShareNotes } from '../../lib/shareData.js';
import { buildShareMeta, normalizeShareTitle, defaultShareTitle } from '../../lib/shareUtils.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  const token = params.token;

  try {
    const share = await loadShareRecord(env, token);
    if (!share) {
      return new Response(JSON.stringify({ error: 'Share link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (share.expiresAt && share.expiresAt < Math.floor(Date.now() / 1000)) {
      return new Response(JSON.stringify({ error: 'Share link expired' }), {
        status: 410,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const [entries, notes] = await Promise.all([
      loadShareEntries(env, token),
      loadShareNotes(env, token)
    ]);

    const stats = computeJournalStats(entries);
    const derivedMeta = buildShareMeta(entries);
    const mergedMeta = { ...share.meta, ...derivedMeta };
    const nextViewCount = (share.viewCount || 0) + 1;
    const collaboration = {
      noteCount: notes.length,
      lastNoteAt: notes.length ? Math.max(...notes.map((note) => note.createdAt)) : null
    };

    await env.DB.prepare('UPDATE share_tokens SET view_count = view_count + 1 WHERE token = ?')
      .bind(token)
      .run()
      .catch(() => null);

    return new Response(
      JSON.stringify({
        scope: share.scope,
        title: share.title || defaultShareTitle(share.scope),
        createdAt: share.createdAt * 1000,
        expiresAt: share.expiresAt ? share.expiresAt * 1000 : null,
        viewCount: nextViewCount,
        meta: mergedMeta,
        stats,
        entries,
        notes,
        collaboration
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('GET /api/share/:token error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env, params } = context;
  const shareToken = params.token;

  try {
    const cookieHeader = request.headers.get('Cookie');
    const sessionToken = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, sessionToken);

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const share = await loadShareRecord(env, shareToken);
    if (!share) {
      return new Response(JSON.stringify({ error: 'Share link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (share.userId !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized to delete this share' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.DB.prepare('DELETE FROM share_tokens WHERE token = ?')
      .bind(shareToken)
      .run();

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('DELETE /api/share/:token error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * PATCH /api/share/:token - Rename a link the user owns. A blank title restores
 * the default. Only the title changes; the shared readings and expiry stay fixed.
 */
export async function onRequestPatch(context) {
  const { request, env, params } = context;
  const shareToken = params.token;
  const json = (body, status) => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    const sessionToken = getSessionFromCookie(request.headers.get('Cookie'));
    const user = await validateSession(env.DB, sessionToken);
    if (!user) return json({ error: 'Not authenticated' }, 401);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || !Object.hasOwn(body, 'title') || (body.title !== null && typeof body.title !== 'string')) {
      return json({ error: 'title must be a string or null' }, 400);
    }

    const share = await loadShareRecord(env, shareToken);
    if (!share) return json({ error: 'Share link not found' }, 404);
    if (share.userId !== user.id) return json({ error: 'Not authorized to rename this share' }, 403);

    const title = normalizeShareTitle(body.title);
    await env.DB.prepare('UPDATE share_tokens SET title = ? WHERE token = ? AND user_id = ?')
      .bind(title, shareToken, user.id)
      .run();

    return json({
      token: shareToken,
      title: title || defaultShareTitle(share.scope),
      hasCustomTitle: Boolean(title)
    }, 200);
  } catch (error) {
    console.error('PATCH /api/share/:token error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
}
