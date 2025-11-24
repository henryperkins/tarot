import PropTypes from 'prop-types';

/**
 * Tableu Logo Component
 *
 * Renders the Tableu logo SVG sprite in various formats.
 *
 * @param {Object} props
 * @param {'primary'|'icon'|'mono'|'dark'|'favicon'|'full'} props.variant - Logo variant to display
 * @param {number|string} props.size - Width/height in pixels (for square variants) or width (for full)
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.color - Custom color override (CSS color value)
 * @param {string} props.ariaLabel - Accessible label for screen readers
 *
 * @example
 * <TableuLogo variant="primary" size={160} />
 * <TableuLogo variant="icon" size={48} className="header-logo" />
 * <TableuLogo variant="dark" size={200} />
 * <TableuLogo variant="favicon" size={32} />
 * <TableuLogo variant="full" size={300} /> // includes wordmark
 */
export function TableuLogo({
  variant = 'primary',
  size = 160,
  className = '',
  color,
  ariaLabel = 'Tableu Logo',
  outline = false,
  glow = false,
  useRaster = false,
  rasterSrc = '/images/tableu-logo.png'
}) {
  // Determine viewBox based on variant
  const viewBoxMap = {
    // Slight padding to prevent stroke/letter clipping when referenced via <use>
    primary: '-12 -12 456 600',
    icon: '-12 -12 456 600',
    mono: '-12 -12 456 600',
    dark: '-12 -12 456 600',
    favicon: '-10 -10 220 270',
    full: '-12 -12 456 744'
  };

  // Calculate dimensions
  const viewBox = viewBoxMap[variant] || viewBoxMap.primary;
  const [, , vbWidth, vbHeight] = viewBox.split(' ').map(Number);
  const aspectRatio = vbHeight / vbWidth;

  // For full logo with wordmark, treat size as width
  const width = variant === 'full' ? size : size;
  const height = variant === 'full' ? size * aspectRatio : size;

  // Build style object
  const style = color ? { color } : undefined;

  const classes = [
    'tableu-logo',
    outline ? 'tableu-logo--outline' : null,
    glow ? 'tableu-logo--glow' : null,
    className
  ]
    .filter(Boolean)
    .join(' ');

  if (useRaster) {
    const width = variant === 'full' ? size : size;
    const height = variant === 'full' ? size * aspectRatio : size;
    return (
      <img
        src={rasterSrc}
        width={width}
        height={height}
        className={classes}
        style={{ objectFit: 'contain', display: 'block', ...style }}
        alt={ariaLabel}
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={viewBox}
      overflow="visible"
      preserveAspectRatio="xMidYMid meet"
      className={classes}
      style={style}
      aria-label={ariaLabel}
      role="img"
    >
      <use href={`#tableu-${variant}`} />
    </svg>
  );
}

TableuLogo.propTypes = {
  variant: PropTypes.oneOf(['primary', 'icon', 'mono', 'dark', 'favicon', 'full']),
  size: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  color: PropTypes.string,
  ariaLabel: PropTypes.string,
  outline: PropTypes.bool,
  glow: PropTypes.bool,
  useRaster: PropTypes.bool,
  rasterSrc: PropTypes.string
};
