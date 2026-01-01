import { useMemo } from 'react';
import { Tooltip } from './Tooltip';

function clampNumber(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function MoonPhaseDisk({ illumination, isWaxing, className = '' }) {
  const illum = clampNumber(illumination, 0, 100);
  const fraction = illum / 100;

  // Simple geometric approximation:
  // - draw a full lit disc
  // - overlay a dark disc shifted left/right to mimic waxing/waning
  const r = 10;
  const maxShift = 22; // slightly > 2r so "Full" fully reveals
  const shift = fraction * maxShift;
  const darkCx = 12 + (isWaxing ? -shift : shift);

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r={r} fill="var(--text-muted-high)" opacity="0.85" />
      <circle cx={darkCx} cy="12" r={r} fill="var(--bg-main)" />
      <circle cx="12" cy="12" r={r} fill="none" stroke="var(--border-warm-subtle)" strokeWidth="1" opacity="0.9" />
    </svg>
  );
}

/**
 * MoonPhaseIndicator
 *
 * Renders a small lunar icon + label sourced from the server ephemeris snapshot
 * captured at narrative-generation time.
 */
export function MoonPhaseIndicator({ ephemeris, variant = 'compact' }) {
  const moon = ephemeris?.available ? ephemeris?.moonPhase : null;

  const tooltip = useMemo(() => {
    if (!moon) return '';
    const illum = typeof moon.illumination === 'number' ? `${moon.illumination}%` : '—';
    const sign = moon.sign ? ` in ${moon.sign}` : '';
    const interp = moon.interpretation ? `\n\n${moon.interpretation}` : '';
    return `Moon: ${moon.phaseName || 'Unknown'}${sign} (${illum} illuminated)${interp}`;
  }, [moon]);

  if (!moon || !moon.phaseName) {
    return null;
  }

  const isWaxing = moon.isWaxing !== false; // default to waxing when missing

  if (variant === 'icon') {
    return (
      <Tooltip content={tooltip} position="bottom" ariaLabel="Moon phase details">
        <span className="inline-flex items-center justify-center min-h-[36px] min-w-[36px] rounded-full border border-secondary/30 bg-surface/60">
          <MoonPhaseDisk illumination={moon.illumination} isWaxing={isWaxing} className="h-5 w-5" />
        </span>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip} position="bottom" ariaLabel="Moon phase details">
      <span className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-surface/60 px-3 py-1.5 text-xs text-muted-high">
        <MoonPhaseDisk illumination={moon.illumination} isWaxing={isWaxing} className="h-[18px] w-[18px]" />
        <span className="hidden xs:inline">{moon.phaseName}</span>
      </span>
    </Tooltip>
  );
}
