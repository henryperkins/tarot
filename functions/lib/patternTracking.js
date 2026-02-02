function buildFailureId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `pattern-failure-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function recordPatternTrackingFailure(db, userId, entryId, error) {
  if (!db || !userId) return;
  const message = error?.message || String(error || 'Unknown error');
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.prepare(`
      INSERT INTO pattern_tracking_failures (id, user_id, entry_id, error_message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(buildFailureId(), userId, entryId || null, message.slice(0, 500), now).run();
  } catch (err) {
    console.warn('Failed to record pattern tracking failure:', err?.message || err);
  }
}

export async function trackPatterns(db, userId, entryId, themes) {
  const patterns = themes?.knowledgeGraph?.graphKeys;
  if (!patterns) return null;

  const now = Math.floor(Date.now() / 1000);
  const yearMonth = new Date().toISOString().slice(0, 7);

  const stmts = [];

  try {
    // Track triads
    if (Array.isArray(patterns.completeTriadIds)) {
      for (const triadId of patterns.completeTriadIds) {
        stmts.push(db.prepare(`
          INSERT INTO pattern_occurrences (user_id, pattern_type, pattern_id, entry_id, year_month, created_at)
          VALUES (?, 'triad', ?, ?, ?, ?)
        `).bind(userId, triadId, entryId, yearMonth, now));
      }
    }

    // Track high-significance dyads
    if (Array.isArray(patterns.dyadPairs)) {
      for (const dyad of patterns.dyadPairs) {
        if (dyad.significance === 'high' && Array.isArray(dyad.cards)) {
          // Create a consistent ID for the dyad (sorted card IDs/names)
          const dyadId = [...dyad.cards].sort().join('-');

          stmts.push(db.prepare(`
            INSERT INTO pattern_occurrences (user_id, pattern_type, pattern_id, entry_id, year_month, created_at)
            VALUES (?, 'dyad', ?, ?, ?, ?)
          `).bind(userId, dyadId, entryId, yearMonth, now));
        }
      }
    }
  } catch (error) {
    console.error('Failed to build pattern tracking statements:', error);
    await recordPatternTrackingFailure(db, userId, entryId, error);
    return { tracked: 0, error: error?.message || String(error) };
  }

  if (stmts.length > 0) {
    try {
      await db.batch(stmts);
      return { tracked: stmts.length, error: null };
    } catch (error) {
      console.error('Failed to track patterns:', error);
      await recordPatternTrackingFailure(db, userId, entryId, error);
      return { tracked: 0, error: error?.message || String(error) };
    }
  }

  return { tracked: 0, error: null };
}
