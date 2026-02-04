import { CheckCircle, WarningCircle, XCircle, Info } from '@phosphor-icons/react';

const TONE_STYLES = {
  success: {
    icon: CheckCircle,
    className: 'text-success'
  },
  warning: {
    icon: WarningCircle,
    className: 'text-warning'
  },
  error: {
    icon: XCircle,
    className: 'text-error'
  },
  info: {
    icon: Info,
    className: 'text-secondary'
  },
  pending: {
    icon: Info,
    className: 'text-secondary'
  }
};

/**
 * Determine the appropriate aria-live value based on tone.
 * Errors and warnings use 'assertive' for immediate announcement.
 * Other tones use 'polite' to avoid interrupting the user.
 */
function getDefaultLive(tone) {
  return tone === 'error' || tone === 'warning' ? 'assertive' : 'polite';
}

export function InlineStatus({ tone = 'info', message, live, className = '' }) {
  if (!message) return null;

  const toneConfig = TONE_STYLES[tone] || TONE_STYLES.info;
  const Icon = toneConfig.icon || Info;
  // Use provided live prop, or auto-select based on tone
  const ariaLive = live ?? getDefaultLive(tone);

  return (
    <div
      role="status"
      aria-live={ariaLive}
      className={`flex items-center gap-2 text-xs font-semibold ${toneConfig.className} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
