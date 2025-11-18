import { loadShareRecord, loadShareNotes } from '../../lib/shareData.js';

export async function onRequestGet(context) {
  const { env, params } = context;
  try {
    const share = await loadShareRecord(env, params.token);
    if (!share) {
      return new Response(JSON.stringify({ error: 'Share link not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const notes = await loadShareNotes(env, params.token);
    return new Response(JSON.stringify({ notes }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('GET /api/share-notes/:token error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { env, params, request } = context;
  try {
    const share = await loadShareRecord(env, params.token);
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

    const payload = await request.json().catch(() => ({}));
    const rawBody = typeof payload.body === 'string' ? payload.body : '';
    const bodyText = rawBody.trim();
    if (!bodyText) {
      return new Response(JSON.stringify({ error: 'Note text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (bodyText.length > 600) {
      return new Response(JSON.stringify({ error: 'Note is too long (max 600 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const authorNameInput = typeof payload.authorName === 'string' ? payload.authorName : '';
    const authorName = (authorNameInput.trim() || 'Guest Seeker').slice(0, 40);
    const cardPositionInput = typeof payload.cardPosition === 'string' ? payload.cardPosition : null;
    const cardPosition = cardPositionInput ? cardPositionInput.trim().slice(0, 80) : null;

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare(`
      INSERT INTO share_notes (id, token, author_name, body, card_position, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, params.token, authorName, bodyText, cardPosition, now).run();

    const note = {
      id,
      authorName,
      body: bodyText,
      cardPosition,
      createdAt: now * 1000
    };

    return new Response(JSON.stringify({ note }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('POST /api/share-notes/:token error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
