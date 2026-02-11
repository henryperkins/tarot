import PropTypes from 'prop-types';

/**
 * Standardized Icon Wrapper for Phosphor Icons
 *
 * Provides consistent sizing, weights, and accessibility across the application.
 * Wraps Phosphor icon components with semantic size scales and proper ARIA attributes.
 *
 * @example
 * import { Sparkle } from '@phosphor-icons/react';
 * import { Icon } from './Icon';
 *
 * // Standard usage
 * <Icon icon={Sparkle} size="md" />
 *
 * // With custom props
 * <Icon icon={Sparkle} size="lg" weight="bold" label="Generate reading" />
 *
 * // Decorative icon (hidden from screen readers)
 * <Icon icon={Sparkle} size="sm" decorative />
 *
 * // Responsive size - larger on mobile for better touch targets
 * <Icon icon={Sparkle} size="md-touch" decorative />
 */

// Semantic size scale mapping to Tailwind classes
const SIZE_MAP = {
  // Fixed sizes
  xs: 'w-3 h-3',           // 12px - tiny inline icons
  sm: 'w-3.5 h-3.5',       // 14px - small inline icons
  md: 'w-4 h-4',           // 16px - standard icons (default)
  lg: 'w-5 h-5',           // 20px - prominent icons
  xl: 'w-6 h-6',           // 24px - large interactive icons
  '2xl': 'w-8 h-8',        // 32px - hero/feature icons

  // Responsive sizes - larger on mobile, smaller on desktop
  // Use these for interactive elements that need bigger touch targets
  'xs-touch': 'w-3.5 h-3.5 sm:w-3 sm:h-3',       // 14px mobile, 12px desktop
  'sm-touch': 'w-4 h-4 sm:w-3.5 sm:h-3.5',       // 16px mobile, 14px desktop
  'md-touch': 'w-5 h-5 sm:w-4 sm:h-4',           // 20px mobile, 16px desktop
  'lg-touch': 'w-6 h-6 sm:w-5 sm:h-5',           // 24px mobile, 20px desktop
  'xl-touch': 'w-7 h-7 sm:w-6 sm:h-6',           // 28px mobile, 24px desktop

  // Responsive sizes - smaller on mobile, larger on desktop
  // Use these for decorative icons that can be smaller on constrained screens
  'sm-responsive': 'w-3 h-3 sm:w-3.5 sm:h-3.5',  // 12px mobile, 14px desktop
  'md-responsive': 'w-3.5 h-3.5 sm:w-4 sm:h-4',  // 14px mobile, 16px desktop
  'lg-responsive': 'w-4 h-4 sm:w-5 sm:h-5',      // 16px mobile, 20px desktop
  'xl-responsive': 'w-5 h-5 sm:w-6 sm:h-6',      // 20px mobile, 24px desktop
};

// Phosphor icon weight variants
// See: https://phosphoricons.com/
const WEIGHTS = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];

// All valid size keys for PropTypes
const VALID_SIZES = Object.keys(SIZE_MAP);

export function Icon({
  icon: IconComponent,
  size = 'md',
  weight = 'regular',
  className = '',
  label,
  decorative = false,
  color,
  mirrored = false,
  ...props
}) {
  // Validate size
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  // Build className
  const classes = [
    sizeClass,
    mirrored && 'scale-x-[-1]',
    className
  ].filter(Boolean).join(' ');

  // Accessibility attributes
  const a11yProps = decorative
    ? { 'aria-hidden': 'true' }
    : label
    ? { 'aria-label': label, role: 'img' }
    : {};

  return (
    <IconComponent
      className={classes}
      weight={weight}
      color={color}
      mirrored={mirrored}
      {...a11yProps}
      {...props}
    />
  );
}

Icon.propTypes = {
  /** The Phosphor icon component to render */
  icon: PropTypes.elementType.isRequired,

  /** Semantic size scale - use -touch variants for interactive elements on mobile */
  size: PropTypes.oneOf(VALID_SIZES),

  /** Icon weight variant */
  weight: PropTypes.oneOf(WEIGHTS),

  /** Additional CSS classes */
  className: PropTypes.string,

  /** Accessible label (required unless decorative=true) */
  label: PropTypes.string,

  /** If true, icon is decorative and hidden from screen readers */
  decorative: PropTypes.bool,

  /** Icon color (CSS color value) */
  color: PropTypes.string,

  /** If true, flip icon horizontally */
  mirrored: PropTypes.bool,
};

