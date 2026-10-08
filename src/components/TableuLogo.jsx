import PropTypes from 'prop-types';
import {
  TABLEU_MARK_VIEWBOX, TABLEU_MARK_SIZE, TABLEU_LOGO_WIDTH,
  tableuMarkPaths, tableuWordmarkPaths
} from '../../shared/brand/tableuMark';

/** The shared vector emblem and horizontal wordmark, colored by the active theme. */
export function TableuLogo({
  variant = 'primary',
  size = 160,
  className = '',
  color,
  ariaLabel = 'Tableu',
  decorative = false
}) {
  const full = variant === 'full';
  const numericSize = typeof size === 'number';
  const resolvedColor = color || (variant === 'mono' ? '#1A1A1A' : variant === 'dark' ? '#E8DAC3' : undefined);

  return (
    <svg
      width={size}
      height={full ? (numericSize ? size * TABLEU_MARK_SIZE / TABLEU_LOGO_WIDTH : undefined) : size}
      viewBox={full ? `0 0 ${TABLEU_LOGO_WIDTH} ${TABLEU_MARK_SIZE}` : TABLEU_MARK_VIEWBOX}
      preserveAspectRatio="xMidYMid meet"
      className={`tableu-logo ${className}`}
      style={resolvedColor ? { color: resolvedColor } : undefined}
      fill="currentColor"
      aria-label={decorative ? undefined : ariaLabel}
      aria-hidden={decorative ? 'true' : undefined}
      role={decorative ? undefined : 'img'}
      focusable="false"
    >
      {tableuMarkPaths().map((path, index) => (
        <path key={index} {...path} />
      ))}
      {full && tableuWordmarkPaths().map((path, index) => (
        <path key={`wordmark-${index}`} {...path} />
      ))}
    </svg>
  );
}

TableuLogo.propTypes = {
  variant: PropTypes.oneOf(['primary', 'icon', 'mono', 'dark', 'favicon', 'full']),
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  color: PropTypes.string,
  ariaLabel: PropTypes.string,
  decorative: PropTypes.bool
};
