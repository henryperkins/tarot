/**
 * Account Delete Endpoint
 * POST /api/account/delete
 *
 * Deletes the authenticated user's account and related data.
 * 
 * Security: Cancels any active Stripe subscription before deleting user data
 * to prevent continued billing after account deletion.
 * 
 * GDPR Compliance: Also deletes archived data in R2 and D1 archive tables
 * by tracing request_ids through journal_entries.
 */

import { getUserFromRequest, clearSessionCookie, isSecureRequest } from '../../lib/auth.js';
import { jsonResponse, readJsonBody } from '../../lib/utils.js';
import { stripeRequest, fetchLatestStripeSubscription } from '../../lib/stripe.js';

async function runDelete(db, sql, bindings, requestId) {
  try {
    await db.prepare(sql).bind(...bindings).run();
  } catch (error) {
    const message = String(error?.message || '');
    if (message.includes('no such table')) {
      return;
    }
    console.warn(`[${requestId}] [account] Delete failed: ${message}`);
  }
}

/**
 * Collect request_ids from journal_entries for archive cleanup.
 * Archives are keyed by request_id, not user_id.
 */
async function collectUserRequestIds(db, userId, requestId) {
  try {
    const result = await db.prepare(`
      SELECT request_id FROM journal_entries 
      WHERE user_id = ? AND request_id IS NOT NULL
    `).bind(userId).all();
    return result?.results?.map(r => r.request_id).filter(Boolean) || [];
  } catch (error) {
    console.warn(`[${requestId}] [account] Failed to collect request_ids:`, error);
    return [];
  }
}

/**
 * Delete archived data from D1 archive tables by request_ids.
 * Archives metrics and feedback are stored with request_id as key.
 */
async function deleteArchivedData(db, requestIds, requestId) {
  if (!requestIds.length) return { metricsDeleted: 0, feedbackDeleted: 0, evalDeleted: 0 };
  
  let metricsDeleted = 0;
  let feedbackDeleted = 0;
  let evalDeleted = 0;

  try {
    // Delete from metrics_archive (request_id is primary key)
    for (const reqId of requestIds) {
      try {
        const result = await db.prepare('DELETE FROM metrics_archive WHERE request_id = ?')
          .bind(reqId).run();
        metricsDeleted += result?.meta?.changes || 0;
      } catch (e) {
        if (!String(e?.message || '').includes('no such table')) {
          console.warn(`[${requestId}] [account] metrics_archive delete failed:`, e);
        }
      }
    }

    // Delete from feedback_archive (request_id is key)
    for (const reqId of requestIds) {
      try {
        const result = await db.prepare('DELETE FROM feedback_archive WHERE request_id = ?')
          .bind(reqId).run();
        feedbackDeleted += result?.meta?.changes || 0;
      } catch (e) {
        if (!String(e?.message || '').includes('no such table')) {
          console.warn(`[${requestId}] [account] feedback_archive delete failed:`, e);
        }
      }
    }

    // Delete from eval_metrics (request_id is key)
    for (const reqId of requestIds) {
      try {
        const result = await db.prepare('DELETE FROM eval_metrics WHERE request_id = ?')
          .bind(reqId).run();
        evalDeleted += result?.meta?.changes || 0;
      } catch (e) {
        if (!String(e?.message || '').includes('no such table')) {
          console.warn(`[${requestId}] [account] eval_metrics delete failed:`, e);
        }
      }
    }
  } catch (error) {
    console.warn(`[${requestId}] [account] Archive deletion error:`, error);
  }

  return { metricsDeleted, feedbackDeleted, evalDeleted };
}

/**
 * Delete R2 exports for user (PDF exports of journal/readings).
 * R2 paths: exports/readings/{user_id}/* and exports/journals/{user_id}/*
 */
