/**
 * Icon Size Constants
 * Use these for consistent sizing throughout the app
 *
 * Fixed sizes: xs, sm, md, lg, xl, xxl
 * Touch-friendly (larger on mobile): xsTouch, smTouch, mdTouch, lgTouch, xlTouch
 * Responsive (smaller on mobile): smResponsive, mdResponsive, lgResponsive, xlResponsive
 */
export const ICON_SIZES = {
  // Fixed sizes
  xs: 'xs',     // 12px - tiny inline
  sm: 'sm',     // 14px - small inline
  md: 'md',     // 16px - standard (default)
  lg: 'lg',     // 20px - prominent
  xl: 'xl',     // 24px - large interactive
  xxl: '2xl',   // 32px - hero/feature

  // Touch-friendly responsive (larger on mobile)
  xsTouch: 'xs-touch',   // 14px mobile → 12px desktop
  smTouch: 'sm-touch',   // 16px mobile → 14px desktop
  mdTouch: 'md-touch',   // 20px mobile → 16px desktop
  lgTouch: 'lg-touch',   // 24px mobile → 20px desktop
  xlTouch: 'xl-touch',   // 28px mobile → 24px desktop

  // Space-saving responsive (smaller on mobile)
  smResponsive: 'sm-responsive',  // 12px mobile → 14px desktop
  mdResponsive: 'md-responsive',  // 14px mobile → 16px desktop
  lgResponsive: 'lg-responsive',  // 16px mobile → 20px desktop
  xlResponsive: 'xl-responsive',  // 20px mobile → 24px desktop
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
