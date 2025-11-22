import React from 'react';
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
 */

// Semantic size scale mapping to Tailwind classes
const SIZE_MAP = {
  xs: 'w-3 h-3',      // 12px - tiny inline icons
  sm: 'w-3.5 h-3.5',  // 14px - small inline icons
  md: 'w-4 h-4',      // 16px - standard icons (default)
  lg: 'w-5 h-5',      // 20px - prominent icons
  xl: 'w-6 h-6',      // 24px - large interactive icons
  '2xl': 'w-8 h-8',   // 32px - hero/feature icons
};

// Phosphor icon weight variants
// See: https://phosphoricons.com/
const WEIGHTS = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];

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

  /** Semantic size scale */
  size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl']),

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

/**
 * Icon Size Constants
 * Use these for consistent sizing throughout the app
 */
export const ICON_SIZES = {
  xs: 'xs',   // 12px - tiny inline
  sm: 'sm',   // 14px - small inline
  md: 'md',   // 16px - standard (default)
  lg: 'lg',   // 20px - prominent
  xl: 'xl',   // 24px - large interactive
  xxl: '2xl', // 32px - hero/feature
};

/**
 * Icon Weight Constants
 * Use these for semantic visual hierarchy
 */
export const ICON_WEIGHTS = {
  thin: 'thin',       // Delicate, minimal
  light: 'light',     // Subtle, secondary
  regular: 'regular', // Standard (default)
  bold: 'bold',       // Emphasis, primary actions
  fill: 'fill',       // Filled solid
  duotone: 'duotone', // Two-tone style
};
