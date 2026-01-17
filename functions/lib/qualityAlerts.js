/**
 * Quality Alerts Module
 *
 * Orchestrates multi-channel alert dispatch for quality regressions.
 * Channels:
 * - Console logging (always)
 * - D1 storage (for dashboard polling)
 * - Email (via Resend API)
 */

import { sendAlertEmail } from './emailService.js';

/**
 * Dispatch a single alert across all configured channels.
 *
 * @param {Object} env - Worker environment
 * @param {Object} alert - Alert object from quality analysis
 * @param {Object} options - Dispatch options
 * @returns {Promise<Object>} Results from each channel
 */
export async function dispatchAlert(env, alert, options = {}) {
  const results = {
    console: null,
    kv: null,
    email: null,
  };

  const dateStr = options.dateStr || new Date().toISOString().split('T')[0];
  const skipEmail = options.skipEmail === true;

  // 1. Console logging (always)
  const level = alert.severity === 'critical' ? 'error' : 'warn';
  const message = formatConsoleMessage(alert);
  console[level](`[QUALITY ALERT] ${message}`);
  results.console = 'logged';

  // 2. D1 storage for dashboard polling
  if (env.DB?.prepare) {
    if (alert.id) {
      results.kv = 'existing';
    } else {
      try {
        const insertResult = await env.DB.prepare(`
          INSERT INTO quality_alerts (
            alert_type, severity, period_key, reading_prompt_version,
            eval_prompt_version, variant_id, spread_key, provider,
            metric_name, observed_value, threshold_value, baseline_value,
            delta, reading_count, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).bind(
          alert.type,
          alert.severity || null,
          dateStr,
          alert.dimensions?.reading_prompt_version || null,
          alert.dimensions?.eval_prompt_version || null,
          alert.dimensions?.variant_id || null,
          alert.dimensions?.spread_key || null,
          alert.dimensions?.provider || null,
          alert.metric || null,
          alert.observed ?? null,
          alert.threshold ?? null,
          alert.baseline ?? null,
          alert.delta ?? null,
          alert.dimensions?.reading_count || null
        ).run();
        // Attach the inserted ID to the alert for email status updates
        alert.id = insertResult.meta?.last_row_id;
        results.kv = 'inserted';
      } catch (err) {
        console.error(`[alert] D1 storage failed: ${err.message}`);
        results.kv = `error: ${err.message}`;
      }
    }
  } else {
    results.kv = 'skipped: no db';
  }

  // 3. Email via Resend
  if (skipEmail) {
    results.email = 'skipped: grouped';
  } else if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO) {
    try {
      const emailResult = await sendAlertEmail(env, alert, { dateStr });
      results.email = emailResult.success ? 'sent' : `error: ${emailResult.error}`;

      // Update alert in DB with email status
      if (env.DB && alert.id) {
        try {
          await env.DB.prepare(`
            UPDATE quality_alerts
            SET email_sent_at = CURRENT_TIMESTAMP,
                email_status = ?
            WHERE id = ?
          `).bind(
            emailResult.success ? 'success' : 'failed',
            alert.id
          ).run();
        } catch (dbErr) {
          console.warn(`[alert] Failed to update email status in DB: ${dbErr.message}`);
        }
      }
    } catch (err) {
      console.error(`[alert] Email dispatch failed: ${err.message}`);
      results.email = `error: ${err.message}`;
    }
  } else {
    results.email = 'skipped: not configured';
  }

  return results;
}

/**
 * Dispatch multiple alerts.
 *
 * @param {Object} env - Worker environment
 * @param {Array} alerts - Array of alert objects
 * @param {Object} options - Dispatch options
 * @returns {Promise<Object>} Summary of dispatch results
 */
export async function dispatchAlerts(env, alerts, options = {}) {
  if (!alerts || alerts.length === 0) {
    return { sent: 0, failed: 0, skipped: 0, results: [] };
  }

  const results = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Group alerts to avoid sending too many emails
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const warningAlerts = alerts.filter((a) => a.severity === 'warning');

  // For critical alerts, send individual emails
  for (const alert of criticalAlerts) {
    const result = await dispatchAlert(env, alert, options);
    results.push({ alert, result });

    if (result.email === 'sent') {
      sent++;
    } else if (result.email?.startsWith('error')) {
      failed++;
    } else {
      skipped++;
    }
  }

  // For warning alerts, group by reading dimensions and combine per-reading
  if (warningAlerts.length > 0) {
    const warningGroups = groupAlertsByReading(warningAlerts);

    for (const group of warningGroups) {
      if (group.alerts.length === 1) {
        const result = await dispatchAlert(env, group.alerts[0], options);
        results.push({ alert: group.alerts[0], result });

        if (result.email === 'sent') {
          sent++;
        } else if (result.email?.startsWith('error')) {
          failed++;
        } else {
          skipped++;
        }
        continue;
      }

      const summaryResult = await dispatchAlertSummary(env, group.alerts, options);
      results.push({ type: 'summary', count: group.alerts.length, key: group.key, result: summaryResult });

      if (summaryResult.email === 'sent') {
        sent++;
      } else if (summaryResult.email?.startsWith('error')) {
        failed++;
      } else {
        skipped++;
      }

      // Still log each individually to console and KV without sending emails
      for (const alert of group.alerts) {
        const logResult = await dispatchAlert(env, alert, { ...options, skipEmail: true });
        results.push({ alert, result: logResult });
      }
    }
  }

  return { sent, failed, skipped, results };
}

/**
 * Dispatch a summary email for multiple alerts.
 */
async function dispatchAlertSummary(env, alerts, options = {}) {
  const results = {
    console: 'logged',
    kv: 'skipped',
    email: null,
  };

  const dateStr = options.dateStr || new Date().toISOString().split('T')[0];

  console.warn(`[QUALITY ALERT] Summary: ${alerts.length} warnings detected for ${dateStr}`);

  if (env.RESEND_API_KEY && env.ALERT_EMAIL_TO) {
    try {
      const { subject, html } = formatSummaryEmail(alerts, { dateStr });
      const { sendEmail } = await import('./emailService.js');
      const emailResult = await sendEmail(env, { subject, html });
      results.email = emailResult.success ? 'sent' : `error: ${emailResult.error}`;
      await updateAlertEmailStatus(env, alerts, emailResult.success);
    } catch (err) {
      console.error(`[alert] Summary email failed: ${err.message}`);
      results.email = `error: ${err.message}`;
      await updateAlertEmailStatus(env, alerts, false);
    }
  } else {
    results.email = 'skipped: not configured';
  }

  return results;
}

/**
 * Format console message for an alert.
 */
function formatConsoleMessage(alert) {
  const parts = [
    `[${alert.severity.toUpperCase()}]`,
    alert.type,
    `${alert.metric}=${formatValue(alert.metric, alert.observed)}`,
    `baseline=${formatValue(alert.metric, alert.baseline)}`,
    `delta=${formatDelta(alert.metric, alert.delta)}`,
  ];

  if (alert.dimensions?.reading_prompt_version) {
    parts.push(`version=${alert.dimensions.reading_prompt_version}`);
  }
  if (alert.dimensions?.variant_id) {
    parts.push(`variant=${alert.dimensions.variant_id}`);
  }
  if (alert.dimensions?.spread_key) {
    parts.push(`spread=${alert.dimensions.spread_key}`);
  }

  return parts.join(' ');
}

/**
 * Format summary email for multiple alerts.
 */
function formatSummaryEmail(alerts, options = {}) {
  const dateStr = options.dateStr || new Date().toISOString().split('T')[0];
  const subject = buildGroupedWarningSubject(alerts);

  const alertRows = alerts.map((alert) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatAlertType(alert.type)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${alert.metric}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatValue(alert.metric, alert.observed)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatValue(alert.metric, alert.baseline)}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatDelta(alert.metric, alert.delta)}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 700px; margin: 0 auto; padding: 20px; }
    .header { background: #f59e0b; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th { text-align: left; padding: 8px; background: #e5e7eb; font-size: 12px; text-transform: uppercase; }
    .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Quality Alert Summary</h1>
    </div>
    <div class="content">
      <p><strong>${alerts.length} quality warnings</strong> were detected for <strong>${dateStr}</strong>.</p>
      ${formatGroupedWarningContext(alerts)}

      <table>
        <thead>
          <tr>
            <th>Type</th>
            <th>Metric</th>
            <th>Observed</th>
            <th>Baseline</th>
            <th>Delta</th>
          </tr>
        </thead>
        <tbody>
          ${alertRows}
        </tbody>
      </table>

      <div class="footer">
        <p>Review the quality dashboard or run calibration analysis to investigate these warnings.</p>
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();

  return { subject, html };
}

function formatAlertType(type) {
  const types = {
    regression: 'Score Drop',
    safety_spike: 'Safety Spike',
    tone_spike: 'Tone Spike',
    coverage_drop: 'Coverage Drop',
  };
  return types[type] || type;
}

function groupAlertsByReading(alerts) {
  const groups = new Map();

  alerts.forEach((alert) => {
    const key = buildWarningGroupKey(alert);
    const entry = groups.get(key);
    if (entry) {
      entry.alerts.push(alert);
    } else {
      groups.set(key, { key, alerts: [alert] });
    }
  });

  return Array.from(groups.values());
}

function buildWarningGroupKey(alert) {
  const dims = alert?.dimensions || {};
  return [
    dims.reading_prompt_version || 'null',
    dims.variant_id || 'null',
    dims.spread_key || 'all',
    dims.provider || 'all',
  ].join(':');
}

function buildGroupedWarningSubject(alerts) {
  const base = `⚠️ ${alerts.length} Quality Warnings`;
  const context = buildContextLabel(alerts);
  return context ? `${base} - ${context}` : `${base} - Tarot Alert Summary`;
}

function buildContextLabel(alerts) {
  if (!alerts || alerts.length === 0) return '';
  const dims = alerts[0]?.dimensions || {};
  const parts = [];
  if (dims.spread_key) parts.push(`Spread ${dims.spread_key}`);
  if (dims.provider) parts.push(`Provider ${dims.provider}`);
  if (dims.reading_prompt_version) parts.push(`v${dims.reading_prompt_version}`);
  if (dims.variant_id) parts.push(`Variant ${dims.variant_id}`);
  return parts.join(' • ');
}

function formatGroupedWarningContext(alerts) {
  const label = buildContextLabel(alerts);
  if (!label) return '';
  return `<p><strong>Context:</strong> ${label}</p>`;
}

async function updateAlertEmailStatus(env, alerts, sent) {
  if (!env?.DB) return;
  const ids = alerts
    .map((alert) => alert?.id)
    .filter((id) => typeof id === 'number' && Number.isFinite(id));

  if (ids.length === 0) return;

  try {
    const status = sent ? 'success' : 'failed';
    for (const id of ids) {
      if (sent) {
        await env.DB.prepare(`
          UPDATE quality_alerts
          SET email_sent_at = CURRENT_TIMESTAMP,
              email_status = ?
          WHERE id = ?
        `).bind(status, id).run();
      } else {
        await env.DB.prepare(`
          UPDATE quality_alerts
          SET email_status = ?
          WHERE id = ?
        `).bind(status, id).run();
      }
    }
  } catch (err) {
    console.warn(`[alert] Failed to update summary email status: ${err.message}`);
  }
}

function formatValue(metric, value) {
  if (value === null || value === undefined) return 'N/A';
  if (metric.includes('rate') || metric === 'card_coverage') {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(2);
}

function formatDelta(metric, delta) {
  if (delta === null || delta === undefined) return 'N/A';
  const sign = delta >= 0 ? '+' : '';
  if (metric && (metric.includes('rate') || metric === 'card_coverage')) {
    return `${sign}${(delta * 100).toFixed(1)}%`;
  }
  return `${sign}${delta.toFixed(2)}`;
}
