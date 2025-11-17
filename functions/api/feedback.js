import { jsonResponse, readJsonBody } from '../lib/utils.js';

function sanitizeRatings(ratings = {}) {
  if (typeof ratings !== 'object' || ratings === null) return null;
  const entries = ['overallAccuracy', 'narrativeCoherence', 'practicalValue'];
  const sanitized = {};
  let hasValue = false;
  entries.forEach((key) => {
    const value = Number(ratings[key]);
    if (!Number.isFinite(value)) {
      sanitized[key] = null;
      return;
    }
    const clamped = Math.min(5, Math.max(1, value));
    sanitized[key] = clamped;
    if (clamped) hasValue = true;
  });
  return hasValue ? sanitized : null;
}

export async function onRequestPost({ request, env }) {
  try {
    const payload = await readJsonBody(request);
    const ratings = sanitizeRatings(payload?.ratings);
    if (!ratings) {
      return jsonResponse({ error: 'Missing or invalid ratings.' }, { status: 400 });
    }

    const record = {
      id: payload?.feedbackId || (crypto.randomUUID ? crypto.randomUUID() : `fb_${Date.now()}`),
      requestId: payload?.requestId || null,
      spreadKey: payload?.spreadKey || null,
      spreadName: payload?.spreadName || null,
      deckStyle: payload?.deckStyle || null,
      provider: payload?.provider || null,
      userQuestion: payload?.userQuestion || null,
      ratings,
      notes: payload?.notes ? String(payload.notes).slice(0, 1000) : null,
      visionSummary: payload?.visionSummary || null,
      cards: Array.isArray(payload?.cards) ? payload.cards.slice(0, 15) : null,
      submittedAt: new Date().toISOString()
    };

    if (env?.FEEDBACK_KV) {
      const key = `feedback:${record.id}`;
      await env.FEEDBACK_KV.put(key, JSON.stringify(record), {
        metadata: {
          requestId: record.requestId,
          spreadKey: record.spreadKey,
          submittedAt: record.submittedAt
        }
      });
    } else {
      console.warn('FEEDBACK_KV is not configured; feedback will not be persisted.');
    }

    return jsonResponse({ success: true });
  } catch (error) {
    console.error('feedback function failed:', error);
    return jsonResponse({ error: 'Unable to record feedback.' }, { status: 500 });
  }
}

export async function onRequestGet() {
  return jsonResponse({ error: 'Listing feedback is not supported via public API.' }, { status: 405 });
}
