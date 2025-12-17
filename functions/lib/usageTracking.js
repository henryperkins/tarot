const COUNTER_COLUMNS = {
  readings: 'readings_count',
  tts: 'tts_count',
  apiCalls: 'api_calls_count'
};

export function getMonthKeyUtc(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getResetAtUtc(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString();
}

export async function getUsageRow(db, userId, month) {
  return db
    .prepare(
      'SELECT readings_count, tts_count, api_calls_count FROM usage_tracking WHERE user_id = ? AND month = ?'
    )
    .bind(userId, month)
    .first();
}

export async function incrementUsageCounter(db, { userId, month, counter, limit, nowMs }) {
  const column = COUNTER_COLUMNS[counter];
  if (!column) {
    throw new Error(`Unknown usage counter: ${counter}`);
  }

  if (typeof limit === 'number' && Number.isFinite(limit)) {
    const result = await db.prepare(`
      INSERT INTO usage_tracking (user_id, month, ${column}, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(user_id, month) DO UPDATE SET
        ${column} = ${column} + 1,
        updated_at = excluded.updated_at
      WHERE ${column} < ?
    `).bind(userId, month, nowMs, nowMs, limit).run();

    return { changed: result.meta?.changes || 0 };
  }

  const result = await db.prepare(`
    INSERT INTO usage_tracking (user_id, month, ${column}, created_at, updated_at)
    VALUES (?, ?, 1, ?, ?)
    ON CONFLICT(user_id, month) DO UPDATE SET
      ${column} = ${column} + 1,
      updated_at = excluded.updated_at
  `).bind(userId, month, nowMs, nowMs).run();

  return { changed: result.meta?.changes || 0 };
}

export async function decrementUsageCounter(db, { userId, month, counter, nowMs }) {
  const column = COUNTER_COLUMNS[counter];
  if (!column) {
    throw new Error(`Unknown usage counter: ${counter}`);
  }

  const result = await db.prepare(`
    UPDATE usage_tracking
    SET ${column} = CASE WHEN ${column} > 0 THEN ${column} - 1 ELSE 0 END,
        updated_at = ?
    WHERE user_id = ? AND month = ?
  `).bind(nowMs, userId, month).run();

  return { changed: result.meta?.changes || 0 };
}