async function deleteR2Exports(r2, userId, requestId) {
  if (!r2) return { deleted: 0 };
  
  let deleted = 0;
  const prefixes = [
    `exports/readings/${userId}/`,
    `exports/journals/${userId}/`
  ];

  for (const prefix of prefixes) {
    try {
      // Paginate through all objects with this prefix
      let cursor = undefined;
      let truncated = true;
      
      while (truncated) {
        const listed = await r2.list({ prefix, limit: 1000, cursor });
        
        for (const obj of listed?.objects || []) {
          try {
            await r2.delete(obj.key);
            deleted++;
          } catch (e) {
            console.warn(`[${requestId}] [account] R2 delete failed for ${obj.key}:`, e);
          }
        }
        
        truncated = listed?.truncated || false;
        cursor = listed?.cursor;
      }
    } catch (error) {
      console.warn(`[${requestId}] [account] R2 list failed for prefix ${prefix}:`, error);
    }
  }

  return { deleted };
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const requestId = crypto.randomUUID();

  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return jsonResponse({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.auth_provider === 'api_key') {
      return jsonResponse({ error: 'Session authentication required' }, { status: 401 });
    }

    const body = await readJsonBody(request).catch(() => ({}));
    if (body?.confirm !== true) {
      return jsonResponse({ error: 'Account deletion not confirmed' }, { status: 400 });
    }

    const userId = user.id;

    // Cancel any active Stripe subscription before deleting account
    // This prevents continued billing after account deletion
    let subscriptionCanceled = false;
    if (user.stripe_customer_id && env.STRIPE_SECRET_KEY) {
      try {
        const subscription = await fetchLatestStripeSubscription(
          user.stripe_customer_id,
          env.STRIPE_SECRET_KEY
        );
        
        // Only cancel if subscription is in an active/billable state
        if (subscription && ['active', 'trialing', 'past_due'].includes(subscription.status)) {
          await stripeRequest(
            `/subscriptions/${subscription.id}`,
            'DELETE',
            null,
            env.STRIPE_SECRET_KEY
          );
          subscriptionCanceled = true;
          console.log(`[${requestId}] [account] Canceled Stripe subscription ${subscription.id} for user ${userId}`);
        }
      } catch (stripeError) {
        // Log but don't fail deletion - user explicitly wants to delete account
        // Stripe subscription will naturally lapse or can be cleaned up manually
        console.warn(`[${requestId}] [account] Failed to cancel Stripe subscription for user ${userId}:`, stripeError);
      }
    }

    // Delete user tokens (password reset, email verification)
    await runDelete(env.DB, 'DELETE FROM user_tokens WHERE user_id = ?', [userId], requestId);

    await runDelete(env.DB, 'DELETE FROM journal_followups WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM pattern_tracking_failures WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM pattern_occurrences WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM follow_up_usage WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM usage_tracking WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM user_memories WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM user_analytics_prefs WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM archetype_badges WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM card_appearances WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM api_keys WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM share_note_reports WHERE token IN (SELECT token FROM share_tokens WHERE user_id = ?)', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM share_notes WHERE token IN (SELECT token FROM share_tokens WHERE user_id = ?)', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM share_token_entries WHERE token IN (SELECT token FROM share_tokens WHERE user_id = ?)', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM share_tokens WHERE user_id = ?', [userId], requestId);

    // GDPR: Collect request_ids before deleting journal_entries
    // These are needed to clean up archive tables and R2 exports
    const requestIds = await collectUserRequestIds(env.DB, userId, requestId);
    
    // GDPR: Delete archived data from D1 (keyed by request_id, not user_id)
    const archiveStats = await deleteArchivedData(env.DB, requestIds, requestId);
    if (archiveStats.metricsDeleted || archiveStats.feedbackDeleted || archiveStats.evalDeleted) {
      console.log(`[${requestId}] [account] Deleted archived data for user ${userId}: ` +
        `metrics=${archiveStats.metricsDeleted}, feedback=${archiveStats.feedbackDeleted}, eval=${archiveStats.evalDeleted}`);
    }

    // GDPR: Delete R2 exports (PDFs of journal/readings)
    const r2Stats = await deleteR2Exports(env.R2_LOGS, userId, requestId);
    if (r2Stats.deleted) {
      console.log(`[${requestId}] [account] Deleted ${r2Stats.deleted} R2 exports for user ${userId}`);
    }

    // Now safe to delete journal_entries
    await runDelete(env.DB, 'DELETE FROM journal_entries WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM sessions WHERE user_id = ?', [userId], requestId);
    await runDelete(env.DB, 'DELETE FROM users WHERE id = ?', [userId], requestId);

    const isHttps = isSecureRequest(request);
    return jsonResponse(
      { 
        success: true, 
        subscriptionCanceled,
        archivesDeleted: archiveStats.metricsDeleted + archiveStats.feedbackDeleted + archiveStats.evalDeleted,
        r2ExportsDeleted: r2Stats.deleted
      },
      {
        status: 200,
        headers: {
          'Set-Cookie': clearSessionCookie({ secure: isHttps })
        }
      }
    );
  } catch (error) {
    console.error(`[${requestId}] [account] Delete error:`, error);
    return jsonResponse({ error: 'Failed to delete account' }, { status: 500 });
  }
}
