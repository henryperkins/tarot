import { useId, useMemo } from 'react';
import { Tooltip } from './Tooltip';

function clampNumber(value, min, max) {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function MoonPhaseDisk({ illumination, isWaxing, className = '' }) {
  const uid = useId();
  // React useId contains ':' which can be awkward in SVG url(#id) references.
  // Strip them for safety.
  const safeUid = String(uid).replace(/:/g, '');
  const maskId = `moon-mask-${safeUid}`;

  const illum = clampNumber(illumination, 0, 100);
  const fraction = illum / 100;

  // A lightweight, more accurate moon phase glyph:
  // - base dark disc
  // - illuminated disc masked by a terminator ellipse + half-plane logic
  //
  // We only have illumination% and waxing/waning.
  // Approximation based on the classic relation:
  //   illumination = (1 - cos(phaseAngle)) / 2
  // so:
  //   cos(phaseAngle) = 1 - 2 * illumination
  //
  // The projected terminator can be approximated by an ellipse with:
  //   rx = |cos(phaseAngle)| * r
  //   ry = r
  // centered on the disc.
  const cx = 12;
  const cy = 12;
  const r = 10;
  const cosPhase = 1 - 2 * fraction;
  const terminatorRx = Math.min(r, Math.max(0, Math.abs(cosPhase) * r));
  const EPS = 1e-3;

  const isNew = fraction <= EPS;
  const isFull = fraction >= 1 - EPS;
  const isQuarter = Math.abs(fraction - 0.5) <= EPS;
  const isCrescent = fraction < 0.5 - EPS;
  const isGibbous = fraction > 0.5 + EPS;

  // Waxing = light on the right, Waning = light on the left
  const lightOnRight = isWaxing !== false;
  const lightRect = lightOnRight
    ? { x: cx, width: 24 - cx }
    : { x: 0, width: cx };
  const shadowRect = lightOnRight
    ? { x: 0, width: cx }
    : { x: cx, width: 24 - cx };

  // Avoid rx=0 rendering oddities in some browsers when we actually draw the ellipse.
  const effectiveRx = Math.max(0.001, terminatorRx);

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          {/* default: hide */}
          <rect x="0" y="0" width="24" height="24" fill="black" />

          {isFull && (
            <circle cx={cx} cy={cy} r={r} fill="white" />
          )}

          {!isFull && !isNew && isQuarter && (
            <rect x={lightRect.x} y="0" width={lightRect.width} height="24" fill="white" />
          )}

          {/* Crescent: light half minus terminator ellipse */}
          {!isFull && !isNew && isCrescent && (
            <>
              <rect x={lightRect.x} y="0" width={lightRect.width} height="24" fill="white" />
              <ellipse cx={cx} cy={cy} rx={effectiveRx} ry={r} fill="black" />
            </>
          )}

          {/* Gibbous: full disc minus shadow-half, then restore the central ellipse */}
          {!isFull && !isNew && isGibbous && (
            <>
              <circle cx={cx} cy={cy} r={r} fill="white" />
              <rect x={shadowRect.x} y="0" width={shadowRect.width} height="24" fill="black" />
              <ellipse cx={cx} cy={cy} rx={effectiveRx} ry={r} fill="white" />
            </>
          )}
        </mask>
      </defs>

      {/* Base disc (shadow side) */}
      <circle cx={cx} cy={cy} r={r} fill="var(--bg-surface)" />

      {/* Illuminated portion */}
      {!isNew && (
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="var(--text-muted-high)"
          opacity="0.9"
          mask={`url(#${maskId})`}
        />
      )}

      {/* Rim */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border-warm-subtle)" strokeWidth="1" opacity="0.9" />
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
    const phaseName = moon.phaseName || 'Unknown';
    const illum = typeof moon.illumination === 'number' ? `${moon.illumination}%` : '—';
    const sign = moon.sign ? ` in ${moon.sign}` : '';
    const interp = moon.interpretation ? `\n\n${moon.interpretation}` : '';
    const disclaimer = '\n\nAstrology here is symbolic context, not a prediction.';
    // Newlines are rendered by Tooltip (whitespace-pre-line).
    return `Moon: ${phaseName}${sign}\nIllumination: ${illum}${interp}${disclaimer}\n\nCaptured at the moment your reading was generated.`;
  }, [moon]);

  if (!moon || !moon.phaseName) {
    return null;
  }

  const isWaxing = moon.isWaxing !== false; // default to waxing when missing

  if (variant === 'icon') {
    return (
      <Tooltip content={tooltip} position="bottom" ariaLabel="Moon phase details">
        <span className="inline-flex items-center justify-center min-h-touch min-w-touch rounded-full border border-secondary/30 bg-surface/60">
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
