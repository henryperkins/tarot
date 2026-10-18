// Rebuild from SQL inside the caller's transaction, never from a JS snapshot
// read before it. Saves, deletes, backfills and legacy tracking all serialize
// through the same authoritative journal rows.
const CARD_COUNTS = `
  WITH cards AS (
    SELECT j.created_at, strftime('%Y-%m', j.created_at, 'unixepoch') AS year_month,
      CASE WHEN c.type = 'object' THEN c.value ELSE '{}' END AS card
    FROM journal_entries j, json_each(
      CASE WHEN json_valid(j.cards_json) THEN
        CASE WHEN json_type(j.cards_json) = 'array' THEN j.cards_json ELSE '[]' END
      ELSE '[]' END
    ) c
    WHERE j.user_id = ?
  )
  SELECT json_extract(card, '$.name') AS card_name,
    MAX(CASE WHEN json_type(card, '$.number') IN ('integer', 'real')
      AND json_extract(card, '$.number') BETWEEN 0 AND 21
      THEN json_extract(card, '$.number') END) AS card_number,
    year_month, COUNT(*) AS count, MIN(created_at) AS first_seen, MAX(created_at) AS last_seen
  FROM cards
  WHERE json_type(card, '$.name') = 'text' AND trim(json_extract(card, '$.name')) != ''
    AND year_month IS NOT NULL
  GROUP BY card_name, year_month
`;

const ENABLED = 'COALESCE((SELECT archetype_journey_enabled FROM user_analytics_prefs WHERE user_id = ?), 1) = 1';
// Counts group by the exact card name. Encode it losslessly so case, spaces,
// underscores and Unicode cannot collapse distinct groups into one badge key.
const STREAK_KEY = "'streak_3x_v2_' || hex(card_name) || '_' || year_month";

export function journeyRebuildStatements(db, userId) {
  return [
    db.prepare('DELETE FROM card_appearances WHERE user_id = ?').bind(userId),
    db.prepare(`INSERT INTO card_appearances
      (user_id, card_name, card_number, year_month, count, first_seen, last_seen)
      SELECT ?, card_name, card_number, year_month, count, first_seen, last_seen
      FROM (${CARD_COUNTS}) WHERE ${ENABLED}`).bind(userId, userId, userId),
    db.prepare("DELETE FROM archetype_badges WHERE user_id = ? AND badge_type = 'streak'").bind(userId),
    db.prepare(`INSERT INTO archetype_badges
      (user_id, badge_type, badge_key, card_name, earned_at, metadata_json)
      SELECT user_id, 'streak', ${STREAK_KEY},
        card_name, last_seen,
        json_object('count', count, 'month', year_month,
          'context', card_name || ' appeared ' || count || ' times in ' || year_month)
      FROM card_appearances WHERE user_id = ? AND count >= 3 AND ${ENABLED}`).bind(userId, userId)
  ];
}

export function journeyRebuildSummary(db, userId) {
  return db.prepare(`SELECT
    (${ENABLED}) AS enabled,
    (SELECT COUNT(*) FROM journal_entries WHERE user_id = ?) AS entriesProcessed,
    COALESCE(SUM(count), 0) AS cardsTracked, COUNT(*) AS uniqueCardMonths,
    COUNT(DISTINCT year_month) AS monthsProcessed,
    (SELECT COUNT(*) FROM archetype_badges WHERE user_id = ? AND badge_type = 'streak') AS badgesAwarded
    FROM card_appearances WHERE user_id = ?`).bind(userId, userId, userId, userId);
}

export async function getJourneyBackfillStatus(db, userId) {
  const fields = 'card_name, card_number, year_month, count, first_seen, last_seen';
  const row = await db.prepare(`WITH expected AS (${CARD_COUNTS}),
    actual AS (SELECT ${fields} FROM card_appearances WHERE user_id = ?),
    missing AS (SELECT ${fields} FROM expected EXCEPT SELECT ${fields} FROM actual),
    extra AS (SELECT ${fields} FROM actual EXCEPT SELECT ${fields} FROM expected),
    expected_badges AS (SELECT ${STREAK_KEY} AS badge_key, card_name, count, year_month FROM expected WHERE count >= 3),
    actual_badges AS (SELECT badge_key, card_name,
      json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.count') AS count,
      json_extract(CASE WHEN json_valid(metadata_json) THEN metadata_json ELSE '{}' END, '$.month') AS year_month
      FROM archetype_badges WHERE user_id = ? AND badge_type = 'streak'),
    missing_badges AS (SELECT * FROM expected_badges EXCEPT SELECT * FROM actual_badges),
    extra_badges AS (SELECT * FROM actual_badges EXCEPT SELECT * FROM expected_badges)
    SELECT EXISTS(SELECT 1 FROM missing) OR EXISTS(SELECT 1 FROM extra)
      OR EXISTS(SELECT 1 FROM missing_badges) OR EXISTS(SELECT 1 FROM extra_badges) AS needsBackfill
  `).bind(userId, userId, userId).first();
  return Boolean(row?.needsBackfill);
}
