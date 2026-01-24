import { useEffect, useState, useCallback, useRef } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import {
  User,
  Crown,
  Sparkle,
  Moon,
  SignOut,
  BookOpen,
  Eye,
  EyeSlash,
  CreditCard,
  ArrowRight,
  CircleNotch,
  Check,
  CaretRight,
  Envelope,
  ShieldCheck,
  SpeakerHigh,
  Waveform,
  ArrowCounterClockwise,
  Palette,
  FileArrowDown,
  DownloadSimple,
  Trash,
  PencilSimple,
  Lock,
  ArrowClockwise
} from '@phosphor-icons/react';
import { ConfirmModal } from '../components/ConfirmModal';
import { GlobalNav } from '../components/GlobalNav';
import AuthModal from '../components/AuthModal';
import { MemoryManager } from '../components/MemoryManager';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription, SUBSCRIPTION_TIERS } from '../contexts/SubscriptionContext';
import { usePreferences } from '../contexts/PreferencesContext';
import { useToast } from '../contexts/ToastContext';
import { useJournal } from '../hooks/useJournal';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { exportJournalInsightsToPdf } from '../lib/pdfExport';
import { computeJournalStats, exportJournalEntriesToCsv } from '../lib/journalInsights';

/**
 * Settings toggle component - matches UserMenu style
 */
