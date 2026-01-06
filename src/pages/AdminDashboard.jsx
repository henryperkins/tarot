import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  House,
  SignOut,
  ArrowClockwise,
  ChartLine,
  Rows,
  GitBranch,
  Flask,
  ClipboardText
} from '@phosphor-icons/react';
import { useToast } from '../contexts/ToastContext.jsx';
import AdminAuthGate from '../components/admin/AdminAuthGate.jsx';
import SummaryCards from '../components/admin/SummaryCards.jsx';
import DaysFilter from '../components/admin/DaysFilter.jsx';
import ScoreTrendsChart from '../components/admin/ScoreTrendsChart.jsx';
import AlertsList from '../components/admin/AlertsList.jsx';
import SpreadBreakdown from '../components/admin/SpreadBreakdown.jsx';
import VersionComparison from '../components/admin/VersionComparison.jsx';
import ExperimentResults from '../components/admin/ExperimentResults.jsx';
import HumanReviewPanel from '../components/admin/HumanReviewPanel.jsx';

/**
 * Section wrapper component
 */
function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="rounded-2xl border border-secondary/30 bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-secondary/20 bg-surface-muted/50">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-accent" weight="duotone" />}
          <h2 className="text-sm font-semibold text-main">{title}</h2>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/**
 * AdminDashboard - Quality monitoring dashboard
 */
export default function AdminDashboard() {
  return (
    <AdminAuthGate>
      {({ apiKey, onLogout }) => (
        <DashboardContent apiKey={apiKey} onLogout={onLogout} />
      )}
    </AdminAuthGate>
  );
}

function DashboardContent({ apiKey, onLogout }) {
  const { publish } = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (signal) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/quality-stats?days=${days}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal
      });

      // Handle expired/invalid API key
      if (response.status === 401) {
        publish({
          title: 'Session expired',
          description: 'Please sign in again.',
          type: 'error'
        });
        onLogout();
        return;
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      setData(result);
    } catch (err) {
      // Ignore abort errors from cleanup
      if (err.name === 'AbortError') return;

      setError(err.message || 'Failed to load dashboard');
      publish({
        title: 'Failed to load data',
        description: err.message,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  }, [apiKey, days, publish, onLogout]);

  // Fetch data on mount and when days changes
  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleAlertAcknowledged = useCallback((alertId) => {
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        alerts: prev.alerts.filter(a => a.id !== alertId)
      };
    });
  }, []);

  const handleDaysChange = useCallback((newDays) => {
    setDays(newDays);
  }, []);

  return (
    <div className="min-h-screen bg-main text-main">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-secondary/20 bg-main/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-muted hover:text-main transition-colors"
            >
              <House className="h-5 w-5" />
              <span className="text-sm hidden sm:inline">Back to App</span>
            </Link>
            <div className="h-4 w-px bg-secondary/30" />
            <h1 className="font-serif text-lg sm:text-xl text-main">
              Quality Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <DaysFilter
              value={days}
              onChange={handleDaysChange}
              disabled={loading}
            />
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 rounded-lg text-muted hover:text-main hover:bg-secondary/20 transition-colors disabled:opacity-50"
              aria-label="Refresh data"
            >
              <ArrowClockwise className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors"
              aria-label="Sign out"
            >
              <SignOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {/* Error state */}
        {error && !loading && (
          <div className="rounded-2xl border border-error/30 bg-error/10 p-6 text-center">
            <p className="text-error font-medium">{error}</p>
            <button
              onClick={fetchData}
              className="mt-3 text-sm text-accent hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-6">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 rounded-2xl bg-secondary/20 animate-pulse" />
              ))}
            </div>
            <div className="h-64 rounded-2xl bg-secondary/20 animate-pulse" />
            <div className="h-48 rounded-2xl bg-secondary/20 animate-pulse" />
          </div>
        )}

        {/* Dashboard content */}
        {data && (
          <>
            {/* Summary cards */}
            <SummaryCards
              summary={data.summary}
              alertCount={data.alerts?.length || 0}
            />

            {/* Score trends */}
            <Section
              title="Quality Score Trends"
              icon={ChartLine}
            >
              <ScoreTrendsChart stats={data.stats} height={280} />
            </Section>

            {/* Two-column layout for charts */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Spread breakdown */}
              <Section title="By Spread Type" icon={Rows}>
                <SpreadBreakdown stats={data.stats} height={220} />
              </Section>

              {/* Version comparison */}
              <Section title="By Prompt Version" icon={GitBranch}>
                <VersionComparison stats={data.stats} />
              </Section>
            </div>

            {/* Alerts */}
            <AlertsList
              alerts={data.alerts || []}
              apiKey={apiKey}
              onAlertAcknowledged={handleAlertAcknowledged}
              showToast={publish}
              onLogout={onLogout}
            />

            <Section title="Human Review Assistant" icon={ClipboardText}>
              <HumanReviewPanel reviewQueue={data.reviewQueue} />
            </Section>

            {/* Experiments */}
            {data.experiments && data.experiments.length > 0 && (
              <Section title="A/B Experiments" icon={Flask}>
                <ExperimentResults
                  experiments={data.experiments}
                  apiKey={apiKey}
                  onLogout={onLogout}
                  showToast={publish}
                />
              </Section>
            )}

            {/* Footer info */}
            <div className="text-center text-xs text-muted py-4">
              Showing data from the last {days} days
              {data.summary?.periodsCovered && (
                <span> &middot; {data.summary.periodsCovered} periods covered</span>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
