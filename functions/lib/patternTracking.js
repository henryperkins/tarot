export async function trackPatterns(db, userId, entryId, themes) {
  const patterns = themes?.knowledgeGraph?.graphKeys;
  if (!patterns) return;
  
  const now = Math.floor(Date.now() / 1000);
  const yearMonth = new Date().toISOString().slice(0, 7);
  
  const stmts = [];

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
  
  if (stmts.length > 0) {
    try {
      await db.batch(stmts);
    } catch (error) {
      console.error('Failed to track patterns:', error);
    }
  }
}
