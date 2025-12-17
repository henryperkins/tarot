/**
 * Journal Summary API Endpoint
 *
 * POST /api/journal-summary
 *
 * Authenticated users can request a high-level summary of their tarot journal.
 * When Azure OpenAI is configured, this uses the Responses API for rich,
 * narrative summaries and falls back to the shared heuristic summary helper
 * otherwise.
 */

import { getSessionFromCookie, validateSession } from '../lib/auth.js';
import { jsonResponse, readJsonBody } from '../lib/utils.js';
import { buildTierLimitedPayload, isEntitled } from '../lib/entitlements.js';
import { computeJournalStats } from '../../shared/journal/stats.js';
import { buildHeuristicJourneySummary } from '../../shared/journal/summary.js';
import { callAzureResponses } from '../lib/azureResponses.js';

const MAX_SUMMARY_ENTRIES = 10;

function normalizeLimit(value, fallback) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(MAX_SUMMARY_ENTRIES, Math.max(1, num));
}

function mapRowToEntry(row) {
  let cards = [];
  let themes = null;
  let reflections = {};

  try {
    cards = row.cards_json ? JSON.parse(row.cards_json) : [];
  } catch (error) {
    console.error(`Failed to parse cards_json for entry ${row.id}:`, error.message);
    cards = [];
  }

  try {
    themes = row.themes_json ? JSON.parse(row.themes_json) : null;
  } catch (error) {
    console.error(`Failed to parse themes_json for entry ${row.id}:`, error.message);
    themes = null;
  }

  try {
    reflections = row.reflections_json ? JSON.parse(row.reflections_json) : {};
  } catch (error) {
    console.error(`Failed to parse reflections_json for entry ${row.id}:`, error.message);
    reflections = {};
  }

  return {
    id: row.id,
    ts: row.created_at * 1000,
    spread: row.spread_name,
    spreadKey: row.spread_key,
    question: row.question,
    cards,
    personalReading: row.narrative,
    themes,
    reflections,
    context: row.context
  };
}

function buildEntrySummaryLines(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return '';

  return entries
    .map((entry) => {
      const when = entry?.ts ? new Date(entry.ts).toLocaleDateString() : 'recently';
      const context = entry?.context || 'general';
      const spread = entry?.spread || 'Reading';
      const cards = Array.isArray(entry?.cards)
        ? entry.cards.slice(0, 4).map((card) => {
            const orientation = (card?.orientation || '').toLowerCase();
            return `${card?.name || 'Unknown'}${orientation ? ` (${orientation})` : ''}`;
          }).join(', ')
        : '';
      const question = (entry?.question || '').trim();

      const parts = [];
      parts.push(`• ${spread} on ${when} (${context} lens)`);
      if (question) {
        parts.push(`  - Question: ${question}`);
      }
      if (cards) {
        parts.push(`  - Cards: ${cards}`);
      }
      return parts.join('\n');
    })
    .join('\n');
}

async function generateLLMSummary(env, entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('No entries to summarize');
  }

  const stats = computeJournalStats(entries);
  const lines = [];

  if (stats) {
    lines.push(
      `You are an introspective tarot journaling companion. Summarize the patterns, lessons, and next steps across this person's recent tarot readings.`,
      '',
      `Entries: ${stats.totalReadings}`,
      `Cards logged: ${stats.totalCards}`,
      `Reversal rate: ${stats.reversalRate}%`,
      ''
    );

    if (Array.isArray(stats.contextBreakdown) && stats.contextBreakdown.length > 0) {
      const topContexts = stats.contextBreakdown
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map((ctx) => `${ctx.name} (${ctx.count})`)
        .join(', ');
      lines.push(`Top contexts: ${topContexts}`);
    }

    if (Array.isArray(stats.frequentCards) && stats.frequentCards.length > 0) {
      const recurring = stats.frequentCards
        .map((card) => `${card.name}${card.reversed ? ` · ${card.reversed} rev` : ''}`)
        .join(', ');
      lines.push(`Recurring cards: ${recurring}`);
    }

    if (Array.isArray(stats.recentThemes) && stats.recentThemes.length > 0) {
      lines.push(`Recent themes: ${stats.recentThemes.join(', ')}`);
    }

    lines.push('');
  }

  lines.push(
    'Here is a compact log of recent entries. Use this as raw material, but respond with a coherent, human-friendly summary instead of bullet points:'
  );
  lines.push('');
  lines.push(buildEntrySummaryLines(entries));

  const input = lines.join('\n');

  const summary = await callAzureResponses(env, {
    instructions:
      'Write a gentle, encouraging journal summary for this tarot reader. Highlight the arc of their journey, energies asking for focus, and 2-3 grounded next steps. Keep it under 400 words. Use clear section headings like "Arc of the Journey", "Energies Calling for Focus", and "Gentle Next Steps".',
    input,
    maxTokens: 900,
    reasoningEffort: 'medium',
    verbosity: 'medium'
  });

  return summary;
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const cookieHeader = request.headers.get('Cookie');
    const token = getSessionFromCookie(cookieHeader);
    const user = await validateSession(env.DB, token);

    if (!user) {
      return jsonResponse(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    if (!isEntitled(user, 'plus')) {
      return jsonResponse(
        buildTierLimitedPayload({
          message: 'Cloud journal summaries require an active Plus or Pro subscription',
          user,
          requiredTier: 'plus'
        }),
        { status: 403 }
      );
    }

    const body = await readJsonBody(request);
    const entryIds = Array.isArray(body.entryIds)
      ? body.entryIds.filter((id) => typeof id === 'string' && id.trim().length > 0).slice(0, MAX_SUMMARY_ENTRIES)
      : [];

    const limit = normalizeLimit(
      body.limit,
      entryIds.length > 0 ? Math.min(entryIds.length, MAX_SUMMARY_ENTRIES) : MAX_SUMMARY_ENTRIES
    );

    // Build query: either by explicit entry IDs or just most recent entries for the user
    let sql = `
      SELECT
        id,
        created_at,
        spread_key,
        spread_name,
        question,
        cards_json,
        narrative,
        themes_json,
        reflections_json,
        context
      FROM journal_entries
      WHERE user_id = ?
    `;

    const params = [user.id];

    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(', ');
      sql += ` AND id IN (${placeholders})`;
      params.push(...entryIds);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const result = await env.DB.prepare(sql).bind(...params).all();
    const rows = Array.isArray(result.results) ? result.results : [];

    if (rows.length === 0) {
      return jsonResponse(
        { error: 'No journal entries available to summarize' },
        { status: 400 }
      );
    }

    const entries = rows.map(mapRowToEntry);
    const stats = computeJournalStats(entries);

    let summary = '';
    let provider = 'heuristic';

    try {
      summary = await generateLLMSummary(env, entries);
      provider = 'azure-responses';
    } catch (error) {
      console.warn('LLM journal summary failed, falling back to heuristic summary:', error?.message || error);
    }

    if (!summary) {
      summary = buildHeuristicJourneySummary(entries, stats);
      provider = 'heuristic';
    }

    return jsonResponse({
      summary,
      meta: {
        provider,
        totalEntries: entries.length,
        model: env.AZURE_OPENAI_GPT5_MODEL || null
      }
    });
  } catch (error) {
    console.error('Journal summary error:', error);
    return jsonResponse(
      { error: 'Unable to generate summary' },
      { status: 500 }
    );
  }
}
