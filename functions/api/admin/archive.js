/**
 * Manual archival trigger.
 *
 * POST /api/admin/archive
 * Requires `Authorization: Bearer ${ADMIN_API_KEY}`.
 *
 * Delegates to the shared scheduled task handler to archive KV → D1,
 * clean up sessions/webhook events, and optionally run quality analysis.
 */
import { onRequestPost as handleArchivePost } from '../../lib/scheduled.js';

export async function onRequestPost(context) {
  return handleArchivePost(context);
}
