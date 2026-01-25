/**
 * Email Service Module
 *
 * Sends emails via Resend API for quality alerts and notifications.
 * Resend is Workers-compatible and has a simple REST API.
 *
 * Setup:
 * 1. Create account at resend.com
 * 2. Add domain and verify DNS
 * 3. Create API key
 * 4. wrangler secret put RESEND_API_KEY
 */

const RESEND_API_URL = 'https://api.resend.com/emails';

/**
 * Send an email via Resend API.
 *
 * @param {Object} env - Worker environment
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text body (optional)
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function sendEmail(env, options) {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] RESEND_API_KEY not configured');
    return { success: false, error: 'api_key_missing' };
  }

  const from = env.ALERT_EMAIL_FROM || 'alerts@tarot.app';
  const to = options.to || env.ALERT_EMAIL_TO;

  if (!to) {
    console.warn('[email] No recipient configured');
    return { success: false, error: 'no_recipient' };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject: options.subject,
        html: options.html,
        text: options.text || stripHtml(options.html),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[email] Resend API error: ${response.status} ${errorText}`);
      return {
        success: false,
        error: `api_error_${response.status}`,
        details: errorText,
      };
    }

    const result = await response.json();
    console.log(`[email] Sent successfully: ${result.id}`);

    return {
      success: true,
      id: result.id,
    };
  } catch (err) {
    console.error(`[email] Failed to send: ${err.message}`);
    return {
      success: false,
      error: err.message,
    };
  }
}

/**
 * Simple HTML to plain text conversion.
 */
function stripHtml(html) {
  let result = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li>/gi, '• ');
  // Loop to fully remove nested/malformed HTML tags
  let prev;
  do {
    prev = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== prev);
  return result
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * Format a quality alert as an HTML email.
 *
 * @param {Object} alert - Alert object
 * @param {Object} options - Formatting options
 * @returns {Object} { subject, html }
 */
export function formatAlertEmail(alert, options = {}) {
  const severity = alert.severity === 'critical' ? '🚨 CRITICAL' : '⚠️ Warning';
  const typeLabel = formatAlertType(alert.type);
  const dateStr = options.dateStr || new Date().toISOString().split('T')[0];

  const subject = `${severity}: ${typeLabel} - Tarot Quality Alert`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${alert.severity === 'critical' ? '#dc2626' : '#f59e0b'}; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 18px; }
    .content { background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; padding: 20px; border-radius: 0 0 8px 8px; }
    .metric { background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin: 12px 0; }
    .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; }
    .metric-value { font-size: 24px; font-weight: 600; color: ${alert.severity === 'critical' ? '#dc2626' : '#f59e0b'}; }
    .metric-baseline { font-size: 14px; color: #6b7280; }
    .dimensions { margin-top: 16px; }
    .dimension { display: inline-block; background: #e5e7eb; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin: 2px; }
    .footer { margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${severity}: ${typeLabel}</h1>
    </div>
    <div class="content">
      <p>A quality regression was detected in tarot reading evaluations for <strong>${dateStr}</strong>.</p>

      <div class="metric">
        <div class="metric-label">${formatMetricName(alert.metric)}</div>
        <div class="metric-value">${formatMetricValue(alert.metric, alert.observed)}</div>
        <div class="metric-baseline">
          Baseline: ${formatMetricValue(alert.metric, alert.baseline)}
          (Δ ${formatDelta(alert.metric, alert.delta)})
        </div>
      </div>

      <div class="dimensions">
        <strong>Context:</strong><br>
        ${formatDimensions(alert.dimensions)}
      </div>

      <div class="footer">
        <p>This alert was triggered because the threshold of ${formatMetricValue(alert.metric, Math.abs(alert.threshold))} was exceeded.</p>
        <p>Review the quality dashboard or run calibration analysis to investigate.</p>
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
    regression: 'Quality Score Regression',
    safety_spike: 'Safety Flag Spike',
    tone_spike: 'Low Tone Score Spike',
    coverage_drop: 'Card Coverage Drop',
  };
  return types[type] || type;
}

function formatMetricName(metric) {
  const names = {
    overall: 'Overall Quality Score',
    safety_flag_rate: 'Safety Flag Rate',
    low_tone_rate: 'Low Tone Rate',
    card_coverage: 'Card Coverage',
  };
  return names[metric] || metric;
}

function formatMetricValue(metric, value) {
  if (value === null || value === undefined) return 'N/A';
  if (metric.includes('rate') || metric === 'card_coverage') {
    return `${(value * 100).toFixed(1)}%`;
  }
  return value.toFixed(2);
}

function formatDelta(metric, delta) {
  if (delta === null || delta === undefined) return 'N/A';
  const sign = delta >= 0 ? '+' : '';
  // Format as percentage only for rate metrics and coverage (0-1 scale)
  if (metric && (metric.includes('rate') || metric === 'card_coverage')) {
    return `${sign}${(delta * 100).toFixed(1)}%`;
  }
  // Score metrics (1-5 scale) show as decimal
  return `${sign}${delta.toFixed(2)}`;
}

function formatDimensions(dimensions) {
  if (!dimensions) return 'N/A';

  const parts = [];
  if (dimensions.reading_prompt_version) {
    parts.push(`<span class="dimension">Version: ${dimensions.reading_prompt_version}</span>`);
  }
  if (dimensions.variant_id) {
    parts.push(`<span class="dimension">Variant: ${dimensions.variant_id}</span>`);
  }
  if (dimensions.spread_key) {
    parts.push(`<span class="dimension">Spread: ${dimensions.spread_key}</span>`);
  }
  if (dimensions.provider) {
    parts.push(`<span class="dimension">Provider: ${dimensions.provider}</span>`);
  }
  if (dimensions.reading_count) {
    parts.push(`<span class="dimension">Readings: ${dimensions.reading_count}</span>`);
  }

  return parts.join(' ') || 'All dimensions';
}

/**
 * Send a quality alert email.
 *
 * @param {Object} env - Worker environment
 * @param {Object} alert - Alert object
 * @param {Object} options - Options including dateStr
 */
export async function sendAlertEmail(env, alert, options = {}) {
  const { subject, html } = formatAlertEmail(alert, options);
  return sendEmail(env, { subject, html });
}
