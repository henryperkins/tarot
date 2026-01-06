import { memo, useState, useCallback } from 'react';
import { Bell, CheckCircle } from '@phosphor-icons/react';
import AlertCard from './AlertCard.jsx';

/**
 * AlertsList - Container for alert cards with acknowledge workflow
 *
 * @param {Object} props
 * @param {Array} props.alerts - Array of alert objects
 * @param {string} props.apiKey - Admin API key for acknowledge requests
 * @param {Function} props.onAlertAcknowledged - Callback when alert is acknowledged
 * @param {Function} props.showToast - Toast notification function
 * @param {Function} [props.onLogout] - Callback when session expires (401)
 */
export const AlertsList = memo(function AlertsList({
  alerts = [],
  apiKey,
  onAlertAcknowledged,
  showToast,
  onLogout
}) {
  const [loadingIds, setLoadingIds] = useState(new Set());

  const handleAcknowledge = useCallback(async (alertId, notes) => {
    setLoadingIds(prev => new Set([...prev, alertId]));

    try {
      const response = await fetch('/api/admin/quality-stats', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'acknowledge',
          alertId,
          by: 'admin',
          notes: notes || null
        })
      });

      // Handle expired/invalid API key
      if (response.status === 401) {
        if (showToast) {
          showToast({
            title: 'Session expired',
            description: 'Please sign in again.',
            type: 'error'
          });
        }
        if (onLogout) onLogout();
        return;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to acknowledge alert');
      }

      // Remove from local list
      if (onAlertAcknowledged) {
        onAlertAcknowledged(alertId);
      }

      if (showToast) {
        showToast({
          title: 'Alert acknowledged',
          description: 'The alert has been marked as resolved.',
          type: 'success'
        });
      }
    } catch (err) {
      if (showToast) {
        showToast({
          title: 'Failed to acknowledge',
          description: err.message || 'Please try again.',
          type: 'error'
        });
      }
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }, [apiKey, onAlertAcknowledged, showToast, onLogout]);

  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  if (alerts.length === 0) {
    return (
      <div className="rounded-2xl border border-secondary/30 bg-surface p-6">
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 mb-3">
            <CheckCircle className="h-6 w-6 text-emerald-400" weight="duotone" />
          </div>
          <p className="text-sm font-medium text-main">All clear</p>
          <p className="text-xs text-muted mt-1">No unacknowledged alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-secondary/30 bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-secondary/20 bg-surface-muted/50">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent" weight="duotone" />
          <h2 className="text-sm font-semibold text-main">Alerts</h2>
          <span className="px-2 py-0.5 rounded-full bg-secondary/30 text-xs text-muted">
            {alerts.length}
          </span>
        </div>
        {criticalAlerts.length > 0 && (
          <span className="text-xs text-error font-medium">
            {criticalAlerts.length} critical
          </span>
        )}
      </div>

      {/* Alert cards */}
      <div className="p-4 space-y-3">
        {/* Critical alerts first */}
        {criticalAlerts.map(alert => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={handleAcknowledge}
            isLoading={loadingIds.has(alert.id)}
          />
        ))}

        {/* Then warnings */}
        {warningAlerts.map(alert => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={handleAcknowledge}
            isLoading={loadingIds.has(alert.id)}
          />
        ))}
      </div>
    </div>
  );
});

export default AlertsList;