function SettingsToggle({ id, label, description, enabled, loading, onChange, error, disabled = false, locked = false }) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined;
  const isDisabled = disabled || loading || enabled === null;
  return (
    <div className="py-4">
      <button
        type="button"
        id={id}
        role="switch"
        onClick={onChange}
        disabled={isDisabled}
        className={`
          w-full flex items-center justify-between gap-4 text-left
          min-h-touch transition-colors touch-manipulation
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
          focus-visible:ring-offset-2 focus-visible:ring-offset-surface
          ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-checked={enabled === true}
        aria-label={`Toggle ${label}`}
        aria-describedby={describedBy}
        aria-busy={loading || undefined}
      >
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm font-semibold text-main">{label}</span>
            {locked && <Lock className="h-3.5 w-3.5 text-muted" weight="duotone" aria-hidden="true" />}
          </span>
          {description && (
            <span id={descriptionId} className="block text-xs text-muted leading-tight mt-0.5">
              {description}
            </span>
          )}
        </span>
        <span
          className={`
            relative inline-flex h-7 w-12 shrink-0 items-center rounded-full
            transition-colors
            ${enabled ? 'bg-primary' : 'bg-secondary/30'}
          `}
          aria-hidden="true"
        >
          <span
            className={`
              inline-block h-5 w-5 transform rounded-full bg-white shadow-sm
              transition-transform duration-200
              ${enabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </span>
      </button>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-error mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Device-only chip indicator
 */
function DeviceOnlyChip() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/20 text-[10px] text-muted font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary/60" aria-hidden="true" />
      Device only
    </span>
  );
}

/**
 * Account section card
 */
function SectionCard({ title, icon: Icon, children, id, highlighted = false, badge = null }) {
  const headingId = title && id ? `${id}-heading` : undefined;
  return (
    <div
      id={id}
      tabIndex={-1}
      aria-labelledby={headingId}
      className={`
        rounded-2xl border border-secondary/30 bg-surface overflow-hidden scroll-mt-24
        ${highlighted ? 'ring-2 ring-accent/30' : ''}
      `}
    >
      {title && (
        <div className="flex items-center gap-2 px-5 py-3 border-b border-secondary/20 bg-surface-muted/50">
          {Icon && <Icon className="h-4 w-4 text-accent" weight="duotone" />}
          <h2
            id={headingId}
            tabIndex={-1}
            data-section-heading="true"
            className="
              text-sm font-semibold text-main rounded-md
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
              focus-visible:ring-offset-2 focus-visible:ring-offset-surface
            "
          >
            {title}
          </h2>
          {badge}
        </div>
      )}
      <div className="px-5 py-4">
        {children}
      </div>
    </div>
  );
}

function LockedSectionCard({ title, icon: Icon, description, onAction, actionLabel = 'Sign in', id, highlighted = false }) {
  return (
    <SectionCard title={title} icon={Icon} id={id} highlighted={highlighted}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 text-sm text-muted">
          <Lock className="h-4 w-4 text-muted" weight="duotone" />
          <p>{description}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center justify-center rounded-full border border-accent/60 bg-accent/10 px-4 py-2 text-xs font-semibold text-main hover:bg-accent/20 transition"
        >
          {actionLabel}
        </button>
      </div>
    </SectionCard>
  );
}

/**
 * AccountPage - User account and subscription management
 */
export default function AccountPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const { user, isAuthenticated, logout, loading: authLoading, checkAuth, resendVerification } = useAuth();
  const { tier, subscription: _subscription, loading: _subLoading } = useSubscription();
  const {
    resetOnboarding,
    // Audio settings
    voiceOn,
    setVoiceOn,
    autoNarrate,
    setAutoNarrate,
    ambienceOn,
    setAmbienceOn,
    ttsProvider,
    setTtsProvider,
    // Theme/experience settings
    theme,
    setTheme,
    includeMinors,
    setIncludeMinors,
    reversalFramework,
    setReversalFramework
  } = usePreferences();
  const { publish } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const {
    entries: journalEntries,
    loading: journalLoading,
    error: journalError,
    hasMoreEntries: hasMoreJournalEntries,
    loadEntries: loadJournalEntries,
    loadMoreEntries: loadMoreJournalEntries
  } = useJournal({ autoLoad: false });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

  // Analytics preferences state (mirrored from UserMenu)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsError, setPrefsError] = useState(null);

  // Profile & password management
  const [profileEditing, setProfileEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', email: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [passwordEditing, setPasswordEditing] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', next: '', confirm: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNextPassword, setShowNextPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verificationSending, setVerificationSending] = useState(false);

  // Subscription details + restore
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [subscriptionDetailsLoading, setSubscriptionDetailsLoading] = useState(false);
  const [subscriptionDetailsError, setSubscriptionDetailsError] = useState(null);
  const [restoreLoading, setRestoreLoading] = useState(false);

  // Billing portal + usage dashboard
  const [portalLoading, setPortalLoading] = useState(false);
  const [portalError, setPortalError] = useState(null);
  const [usageStatus, setUsageStatus] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(null);

  // Export + delete account
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState(null);
  const [exportEntryCount, setExportEntryCount] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [journeyResetOpen, setJourneyResetOpen] = useState(false);
  const [journeyResetLoading, setJourneyResetLoading] = useState(false);
  const [journeyResetError, setJourneyResetError] = useState(null);
  const [tutorialResetOpen, setTutorialResetOpen] = useState(false);
  const [highlightedSection, setHighlightedSection] = useState(null);

  const journalEntriesRef = useRef(journalEntries);
  const hasMoreEntriesRef = useRef(hasMoreJournalEntries);
  const highlightTimeoutRef = useRef(null);

  // Handle upgrade success from Stripe redirect
  useEffect(() => {
    if (searchParams.get('upgrade') === 'success') {
      publish({
        title: 'Welcome to your new plan!',
        description: 'Your subscription is now active. Enjoy your enhanced features.',
        type: 'success'
      });
      // Clean up URL
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, publish]);

  useEffect(() => {
    if (!isAuthenticated) return;
    setProfileForm({
      username: user?.username || '',
      email: user?.email || ''
    });
  }, [isAuthenticated, user?.username, user?.email]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!location.hash) return undefined;
    const id = location.hash.replace('#', '');
    if (!id) return undefined;
    const target = document.getElementById(id);
    if (!target) return undefined;

    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setHighlightedSection(id);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedSection(null);
    }, 1600);

    const raf = requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
      const heading = target.querySelector('[data-section-heading="true"]');
      if (heading && typeof heading.focus === 'function') {
        heading.focus({ preventScroll: true });
      } else if (typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    });

    return () => cancelAnimationFrame(raf);
  }, [location.hash, prefersReducedMotion]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    journalEntriesRef.current = journalEntries;
  }, [journalEntries]);

  useEffect(() => {
    hasMoreEntriesRef.current = hasMoreJournalEntries;
  }, [hasMoreJournalEntries]);

  // No redirect - guests can access settings sections

  const fetchAnalyticsPreference = useCallback(async (force = false) => {
    if (!isAuthenticated || prefsLoading) return;
    if (!force && analyticsEnabled !== null) return;
    setPrefsLoading(true);
    setPrefsError(null);
    try {
      const response = await fetch('/api/archetype-journey/preferences', { credentials: 'include' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 403) {
        setAnalyticsEnabled(false);
      } else if (response.ok) {
        const enabled = data?.preferences?.archetype_journey_enabled;
        setAnalyticsEnabled(enabled === undefined ? null : Boolean(enabled));
      } else {
        setPrefsError('Could not load preference. Retry.');
        setAnalyticsEnabled(null);
      }
    } catch {
      setPrefsError('Could not load preference. Retry.');
      setAnalyticsEnabled(null);
    } finally {
      setPrefsLoading(false);
    }
  }, [isAuthenticated, prefsLoading, analyticsEnabled]);

  useEffect(() => {
    fetchAnalyticsPreference();
  }, [fetchAnalyticsPreference]);

  const handleRetryAnalytics = useCallback(() => {
    fetchAnalyticsPreference(true);
  }, [fetchAnalyticsPreference]);

  // Fetch subscription details (renewal date, provider sync)
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const fetchSubscriptionDetails = async () => {
      setSubscriptionDetailsLoading(true);
      setSubscriptionDetailsError(null);
      try {
        const response = await fetch('/api/subscription', { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) {
          throw new Error(data.error || 'Unable to load subscription details');
        }
        setSubscriptionDetails(data.subscription || null);
      } catch (error) {
        if (!cancelled) {
          setSubscriptionDetailsError(error.message || 'Unable to load subscription details');
        }
      } finally {
        if (!cancelled) setSubscriptionDetailsLoading(false);
      }
    };
    fetchSubscriptionDetails();
    return () => { cancelled = true; };
  }, [isAuthenticated, tier]);

  const fetchUsage = useCallback(async () => {
    if (!isAuthenticated) return;
    setUsageLoading(true);
    setUsageError(null);
    try {
      const response = await fetch('/api/usage', { credentials: 'include' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load usage');
      }

      setUsageStatus(data);
    } catch (error) {
      setUsageError(error.message || 'Unable to load usage');
    } finally {
      setUsageLoading(false);
    }
  }, [isAuthenticated]);

  // Fetch usage status for the dashboard
  useEffect(() => {
    if (!isAuthenticated) return;
    fetchUsage();
  }, [isAuthenticated, tier, fetchUsage]);

  const toggleAnalytics = useCallback(async () => {
    if (analyticsEnabled === null || prefsLoading) return;
    const next = !analyticsEnabled;
    setPrefsLoading(true);
    setPrefsError(null);
    
    // Optimistic update for responsive feel
    setAnalyticsEnabled(next);
    
    try {
      const response = await fetch('/api/archetype-journey/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ archetype_journey_enabled: next })
      });
      if (!response.ok) {
        // Revert on failure
        setAnalyticsEnabled(!next);
        throw new Error('Failed to update preference');
      }
      const data = await response.json().catch(() => ({}));
      setAnalyticsEnabled(data?.preferences?.archetype_journey_enabled ?? next);
      
      publish({
        title: next ? 'Journey tracking enabled' : 'Journey tracking disabled',
        description: next 
          ? 'Your readings will now track recurring patterns.'
          : 'Pattern tracking paused. Your existing data is preserved.',
        type: 'success'
      });
    } catch {
      setPrefsError('Failed to update');
      publish({
        title: 'Update failed',
        description: 'Could not save your preference. Please try again.',
        type: 'error'
      });
    } finally {
      setPrefsLoading(false);
    }
  }, [analyticsEnabled, prefsLoading, publish]);

  const handleProfileSave = useCallback(async () => {
    if (profileSaving) return;
    const nextUsername = profileForm.username.trim();
    const nextEmail = profileForm.email.trim();
    const updates = {};

    if (nextUsername && nextUsername !== user?.username) {
      updates.username = nextUsername;
    }
    if (nextEmail && nextEmail.toLowerCase() !== user?.email) {
      updates.email = nextEmail.toLowerCase();
    }

    if (!Object.keys(updates).length) {
      setProfileError('No changes to save.');
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }
      await checkAuth();
      setProfileSuccess('Profile updated.');
      publish({
        title: 'Profile saved',
        description: 'Your changes have been saved.',
        type: 'success'
      });
      // Keep panel open briefly to show success, user can close manually
    } catch (error) {
      setProfileError(error.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  }, [profileSaving, profileForm, user?.username, user?.email, checkAuth, publish]);

  const handlePasswordUpdate = useCallback(async () => {
    if (passwordSaving) return;
    if (!passwordForm.current || !passwordForm.next) {
      setPasswordError('Enter your current and new password.');
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }
      setPasswordForm({ current: '', next: '', confirm: '' });
      setPasswordSuccess('Password updated.');
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password');
    } finally {
      setPasswordSaving(false);
    }
  }, [passwordSaving, passwordForm]);

  const loadAllJournalEntries = useCallback(async () => {
    if (journalLoading) return journalEntriesRef.current;
    setExportLoading(true);
    setExportError(null);
    setExportEntryCount(null);
    try {
      await loadJournalEntries();
      await new Promise(resolve => setTimeout(resolve, 0));
      let safety = 0;
      while (hasMoreEntriesRef.current && safety < 20) {
        const result = await loadMoreJournalEntries();
        if (!result?.appended) break;
        safety += 1;
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      const entries = journalEntriesRef.current || [];
      setExportEntryCount(entries.length);
      return entries;
    } finally {
      setExportLoading(false);
    }
  }, [journalLoading, loadJournalEntries, loadMoreJournalEntries]);

  const handleExportPdf = useCallback(async () => {
    const entries = await loadAllJournalEntries();
    if (!entries?.length) {
      setExportError('No journal entries available to export.');
      return;
    }
    const stats = computeJournalStats(entries);
    if (!stats) {
      setExportError('No journal entries available to export.');
      return;
    }
    exportJournalInsightsToPdf(stats, entries, { scopeLabel: 'Account export' });
    publish({
      title: 'PDF export started',
      description: 'Your journal export is downloading.',
      type: 'success'
    });
  }, [loadAllJournalEntries, publish]);

  const handleExportCsv = useCallback(async () => {
    const entries = await loadAllJournalEntries();
    if (!entries?.length) {
      setExportError('No journal entries available to export.');
      return;
    }
    const success = exportJournalEntriesToCsv(entries);
    if (!success) {
      setExportError('CSV export failed.');
      return;
    }
    publish({
      title: 'CSV export started',
      description: 'Your journal export is downloading.',
      type: 'success'
    });
  }, [loadAllJournalEntries, publish]);

  const handleDownloadAccountData = useCallback(() => {
    if (typeof document === 'undefined') return;
    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user?.id || null,
        email: user?.email || null,
        username: user?.username || null
      },
      subscription: {
        tier,
        status: _subscription?.status || null,
        provider: _subscription?.provider || null
      },
      preferences: {
        theme,
        includeMinors,
        reversalFramework,
        voiceOn,
        autoNarrate,
        ambienceOn,
        ttsProvider
      }
    };

    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'tableu-account-data.json');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      publish({
        title: 'Account data ready',
        description: 'Your data export is downloading.',
        type: 'success'
      });
    } catch {
      publish({
        title: 'Download failed',
        description: 'Unable to download account data.',
        type: 'error'
      });
    }
  }, [
    user?.id,
    user?.email,
    user?.username,
    tier,
    _subscription?.status,
    _subscription?.provider,
    theme,
    includeMinors,
    reversalFramework,
    voiceOn,
    autoNarrate,
    ambienceOn,
    ttsProvider,
    publish
  ]);

  const handleRestorePurchases = useCallback(async () => {
    if (restoreLoading) return;
    const provider = subscriptionDetails?.provider || _subscription?.provider || null;
    const storeUrls = {
      apple: 'https://apps.apple.com/account/subscriptions',
      app_store: 'https://apps.apple.com/account/subscriptions',
      ios: 'https://apps.apple.com/account/subscriptions',
      google_play: 'https://play.google.com/store/account/subscriptions'
    };
    if (provider && storeUrls[provider]) {
      const storeUrl = storeUrls[provider];
      const opened = window.open(storeUrl, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.assign(storeUrl);
      }
      publish({
        title: 'Restore purchases',
        description: 'Use your app store subscriptions page to restore purchases.',
        type: 'info'
      });
      return;
    }
    setRestoreLoading(true);
    try {
      const response = await fetch('/api/subscription/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to restore purchases');
      }
      await checkAuth();
      publish({
        title: 'Purchases restored',
        description: 'We refreshed your subscription status.',
        type: 'success'
      });
    } catch (error) {
      publish({
        title: 'Restore failed',
        description: error.message || 'Unable to restore purchases.',
        type: 'error'
      });
    } finally {
      setRestoreLoading(false);
    }
  }, [restoreLoading, subscriptionDetails?.provider, _subscription?.provider, checkAuth, publish]);

  const handleManageBilling = useCallback(async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    setPortalError(null);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ returnUrl: `${window.location.origin}/account` })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const portalErrorMessages = {
          STRIPE_NOT_CONFIGURED: 'Billing portal is temporarily unavailable.',
          AUTH_REQUIRED: 'Please sign in to manage billing.',
          SESSION_REQUIRED: 'Please sign in to manage billing.',
          NO_STRIPE_CUSTOMER: 'No billing profile was found for this account.'
        };
        throw new Error(portalErrorMessages[data.code] || data.error || 'Unable to open billing portal');
      }

      if (!data.url) {
        throw new Error('No billing portal URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      setPortalError(error.message || 'Unable to open billing portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  }, [portalLoading]);

  const handleManageSubscription = useCallback(() => {
    const provider = subscriptionDetails?.provider || _subscription?.provider || null;
    setPortalError(null);
    if (!provider || provider === 'stripe') {
      handleManageBilling();
      return;
    }

    const providerUrls = {
      apple: 'https://apps.apple.com/account/subscriptions',
      app_store: 'https://apps.apple.com/account/subscriptions',
      ios: 'https://apps.apple.com/account/subscriptions',
      google_play: 'https://play.google.com/store/account/subscriptions'
    };

    const url = providerUrls[provider];
    if (url) {
      window.location.assign(url);
      return;
    }

    setPortalError('Use your billing provider to manage this subscription.');
  }, [subscriptionDetails?.provider, _subscription?.provider, handleManageBilling]);

  const handleDeleteAccount = useCallback(async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ confirm: true })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to delete account');
      }
      await logout();
      publish({
        title: 'Account deleted',
        description: 'Your data has been removed.',
        type: 'success'
      });
      navigate('/', { replace: true });
    } catch (error) {
      publish({
        title: 'Delete failed',
        description: error.message || 'Unable to delete account.',
        type: 'error'
      });
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteLoading, logout, publish, navigate]);

  const handleResendEmailVerification = useCallback(async () => {
    if (!user?.email || verificationSending) return;
    setVerificationSending(true);
    try {
      const result = await resendVerification(user.email);
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to send verification email');
      }
      publish({
        title: 'Verification email sent',
        description: `Check ${user.email} for a fresh link.`,
        type: 'success'
      });
    } catch (error) {
      publish({
        title: 'Send failed',
        description: error.message || 'Unable to resend verification email.',
        type: 'error'
      });
    } finally {
      setVerificationSending(false);
    }
  }, [user?.email, verificationSending, resendVerification, publish]);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const handleReplayTutorial = () => {
    setTutorialResetOpen(true);
  };

  const confirmReplayTutorial = useCallback(() => {
    resetOnboarding();
    setTutorialResetOpen(false);
    navigate('/');
  }, [resetOnboarding, navigate]);

  const handleResetJourney = useCallback(async () => {
    if (journeyResetLoading) return;
    setJourneyResetLoading(true);
    setJourneyResetError(null);
    try {
      const response = await fetch('/api/archetype-journey/reset', {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Unable to reset journey data');
      }
      publish({
        title: 'Journey reset',
        description: 'Your Archetype Journey history has been cleared.',
        type: 'success'
      });
      setJourneyResetOpen(false);
    } catch (error) {
      setJourneyResetError(error.message || 'Unable to reset journey data');
    } finally {
      setJourneyResetLoading(false);
    }
  }, [journeyResetLoading, publish]);

  // Loading state - only wait for auth, not subscription (guests don't need it)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-main flex items-center justify-center">
        <CircleNotch className="h-8 w-8 text-accent animate-spin" />
      </div>
    );
  }

  const tierConfig = SUBSCRIPTION_TIERS[tier] || SUBSCRIPTION_TIERS.free;
  const isPaid = tier === 'plus' || tier === 'pro';
  const tierIcons = { free: Moon, plus: Sparkle, pro: Crown };
  const TierIcon = tierIcons[tier] || Moon;
  const readingUsage = usageStatus?.readings || null;
  const ttsUsage = usageStatus?.tts || null;
  const apiCallsUsage = usageStatus?.apiCalls || null;

  // Usage threshold helpers for visual feedback
  const getUsageThreshold = (used, limit) => {
    if (!limit || limit === Infinity) return 'normal';
    const ratio = used / limit;
    if (ratio >= 1) return 'exhausted';
    if (ratio >= 0.8) return 'warning';
    return 'normal';
  };
  const usageThresholdBarColors = {
    normal: 'bg-accent',
    warning: 'bg-amber-400',
    exhausted: 'bg-error'
  };
  const usageThresholdTextColors = {
    normal: 'text-muted',
    warning: 'text-amber-400',
    exhausted: 'text-error'
  };

  const subscriptionProvider = subscriptionDetails?.provider || _subscription?.provider || null;
  const providerLabels = {
    stripe: 'Stripe',
    apple: 'Apple App Store',
    app_store: 'Apple App Store',
    ios: 'Apple App Store',
    google_play: 'Google Play'
  };
  const storeProviders = ['apple', 'app_store', 'ios', 'google_play'];
  const providerLabel = subscriptionProvider
    ? (providerLabels[subscriptionProvider] || subscriptionProvider.replace(/_/g, ' '))
    : null;
  const isStoreProvider = subscriptionProvider ? storeProviders.includes(subscriptionProvider) : false;
  const stripeMeta = subscriptionDetails?.stripe || null;
  const statusValue = stripeMeta?.status || subscriptionDetails?.status || _subscription?.status || 'inactive';
  const statusLabels = {
    active: 'Active',
    trialing: 'Trialing',
    past_due: 'Past due',
    canceled: 'Canceled',
    unpaid: 'Unpaid',
    incomplete: 'Incomplete',
    expired: 'Expired',
    paused: 'Paused',
    inactive: 'Inactive'
  };
  const statusLabel = statusLabels[statusValue] || statusValue;
  const formatDate = (timestampMs) => (
    timestampMs
      ? new Date(timestampMs).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
      : null
  );
  let statusDate = null;
  if (statusValue === 'trialing' && stripeMeta?.trialEnd) {
    statusDate = `Trial ends ${formatDate(stripeMeta.trialEnd)}`;
  } else if ((statusValue === 'canceled' || statusValue === 'expired') && (stripeMeta?.cancelAt || stripeMeta?.currentPeriodEnd)) {
    statusDate = `Ends ${formatDate(stripeMeta.cancelAt || stripeMeta.currentPeriodEnd)}`;
  } else if (stripeMeta?.cancelAtPeriodEnd && stripeMeta?.currentPeriodEnd) {
    statusDate = `Ends ${formatDate(stripeMeta.currentPeriodEnd)}`;
  } else if (stripeMeta?.currentPeriodEnd) {
    statusDate = `Renews ${formatDate(stripeMeta.currentPeriodEnd)}`;
  }
  const statusLineParts = [statusLabel, statusDate, providerLabel ? `Billed via ${providerLabel}` : null].filter(Boolean);
  const shouldShowStatusLine = isPaid || providerLabel || Boolean(statusDate);
  const subscriptionStatusLine = shouldShowStatusLine ? statusLineParts.join(' · ') : null;
  const needsPaymentUpdate = ['past_due', 'unpaid'].includes(statusValue);
  const needsResubscribe = statusValue === 'canceled';
  const hasActiveSubscription = ['active', 'trialing'].includes(statusValue);
  const billingIntervalSource = subscriptionDetails?.billingInterval
    || subscriptionDetails?.plan?.interval
    || stripeMeta?.plan?.interval
    || subscriptionDetails?.interval;
  const normalizedBillingInterval = billingIntervalSource
    ? billingIntervalSource.toString().toLowerCase()
    : null;
  const billingIntervalLabel = normalizedBillingInterval
    ? (normalizedBillingInterval.includes('year') || normalizedBillingInterval.includes('annual')
      ? 'Billed annually'
      : normalizedBillingInterval.includes('month')
        ? 'Billed monthly'
        : `Billed ${normalizedBillingInterval}`)
    : null;
  const periodEndTimestamp = stripeMeta?.currentPeriodEnd || null;
  const trialEndTimestamp = stripeMeta?.trialEnd || null;
  const renewalLabel = statusValue === 'trialing'
    ? (trialEndTimestamp
      ? `Trial ends ${formatDate(trialEndTimestamp)}`
      : (periodEndTimestamp ? `Renews ${formatDate(periodEndTimestamp)}` : null))
    : (periodEndTimestamp ? `Renews ${formatDate(periodEndTimestamp)}` : null);
  const billingLineParts = [billingIntervalLabel, renewalLabel].filter(Boolean);
  const billingLine = hasActiveSubscription && billingLineParts.length ? billingLineParts.join(' · ') : null;
  const showStatusBanner = needsPaymentUpdate || needsResubscribe;
  const storeLabel = providerLabel || 'your app store';
  const storeManageLabel = providerLabel ? `Manage in ${providerLabel}` : 'Manage subscription';
  const statusBannerMessage = needsPaymentUpdate
    ? (isStoreProvider
      ? `Update payment details in ${storeLabel} to avoid interruptions.`
      : 'Update your payment method to avoid interruptions.'
    )
    : needsResubscribe
      ? (isStoreProvider
        ? `Your subscription is canceled. Renew in ${storeLabel} to restore access.`
        : 'Your subscription is canceled. Resubscribe to restore premium access.'
      )
      : null;
  const statusBannerActionLabel = needsPaymentUpdate
    ? (isStoreProvider ? storeManageLabel : 'Update payment')
    : needsResubscribe
      ? (isStoreProvider ? storeManageLabel : 'Resubscribe')
      : null;
  const statusBannerNextStep = needsPaymentUpdate
    ? 'Next: Update your card or payment method'
    : needsResubscribe
      ? `Next: Choose a plan to continue with ${tierConfig.monthlyReadings === Infinity ? 'unlimited' : tierConfig.monthlyReadings} readings/month`
      : null;
  const showPortalErrorInBanner = Boolean(showStatusBanner && portalError);
  const manageLabel = subscriptionProvider && subscriptionProvider !== 'stripe'
    ? `Manage in ${providerLabel}`
    : 'Manage Billing';
  const portalHelpText = isStoreProvider
    ? `Subscriptions billed through ${providerLabel} are managed in that store.`
    : 'If you subscribed through the App Store or Google Play, manage billing in that store.';
  const usageUpdatedAt = usageStatus?.trackingAvailable !== false && usageStatus?.updatedAt
    ? new Date(usageStatus.updatedAt)
    : null;
  const usageUpdatedLabel = usageUpdatedAt && !Number.isNaN(usageUpdatedAt.getTime())
    ? usageUpdatedAt.toLocaleString()
    : null;
  const autoNarrateLocked = !voiceOn;
  const autoNarrateDescription = voiceOn
    ? 'Automatically play narration as readings stream in'
    : (autoNarrate ? 'On (requires Reader Voice)' : 'Requires Reader Voice');
  const isGuest = !isAuthenticated;
  const usernameRule = /^[A-Za-z0-9_]{3,30}$/;
  const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const nextUsername = profileForm.username.trim();
  const nextEmail = profileForm.email.trim();
  const isUsernameValid = !nextUsername || usernameRule.test(nextUsername);
  const isEmailValid = !nextEmail || emailRule.test(nextEmail);
  const hasProfileChanges = Boolean(
    (nextUsername && nextUsername !== user?.username) ||
    (nextEmail && nextEmail.toLowerCase() !== user?.email)
  );
  const profileSaveDisabled = profileSaving || !hasProfileChanges || !isUsernameValid || !isEmailValid;
  const passwordLengthValid = !passwordForm.next || passwordForm.next.length >= 8;
  const passwordMatch = !passwordForm.confirm || passwordForm.next === passwordForm.confirm;
  const passwordReady = Boolean(
    passwordForm.current && passwordForm.next && passwordForm.confirm && passwordLengthValid && passwordMatch
  );
  const passwordSaveDisabled = passwordSaving || !passwordReady;
  const reversalDescriptions = {
    auto: 'Balances context, card meaning, and spread position.',
    blocked: 'Reversals highlight blocked or resisted energy.',
    delayed: 'Reversals point to timing issues and delays.',
    internalized: 'Reversals indicate inward or private processing.',
    contextual: 'Reversals adapt to your question context.',
    shadow: 'Reversals reveal shadow work and integration.',
    mirror: 'Reversals reflect your current state back to you.',
    potentialBlocked: 'Reversals show unrealized potential or hesitations.'
  };
  const reversalKey = reversalFramework || 'auto';
  const reversalDescription = reversalDescriptions[reversalKey] || reversalDescriptions.auto;

  return (
    <div className="min-h-screen bg-main text-main">
      {/* Unified header with GlobalNav (includes UserMenu via withUserChip) - sticky with safe-area padding */}
      <header
        className="sticky top-0 z-40 border-b border-secondary/20 bg-main/95 backdrop-blur-sm pt-[max(var(--safe-pad-top),0.75rem)] pl-[max(var(--safe-pad-left),1rem)] pr-[max(var(--safe-pad-right),1rem)]"
      >
        <div className="mx-auto max-w-2xl px-4 py-3">
          <GlobalNav condensed withUserChip />
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-serif text-3xl text-main">{isAuthenticated ? 'Account & Settings' : 'Settings'}</h1>
            <p className="text-sm text-muted mt-1">
              {isAuthenticated ? 'Manage your profile, subscription, and preferences' : 'Customize your reading experience'}
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-secondary/40 px-3 py-2 text-xs font-semibold text-muted hover:text-main hover:border-secondary/60 transition"
          >
            Done
          </Link>
        </div>

        {/* Section Navigation Chips */}
        <nav
          className="sticky z-30 -mx-4 px-4 py-2 bg-main/95 backdrop-blur-sm border-b border-secondary/20 overflow-x-auto top-[calc(var(--safe-pad-top)+4.5rem)]"
          aria-label="Jump to section"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          <div className="flex items-center gap-2 min-w-max">
            {[
              { id: 'profile', label: 'Profile', authOnly: false },
              { id: 'subscription', label: 'Subscription', authOnly: true },
              { id: 'audio', label: 'Audio', authOnly: false },
              { id: 'display', label: 'Display', authOnly: false },
              { id: 'reading', label: 'Reading', authOnly: false },
              { id: 'privacy', label: 'Privacy', authOnly: true },
              { id: 'actions', label: 'Actions', authOnly: true },
            ]
              .filter(section => !section.authOnly || isAuthenticated)
              .map(section => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap
                    border transition-colors touch-manipulation
                    ${highlightedSection === section.id
                      ? 'bg-accent/20 border-accent/40 text-accent'
                      : 'bg-surface/60 border-secondary/30 text-muted hover:text-main hover:border-secondary/50'
                    }
                  `}
                >
                  {section.label}
                </a>
              ))}
          </div>
        </nav>

        {isGuest && (
          <div className="rounded-2xl border border-accent/20 bg-surface-muted/60 px-5 py-4">
            <p className="text-sm font-semibold text-main">
              Sign in to sync your journal, subscription, and analytics.
            </p>
            <p className="text-xs text-muted mt-1">
              Your theme and audio preferences stay on this device until you sign in.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('register');
                  setShowAuthModal(true);
                }}
                className="flex-1 inline-flex items-center justify-center rounded-full bg-accent px-4 py-2.5 text-xs font-semibold text-main hover:bg-accent/90 transition"
              >
                Create free account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                }}
                className="flex-1 inline-flex items-center justify-center rounded-full border border-accent/40 px-4 py-2.5 text-xs font-semibold text-main hover:bg-accent/10 transition"
              >
                Sign in
              </button>
            </div>
          </div>
        )}

        {isAuthenticated && user && !user.email_verified && (
          <div className="rounded-2xl border border-amber-300/50 bg-amber-500/10 px-5 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-amber-200" weight="duotone" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-main">Verify your email</p>
                  <p className="text-xs text-amber-50/90">
                    Confirm {user.email} to enable password recovery and security alerts.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResendEmailVerification}
                  className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-xs font-semibold text-main hover:bg-accent/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={verificationSending}
                >
                  {verificationSending ? 'Sending...' : 'Resend verification'}
                </button>
                <Link
                  to="/reset-password"
                  className="inline-flex items-center justify-center rounded-full border border-amber-200/50 px-4 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-500/20 transition"
                >
                  Forgot password?
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Profile Section - Auth only */}
        {isAuthenticated ? (
        <SectionCard title="Profile" icon={User} id="profile" highlighted={highlightedSection === 'profile'}>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-accent">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-main truncate">{user?.username}</p>
              <p className="text-sm text-muted truncate flex items-center gap-1">
                <Envelope className="h-3.5 w-3.5" />
                {user?.email}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setProfileEditing((prev) => !prev);
                  setProfileError(null);
                  setProfileSuccess(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 px-3 py-1.5 text-xs text-muted hover:text-main hover:border-secondary/60 transition"
              >
                <PencilSimple className="h-3.5 w-3.5" />
                {profileEditing ? 'Cancel' : 'Edit'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPasswordEditing((prev) => !prev);
                  setPasswordError(null);
                  setPasswordSuccess(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-secondary/40 px-3 py-1.5 text-xs text-muted hover:text-main hover:border-secondary/60 transition"
              >
                <Lock className="h-3.5 w-3.5" />
                {passwordEditing ? 'Close' : 'Password'}
              </button>
            </div>
          </div>

          {profileEditing && (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="profile-username" className="text-xs text-muted block mb-1">
                  Username
                </label>
                <input
                  id="profile-username"
                  type="text"
                  value={profileForm.username}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, username: event.target.value }))}
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-invalid={!isUsernameValid}
                  aria-describedby="profile-username-help"
                  className="
                    w-full rounded-xl border border-secondary/30 bg-surface-muted/50
                    px-3 py-2.5 text-sm text-main
                    focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                    transition
                  "
                />
                <p
                  id="profile-username-help"
                  className={`mt-1 text-xs ${isUsernameValid ? 'text-muted' : 'text-error'}`}
                >
                  3–30 characters, letters, numbers, and underscores only.
                </p>
              </div>
              <div>
                <label htmlFor="profile-email" className="text-xs text-muted block mb-1">
                  Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  value={profileForm.email}
                  onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="email"
                  aria-invalid={!isEmailValid}
                  aria-describedby="profile-email-help"
                  className="
                    w-full rounded-xl border border-secondary/30 bg-surface-muted/50
                    px-3 py-2.5 text-sm text-main
                    focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                    transition
                  "
                />
                <p
                  id="profile-email-help"
                  className={`mt-1 text-xs ${isEmailValid ? 'text-muted' : 'text-error'}`}
                >
                  Use a valid email address for account recovery.
                </p>
              </div>
              {profileError && <p className="text-xs text-error">{profileError}</p>}
              {profileSuccess && <p className="text-xs text-emerald-300">{profileSuccess}</p>}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={profileSaveDisabled}
                  className={`
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-accent/60 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-main
                    hover:bg-accent/20 transition
                    ${profileSaveDisabled ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                >
                  Save changes
                  {profileSaving && <CircleNotch className="h-4 w-4 animate-spin" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setProfileEditing(false);
                    setProfileForm({ username: user?.username || '', email: user?.email || '' });
                    setProfileError(null);
                    setProfileSuccess(null);
                  }}
                  className="
                    flex-1 inline-flex items-center justify-center rounded-full
                    border border-secondary/40 bg-transparent px-4 py-2.5 text-xs font-semibold text-main
                    hover:bg-secondary/10 transition
                  "
                >
                  {profileSuccess ? 'Done' : 'Cancel'}
                </button>
              </div>
            </div>
          )}

          {passwordEditing && (
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="password-current" className="text-xs text-muted block mb-1">
                  Current password
                </label>
                <div className="relative">
                  <input
                    id="password-current"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordForm.current}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, current: event.target.value }))}
                    autoComplete="current-password"
                    className="
                      w-full rounded-xl border border-secondary/30 bg-surface-muted/50
                      px-3 py-2.5 pr-12 text-sm text-main
                      focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                      transition
                    "
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="
                      absolute right-2 top-1/2 -translate-y-1/2
                      min-w-touch min-h-touch flex items-center justify-center
                      text-muted hover:text-main
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                      focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                    "
                    aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  >
                    {showCurrentPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="password-next" className="text-xs text-muted block mb-1">
                  New password (8+ characters)
                </label>
                <div className="relative">
                  <input
                    id="password-next"
                    type={showNextPassword ? 'text' : 'password'}
                    value={passwordForm.next}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, next: event.target.value }))}
                    autoComplete="new-password"
                    aria-invalid={!passwordLengthValid}
                    aria-describedby="password-next-help"
                    className="
                      w-full rounded-xl border border-secondary/30 bg-surface-muted/50
                      px-3 py-2.5 pr-12 text-sm text-main
                      focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                      transition
                    "
                  />
                  <button
                    type="button"
                    onClick={() => setShowNextPassword((prev) => !prev)}
                    className="
                      absolute right-2 top-1/2 -translate-y-1/2
                      min-w-touch min-h-touch flex items-center justify-center
                      text-muted hover:text-main
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                      focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                    "
                    aria-label={showNextPassword ? 'Hide new password' : 'Show new password'}
                  >
                    {showNextPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p
                  id="password-next-help"
                  className={`mt-1 text-xs ${passwordLengthValid ? 'text-muted' : 'text-error'}`}
                >
                  Must be at least 8 characters.
                </p>
              </div>
              <div>
                <label htmlFor="password-confirm" className="text-xs text-muted block mb-1">
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="password-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordForm.confirm}
                    onChange={(event) => setPasswordForm((prev) => ({ ...prev, confirm: event.target.value }))}
                    autoComplete="new-password"
                    aria-invalid={!passwordMatch}
                    aria-describedby="password-confirm-help"
                    className="
                      w-full rounded-xl border border-secondary/30 bg-surface-muted/50
                      px-3 py-2.5 pr-12 text-sm text-main
                      focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                      transition
                    "
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="
                      absolute right-2 top-1/2 -translate-y-1/2
                      min-w-touch min-h-touch flex items-center justify-center
                      text-muted hover:text-main
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                      focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                    "
                    aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
                  >
                    {showConfirmPassword ? <EyeSlash className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p
                  id="password-confirm-help"
                  className={`mt-1 text-xs ${passwordMatch ? 'text-muted' : 'text-error'}`}
                >
                  New passwords must match.
                </p>
              </div>
              {passwordError && <p className="text-xs text-error">{passwordError}</p>}
              {passwordSuccess && <p className="text-xs text-emerald-300">{passwordSuccess}</p>}
              <button
                type="button"
                onClick={handlePasswordUpdate}
                disabled={passwordSaveDisabled}
                className={`
                  w-full inline-flex items-center justify-center gap-2 rounded-full
                  border border-accent/60 bg-accent/10 px-4 py-2.5 text-xs font-semibold text-main
                  hover:bg-accent/20 transition
                  ${passwordSaveDisabled ? 'opacity-70 cursor-not-allowed' : ''}
                `}
              >
                Update password
                {passwordSaving && <CircleNotch className="h-4 w-4 animate-spin" />}
              </button>
            </div>
          )}
        </SectionCard>
        ) : (
          <LockedSectionCard
            title="Profile"
            icon={User}
            id="profile"
            highlighted={highlightedSection === 'profile'}
            description="Sign in to manage your profile and keep your journal synced across devices."
            onAction={() => setShowAuthModal(true)}
          />
        )}

        {/* Subscription Section - Auth only */}
        {isAuthenticated ? (
        <SectionCard title="Subscription" icon={CreditCard} id="subscription" highlighted={highlightedSection === 'subscription'}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${isPaid ? 'bg-accent/20' : 'bg-secondary/20'}`}>
              <TierIcon className={`h-6 w-6 ${isPaid ? 'text-accent' : 'text-secondary'}`} weight="fill" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-main">{tierConfig.name}</p>
                <span className="text-xs uppercase tracking-wider text-muted bg-secondary/20 px-2 py-0.5 rounded-full">
                  {tierConfig.label}
                </span>
              </div>
              <p className="text-sm text-muted">
                {isPaid ? (
                  <>${tierConfig.price}/month</>
                ) : (
                  'Free plan'
                )}
              </p>
              {billingLine && (
                <p className="text-xs text-muted mt-1">Billing: {billingLine}</p>
              )}
              {subscriptionDetailsLoading ? (
                <p className="text-xs text-muted mt-1">Loading subscription status…</p>
              ) : subscriptionStatusLine ? (
                <p className="text-xs text-muted mt-1">{subscriptionStatusLine}</p>
              ) : null}
              {subscriptionDetailsError && (
                <p className="text-xs text-error mt-1">{subscriptionDetailsError}</p>
              )}
            </div>
          </div>

          {showStatusBanner && (
            <div
              className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-main">Subscription needs attention</p>
                  <p className="text-xs text-muted mt-1">{statusBannerMessage}</p>
                  {statusBannerNextStep && (
                    <p className="text-xs text-amber-200/80 mt-1 font-medium">{statusBannerNextStep}</p>
                  )}
                </div>
                {needsResubscribe && !isStoreProvider ? (
                  <Link
                    to="/pricing"
                    className="inline-flex items-center justify-center rounded-full border border-amber-300/40 bg-amber-300/20 px-4 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-300/30 transition"
                  >
                    Resubscribe
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleManageSubscription}
                    disabled={portalLoading}
                    className={`
                      inline-flex items-center justify-center gap-2 rounded-full
                      border border-amber-300/40 bg-amber-300/20 px-4 py-2 text-xs font-semibold text-amber-100
                      hover:bg-amber-300/30 transition
                      ${portalLoading ? 'opacity-70 cursor-not-allowed' : ''}
                    `}
                  >
                    {statusBannerActionLabel}
                    {portalLoading && <CircleNotch className="h-4 w-4 animate-spin" />}
                  </button>
                )}
              </div>
              {showPortalErrorInBanner && (
                <p className="text-xs text-error mt-2" role="alert">
                  {portalError}
                </p>
              )}
            </div>
          )}

          {/* Current plan features */}
          <div className="border-t border-secondary/20 pt-4 mb-4">
            <p className="text-xs uppercase tracking-wider text-muted mb-2">Your plan includes</p>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-sm text-secondary">
                <Check className="h-4 w-4 text-accent shrink-0" />
                {tierConfig.monthlyReadings === Infinity ? 'Unlimited' : tierConfig.monthlyReadings} AI readings/month
              </li>
              <li className="flex items-center gap-2 text-sm text-secondary">
                <Check className="h-4 w-4 text-accent shrink-0" />
                {tierConfig.monthlyTTS === Infinity ? 'Unlimited' : tierConfig.monthlyTTS} voice narrations/month
              </li>
              {tierConfig.cloudJournal && (
                <li className="flex items-center gap-2 text-sm text-secondary">
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  Cloud journal sync
                </li>
              )}
              {tierConfig.advancedInsights && (
                <li className="flex items-center gap-2 text-sm text-secondary">
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  Advanced insights
                </li>
              )}
              {tierConfig.apiAccess && (
                <li className="flex items-center gap-2 text-sm text-secondary">
                  <Check className="h-4 w-4 text-accent shrink-0" />
                  API access ({tierConfig.apiCallsPerMonth} calls/mo)
                </li>
              )}
            </ul>
          </div>

          {/* Usage dashboard */}
          <div className="border-t border-secondary/20 pt-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs uppercase tracking-wider text-muted">Usage this month</p>
              <button
                type="button"
                onClick={fetchUsage}
                disabled={usageLoading}
                className="text-xs text-muted hover:text-main transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Refresh
              </button>
            </div>
            <p className="text-xs text-muted mb-3">
              Counts completed readings only. Usage updates within a few minutes.
            </p>

            {usageLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <CircleNotch className="h-4 w-4 animate-spin text-accent" />
                Loading usage…
              </div>
            ) : usageError ? (
              <div className="space-y-2">
                <p className="text-sm text-error">{usageError}</p>
                <button
                  type="button"
                  onClick={fetchUsage}
                  className="text-xs text-muted hover:text-main transition"
                >
                  Try again
                </button>
              </div>
            ) : usageStatus?.trackingAvailable !== false && readingUsage?.source ? (
              <div className="space-y-2">
                {/* AI Readings Usage */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-secondary">AI readings</span>
                  <span className={`font-medium ${usageThresholdTextColors[getUsageThreshold(readingUsage.used, readingUsage.limit)]}`}>
                    {readingUsage.unlimited
                      ? `${readingUsage.used} used`
                      : `${readingUsage.used}/${readingUsage.limit} · ${readingUsage.remaining} remaining`}
                  </span>
                </div>

                {!readingUsage.unlimited && typeof readingUsage.limit === 'number' && readingUsage.limit > 0 && (
                  <div className="h-2 rounded-full bg-secondary/20 overflow-hidden">
                    <div
                      className={`h-full transition-all ${usageThresholdBarColors[getUsageThreshold(readingUsage.used, readingUsage.limit)]}`}
                      style={{
                        width: `${Math.min(100, Math.round((readingUsage.used / readingUsage.limit) * 100))}%`
                      }}
                    />
                  </div>
                )}

                {/* Upgrade CTA when near limit */}
                {!readingUsage.unlimited && getUsageThreshold(readingUsage.used, readingUsage.limit) !== 'normal' && (
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition"
                  >
                    <Crown className="h-3 w-3" weight="fill" />
                    Upgrade for more readings
                  </Link>
                )}

                {/* Voice Narrations Usage */}
                {ttsUsage && (
                  <>
                    <div className="flex items-center justify-between text-sm pt-2">
                      <span className="text-secondary">Voice narrations</span>
                      <span className={`font-medium ${usageThresholdTextColors[getUsageThreshold(ttsUsage.used, ttsUsage.limit)]}`}>
                        {ttsUsage.unlimited
                          ? `${ttsUsage.used} used`
                          : `${ttsUsage.used}/${ttsUsage.limit} · ${ttsUsage.remaining} remaining`}
                      </span>
                    </div>

                    {!ttsUsage.unlimited && typeof ttsUsage.limit === 'number' && ttsUsage.limit > 0 && (
                      <div className="h-2 rounded-full bg-secondary/20 overflow-hidden">
                        <div
                          className={`h-full transition-all ${usageThresholdBarColors[getUsageThreshold(ttsUsage.used, ttsUsage.limit)]}`}
                          style={{
                            width: `${Math.min(100, Math.round((ttsUsage.used / ttsUsage.limit) * 100))}%`
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* API Calls Usage */}
                {apiCallsUsage?.enabled && (
                  <>
                    <div className="flex items-center justify-between text-sm pt-2">
                      <span className="text-secondary">API calls</span>
                      <span className={`font-medium ${usageThresholdTextColors[getUsageThreshold(apiCallsUsage.used, apiCallsUsage.limit)]}`}>
                        {typeof apiCallsUsage.limit === 'number'
                          ? `${apiCallsUsage.used}/${apiCallsUsage.limit} · ${apiCallsUsage.remaining} remaining`
                          : apiCallsUsage.used}
                      </span>
                    </div>

                    {typeof apiCallsUsage.limit === 'number' && apiCallsUsage.limit > 0 && (
                      <div className="h-2 rounded-full bg-secondary/20 overflow-hidden">
                        <div
                          className={`h-full transition-all ${usageThresholdBarColors[getUsageThreshold(apiCallsUsage.used, apiCallsUsage.limit)]}`}
                          style={{
                            width: `${Math.min(100, Math.round((apiCallsUsage.used / apiCallsUsage.limit) * 100))}%`
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                <p className="text-xs text-muted">
                  Resets {usageStatus?.resetAt ? new Date(usageStatus.resetAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'next month'} (UTC)
                </p>
                {usageUpdatedLabel && (
                  <p className="text-xs text-muted">Last updated {usageUpdatedLabel}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted">
                  Usage tracking temporarily unavailable.
                </p>
                <p className="text-xs text-muted">
                  Your limits are still enforced. Usage updates within a few minutes.
                </p>
                <button
                  type="button"
                  onClick={fetchUsage}
                  disabled={usageLoading}
                  className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 transition disabled:opacity-60"
                >
                  <ArrowClockwise className="h-3.5 w-3.5" />
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Upgrade/Manage buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!isPaid ? (
              <Link
                to="/pricing"
                className={`
                  flex-1 inline-flex items-center justify-center gap-2 rounded-full
                  border border-accent bg-accent px-4 py-3 text-sm font-semibold text-main
                  hover:bg-accent/90 transition
                  ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
                `}
              >
                <Crown className="h-4 w-4" weight="fill" />
                Upgrade Plan
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/pricing"
                  className={`
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-secondary/60 bg-transparent px-4 py-3 text-sm font-semibold text-main
                    hover:bg-secondary/10 transition
                    ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
                  `}
                >
                  View Plans
                  <CaretRight className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className={`
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-accent/60 bg-transparent px-4 py-3 text-sm font-semibold text-main
                    hover:bg-accent/10 transition
                    ${portalLoading ? 'opacity-70 cursor-not-allowed' : ''}
                    ${prefersReducedMotion ? '' : 'hover:scale-[1.02]'}
                  `}
                >
                  <CreditCard className="h-4 w-4" weight="fill" />
                  {manageLabel}
                  {portalLoading ? (
                    <CircleNotch className="h-4 w-4 animate-spin" />
                  ) : (
                    <CaretRight className="h-4 w-4" />
                  )}
                </button>
              </>
            )}
          </div>
          {!showStatusBanner && portalError && (
            <div className="mt-3 rounded-xl border border-error/40 bg-error/10 p-3">
              <p className="text-xs text-error">{portalError}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleManageSubscription}
                  className="text-xs font-semibold text-error hover:text-error/80 transition"
                >
                  Try again
                </button>
                <span className="text-xs text-muted">{portalHelpText}</span>
              </div>
            </div>
          )}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleRestorePurchases}
              disabled={restoreLoading}
              className={`
                w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full
                border border-secondary/50 bg-transparent px-4 py-2.5 text-xs font-semibold text-main
                hover:bg-secondary/10 transition
                ${restoreLoading ? 'opacity-70 cursor-not-allowed' : ''}
              `}
            >
              <ArrowClockwise className="h-4 w-4" />
              Restore purchases
              {restoreLoading && <CircleNotch className="h-4 w-4 animate-spin" />}
            </button>
            <p className="text-xs text-muted mt-1">
              Use this if you upgraded on another device or storefront.
            </p>
          </div>
        </SectionCard>
        ) : (
          <LockedSectionCard
            title="Subscription"
            icon={CreditCard}
            id="subscription"
            highlighted={highlightedSection === 'subscription'}
            description="Sign in to view your plan, billing details, and monthly usage."
            onAction={() => setShowAuthModal(true)}
          />
        )}

        {/* Audio Settings Section - Available to all users */}
        <SectionCard title="Audio" icon={SpeakerHigh} id="audio" highlighted={highlightedSection === 'audio'} badge={<DeviceOnlyChip />}>
          <div className="divide-y divide-secondary/20">
            <SettingsToggle
              id="voice-toggle"
              label="Reader Voice"
              description="AI narration for card reveals and full readings"
              enabled={voiceOn}
              onChange={() => setVoiceOn(!voiceOn)}
            />
            <SettingsToggle
              id="auto-narrate-toggle"
              label="Auto-Narrate"
              description={autoNarrateDescription}
              enabled={autoNarrate}
              onChange={() => setAutoNarrate(!autoNarrate)}
              disabled={autoNarrateLocked}
              locked={autoNarrateLocked}
            />
            <SettingsToggle
              id="ambience-toggle"
              label="Table Ambience"
              description="Soft shuffle, candle crackle, and mystic room tone"
              enabled={ambienceOn}
              onChange={() => setAmbienceOn(!ambienceOn)}
            />
          </div>

          {/* Voice Engine Selector */}
          <div className="mt-4 pt-4 border-t border-secondary/20">
            <div className="flex items-center gap-2 mb-3">
              <Waveform className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Voice Engine</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Select voice engine">
              {[
                { id: 'hume', label: 'Expressive', desc: 'Hume AI' },
                { id: 'azure', label: 'Clear', desc: 'Azure' },
                { id: 'azure-sdk', label: 'Word-Sync', desc: 'Azure SDK' }
              ].map(engine => (
                <button
                  key={engine.id}
                  type="button"
                  role="radio"
                  aria-checked={ttsProvider === engine.id}
                  onClick={() => setTtsProvider(engine.id)}
                  className={`
                    px-3 py-2.5 rounded-xl text-center transition-all touch-manipulation
                    ${ttsProvider === engine.id
                      ? 'bg-accent/20 border-2 border-accent text-main'
                      : 'bg-surface-muted/50 border border-secondary/30 text-muted hover:text-main hover:border-secondary/50'
                    }
                  `}
                >
                  <span className="block text-xs font-semibold">{engine.label}</span>
                  <span className="block text-[0.65rem] opacity-75">{engine.desc}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted mt-2">
              Choose a voice engine now; it will apply when Reader Voice is on.
            </p>
          </div>
        </SectionCard>

        {/* Display Section */}
        <SectionCard title="Display" icon={Palette} id="display" highlighted={highlightedSection === 'display'} badge={<DeviceOnlyChip />}>
          <div className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-main">Theme</p>
                <p className="text-xs text-muted">Choose Light or Dark for this device.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span
                  className={`h-3 w-3 rounded-full border ${theme === 'light' ? 'bg-white border-secondary/40' : 'bg-main border-secondary/60'}`}
                  aria-hidden="true"
                />
                <span>Theme: {theme === 'light' ? 'Light' : 'Dark'}</span>
              </div>
            </div>
            <div
              className="mt-3 inline-flex rounded-full border border-secondary/30 bg-surface-muted/50 p-1"
              role="radiogroup"
              aria-label="Theme"
            >
              {[
                { id: 'light', label: 'Light', chip: 'bg-white border-secondary/30' },
                { id: 'dark', label: 'Dark', chip: 'bg-main border-secondary/60' }
              ].map(option => {
                const isActive = theme === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={isActive}
                    onClick={() => setTheme(option.id)}
                    className={`
                      min-h-touch px-4 py-2 rounded-full text-xs font-semibold
                      flex items-center gap-2 transition
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60
                      focus-visible:ring-offset-2 focus-visible:ring-offset-surface
                      ${isActive
                        ? 'bg-surface border border-secondary/40 text-main'
                        : 'text-muted hover:text-main'}
                    `}
                  >
                    <span className={`h-3 w-3 rounded-full border ${option.chip}`} aria-hidden="true" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* Reading Preferences Section */}
        <SectionCard title="Reading Preferences" icon={Sparkle} id="reading" highlighted={highlightedSection === 'reading'}>
          <div className="divide-y divide-secondary/20">
            <SettingsToggle
              id="deck-toggle"
              label="Full Deck"
              description="Include Minor Arcana (78 cards vs 22 Major only)"
              enabled={includeMinors}
              onChange={() => setIncludeMinors(!includeMinors)}
            />
          </div>

          {/* Reversal Framework Selector */}
          <div className="mt-4 pt-4 border-t border-secondary/20">
            <div className="flex items-center gap-2 mb-3">
              <ArrowCounterClockwise className="h-4 w-4 text-accent" />
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Reversal Lens</span>
            </div>
            <select
              id="reversal-framework-select"
              value={reversalFramework || 'auto'}
              onChange={e => setReversalFramework(e.target.value === 'auto' ? null : e.target.value)}
              className="
                w-full rounded-xl border border-secondary/30 bg-surface-muted/50
                px-3 py-2.5 text-sm text-main
                focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent
                transition
              "
              aria-describedby="reversal-description"
            >
              <option value="auto">Auto (recommended)</option>
              <option value="blocked">Blocked energy</option>
              <option value="delayed">Timing & delays</option>
              <option value="internalized">Internal process</option>
              <option value="contextual">Context-based</option>
              <option value="shadow">Shadow Integration (Jungian)</option>
              <option value="mirror">Mirror / reflection</option>
              <option value="potentialBlocked">Unrealized potential</option>
            </select>
            <p id="reversal-description" className="mt-2 text-xs text-muted">
              {reversalDescription}
              <span className="block">Applies to future readings only.</span>
            </p>
          </div>
        </SectionCard>

        {/* Privacy & Data Section - Auth only */}
        {isAuthenticated ? (
        <SectionCard title="Privacy & Data" icon={ShieldCheck} id="privacy" highlighted={highlightedSection === 'privacy'}>
          <div className="space-y-4">
            <p className="text-xs text-muted">
              We store your readings and analytics to sync across devices. Theme and audio settings stay on this device.
              You can export or delete your data anytime.
            </p>

            <div className="divide-y divide-secondary/20">
              <div
                id="analytics"
                tabIndex={-1}
                className={`scroll-mt-24 rounded-xl ${highlightedSection === 'analytics' ? 'ring-2 ring-accent/30' : ''}`}
              >
                <p id="analytics-heading" tabIndex={-1} data-section-heading="true" className="sr-only">
                  Archetype Journey analytics
                </p>
                <SettingsToggle
                  id="analytics-toggle"
                  label="Archetype Journey"
                  description="Track recurring cards and patterns across your readings"
                  enabled={analyticsEnabled}
                  loading={prefsLoading}
                  onChange={toggleAnalytics}
                  error={prefsError}
                />
                {prefsError && (
                  <button
                    type="button"
                    onClick={handleRetryAnalytics}
                    className="text-xs text-muted hover:text-main transition pb-2"
                  >
                    Retry
                  </button>
                )}
                <div className="mt-2 rounded-xl border border-secondary/20 bg-surface-muted/40 px-3 py-2">
                  <p className="text-xs text-muted">
                    Turning off stops new tracking; reset clears your existing history.
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setJourneyResetError(null);
                        setJourneyResetOpen(true);
                      }}
                      disabled={journeyResetLoading}
                      className={`text-xs font-semibold text-error hover:text-error/80 transition ${journeyResetLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                      Reset Journey data
                    </button>
                    {journeyResetError && (
                      <span className="text-xs text-error">{journeyResetError}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div
              id="export"
              tabIndex={-1}
              className={`
                pt-4 border-t border-secondary/20 scroll-mt-24 rounded-xl
                ${highlightedSection === 'export' ? 'ring-2 ring-accent/30' : ''}
              `}
            >
              <h3
                id="export-heading"
                tabIndex={-1}
                data-section-heading="true"
                className="text-xs uppercase tracking-wider text-muted mb-2"
              >
                Export
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportLoading || journalLoading}
                  className={`
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-secondary/50 bg-transparent px-4 py-2.5 text-xs font-semibold text-main
                    hover:bg-secondary/10 transition
                    ${exportLoading || journalLoading ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                >
                  <FileArrowDown className="h-4 w-4" />
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exportLoading || journalLoading}
                  className={`
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-secondary/50 bg-transparent px-4 py-2.5 text-xs font-semibold text-main
                    hover:bg-secondary/10 transition
                    ${exportLoading || journalLoading ? 'opacity-70 cursor-not-allowed' : ''}
                  `}
                >
                  <FileArrowDown className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
              {(exportLoading || journalLoading) && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <CircleNotch className="h-3.5 w-3.5 animate-spin text-accent" />
                  Preparing export…
                </div>
              )}
              {!exportLoading && !journalLoading && exportEntryCount !== null && (
                <p className="text-xs text-muted mt-2">Includes {exportEntryCount} entries.</p>
              )}
              {exportError && <p className="text-xs text-error mt-2">{exportError}</p>}
              {journalError && <p className="text-xs text-error mt-2">{journalError}</p>}
            </div>

            <div className="pt-4 border-t border-secondary/20">
              <p className="text-xs uppercase tracking-wider text-muted mb-2">Account data</p>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleDownloadAccountData}
                  className="
                    flex-1 inline-flex items-center justify-center gap-2 rounded-full
                    border border-secondary/50 bg-transparent px-4 py-2.5 text-xs font-semibold text-main
                    hover:bg-secondary/10 transition
                  "
                >
                  <DownloadSimple className="h-4 w-4" />
                  Download account data
                </button>
                <div className="flex-1 space-y-2">
                  {hasActiveSubscription && (
                    <div
                      className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <p className="text-amber-200">
                          Active subscription detected. Manage your subscription first to avoid future charges.
                        </p>
                        <button
                          type="button"
                          onClick={handleManageSubscription}
                          disabled={portalLoading}
                          className={`inline-flex items-center gap-1 font-semibold underline underline-offset-2 transition hover:text-amber-100 text-amber-100 ${
                            portalLoading ? 'opacity-60 cursor-not-allowed' : ''
                          }`}
                        >
                          {portalLoading && (
                            <CircleNotch className="h-3 w-3 animate-spin" weight="bold" />
                          )}
                          Manage subscription
                        </button>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="
                      w-full inline-flex items-center justify-center gap-2 rounded-full
                      border border-error/40 bg-error/10 px-4 py-2.5 text-xs font-semibold text-error
                      hover:bg-error/20 transition
                    "
                  >
                    <Trash className="h-4 w-4" />
                    Delete account
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted mt-2">
                Deleting your account removes your synced journal, analytics, and memories. This cannot be undone.
              </p>
            </div>
          </div>
        </SectionCard>
        ) : (
          <LockedSectionCard
            title="Privacy & Data"
            icon={ShieldCheck}
            id="privacy"
            highlighted={highlightedSection === 'privacy'}
            description="Sign in to manage analytics, exports, and account data controls."
            onAction={() => setShowAuthModal(true)}
          />
        )}

        {/* Reader Memory Section - Auth only */}
        {isAuthenticated && <MemoryManager />}

        {/* Actions Section - Auth only */}
        {isAuthenticated && (
        <SectionCard id="actions" highlighted={highlightedSection === 'actions'}>
          <div className="space-y-1">
            <button
              type="button"
              onClick={handleReplayTutorial}
              className="
                w-full flex items-center gap-3 px-2 py-3 -mx-2 rounded-xl
                text-sm text-main hover:bg-accent/5 active:bg-accent/10
                transition touch-manipulation text-left
              "
            >
              <BookOpen className="h-5 w-5 text-accent" />
              <span>Replay Tutorial</span>
              <CaretRight className="h-4 w-4 text-muted ml-auto" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="
                w-full flex items-center gap-3 px-2 py-3 -mx-2 rounded-xl
                text-sm text-main hover:bg-accent/5 active:bg-accent/10
                transition touch-manipulation text-left
              "
            >
              <SignOut className="h-5 w-5 text-accent" />
              <span>Sign Out</span>
              <CaretRight className="h-4 w-4 text-muted ml-auto" />
            </button>
          </div>
        </SectionCard>
        )}

        <ConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => setDeleteModalOpen(false)}
          onConfirm={handleDeleteAccount}
          title="Delete account?"
          message={
            hasActiveSubscription
              ? `⚠️ Deleting your account does not cancel your subscription billing. Please manage your subscription ${isStoreProvider ? `in ${providerLabel}` : 'first'} to avoid future charges.\n\nThis permanently deletes your synced journal, analytics, and memories.`
              : "This permanently deletes your synced journal, analytics, and memories. You will lose access immediately."
          }
          confirmText={deleteLoading ? 'Deleting...' : 'Delete account'}
          cancelText="Keep account"
          variant="danger"
        />

        <ConfirmModal
          isOpen={journeyResetOpen}
          onClose={() => setJourneyResetOpen(false)}
          onConfirm={handleResetJourney}
          title="Reset Journey data?"
          message="This clears your Archetype Journey history. Turning off stops new tracking; reset removes past insights."
          confirmText={journeyResetLoading ? 'Resetting…' : 'Reset Journey'}
          cancelText="Keep data"
          variant="danger"
          confirming={journeyResetLoading}
          error={journeyResetError}
          closeOnConfirm={false}
        />

        <ConfirmModal
          isOpen={tutorialResetOpen}
          onClose={() => setTutorialResetOpen(false)}
          onConfirm={confirmReplayTutorial}
          title="Replay tutorial?"
          message="This restarts the onboarding walkthrough and tips."
          confirmText="Replay tutorial"
          cancelText="Cancel"
        />

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} initialMode={authModalMode} />

        {/* Back to Reading */}
        <div className="text-center pt-4">
          <Link
            to="/"
            className="text-sm text-muted hover:text-accent transition"
          >
            Back to Reading
          </Link>
        </div>
      </main>
    </div>
  );
}
