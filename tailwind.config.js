import defaultTheme from 'tailwindcss/defaultTheme';

const SAFE_PAD_TOP = 'var(--safe-pad-top, 0px)';
const SAFE_PAD_BOTTOM = 'var(--safe-pad-bottom, 0px)';
const SAFE_PAD_LEFT = 'var(--safe-pad-left, 0px)';
const SAFE_PAD_RIGHT = 'var(--safe-pad-right, 0px)';
const SAFE_INSET_TOP = `max(0.75rem, ${SAFE_PAD_TOP})`;
const SAFE_INSET_BOTTOM = `max(1rem, ${SAFE_PAD_BOTTOM})`;
const SAFE_INSET_LEFT = `max(1rem, ${SAFE_PAD_LEFT})`;
const SAFE_INSET_RIGHT = `max(1rem, ${SAFE_PAD_RIGHT})`;

/**
 * Tailwind configuration for Tableu (Vite + React + Cloudflare Pages).
 *
 * This replaces the previous cdn.tailwindcss.com usage.
 * Vite will use this during `npm run dev` and `npm run build` to generate the utilities.
 */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    borderRadius: {
      none: '0px',
      sm: '0.25rem',
      DEFAULT: '0.375rem',
      md: '0.5rem',
      lg: '0.625rem',
      xl: '0.75rem',
      '2xl': '0.875rem',
      '3xl': '1rem',
      full: '9999px'
    },
    screens: {
      'xxs': '320px',
      'xs': '375px',
      // Max-width mobile screens to mirror CSS breakpoints.
      'mobile-sm': { max: '360px' },
      'mobile-md': { max: '400px' },
      'mobile-lg': { max: '440px' },
      ...defaultTheme.screens,
    },
    extend: {
      screens: {
        // Landscape detection (for short landscape viewports)
        'landscape': { 'raw': '(orientation: landscape) and (max-height: 500px)' },
        'portrait': { 'raw': '(orientation: portrait)' },
        // Short viewport (useful for foldables and small tablets in landscape)
        'short': { 'raw': '(max-height: 600px)' },
      },
      colors: {
        // Elegant Minimal Palette
        charcoal: 'var(--color-charcoal)',
        slate: {
          dark: 'var(--color-slate-dark)',
          mid: 'var(--color-slate-mid)',
          light: 'var(--color-slate-light)',
        },
        gray: {
          light: 'var(--color-gray-light)',
          pale: 'var(--color-gray-pale)',
        },
        gold: {
          DEFAULT: 'var(--color-gold-champagne)',
          champagne: 'var(--color-gold-champagne)',
          muted: 'var(--color-gold-muted)',
          soft: 'var(--color-gold-soft)',
        },
        silver: 'var(--color-silver)',

        // Suit Colors
        wands: 'var(--color-wands)',
        cups: 'var(--color-cups)',
        swords: 'var(--color-swords)',
        pentacles: 'var(--color-pentacles)',

        // Semantic Brand Colors
        primary: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--brand-secondary-rgb) / <alpha-value>)',
        accent: 'rgb(var(--brand-accent-rgb) / <alpha-value>)',
        success: 'rgb(var(--status-success-rgb) / <alpha-value>)',
        warning: 'rgb(var(--status-warning-rgb) / <alpha-value>)',
        error: 'rgb(var(--status-error-rgb) / <alpha-value>)',
      },
      backgroundColor: {
        main: 'rgb(var(--bg-main-rgb) / <alpha-value>)',
        surface: 'rgb(var(--bg-surface-rgb) / <alpha-value>)',
        'surface-muted': 'rgb(var(--bg-surface-muted-rgb) / <alpha-value>)',
      },
      textColor: {
        main: 'rgb(var(--text-main-rgb) / <alpha-value>)',
        muted: 'rgb(var(--text-muted-rgb) / <alpha-value>)',
        'muted-high': 'rgb(var(--text-muted-high-rgb) / <alpha-value>)', // Higher contrast muted for translucent backgrounds
        accent: 'rgb(var(--brand-primary-rgb) / <alpha-value>)',
        surface: 'rgb(var(--text-on-brand-rgb) / <alpha-value>)', // text color chosen for brand surfaces
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1.4' }], // 11px - Apple HIG minimum text size; use ONLY for non-essential, non-interactive UI labels or metadata, never for body text or interactive elements (accessibility constraint)
        'xs-plus': ['0.875rem', { lineHeight: '1.4' }], // 14px - improved mobile readability
        'sm-mobile': ['var(--text-sm-mobile)', { lineHeight: '1.5' }], // 16px - comfortable mobile body text
      },
      minHeight: {
        touch: 'var(--touch-target, 44px)',
        cta: 'var(--touch-target-cta, 52px)',
      },
      minWidth: {
        touch: 'var(--touch-target, 44px)',
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif']
      },
      backdropBlur: {
        xs: "2px"
      },
      // Safe area utilities for modern mobile devices
      padding: {
        'safe-top': SAFE_INSET_TOP,
        'safe-bottom': SAFE_INSET_BOTTOM,
        'safe-left': SAFE_INSET_LEFT,
        'safe-right': SAFE_INSET_RIGHT,
        'safe-t': SAFE_INSET_TOP,
        'safe-b': SAFE_INSET_BOTTOM,
      },
      margin: {
        'safe-top': SAFE_PAD_TOP,
        'safe-bottom': SAFE_PAD_BOTTOM,
        'safe-left': SAFE_PAD_LEFT,
        'safe-right': SAFE_PAD_RIGHT,
      },
      // Keyframes live in src/styles/tarot.css to keep the app + docs/theme-swatch.html in sync.
      animation: {
        'fade-in': 'fadeIn var(--duration-normal) var(--ease-out)',
        'slide-up': 'slideUp var(--duration-medium) var(--ease-out)',
        'slide-down': 'slideDown var(--duration-normal) var(--ease-out)',
        'pop-in': 'popIn var(--duration-normal) var(--ease-out)',
        'slide-in-right': 'slideInRight var(--duration-medium) var(--ease-out)',
        'fade-in-up': 'fadeInUp var(--duration-slower) var(--ease-out) forwards',
        'ink-spread': 'inkSpread var(--duration-slow) var(--ease-out) forwards',
        'float-gentle': 'floatGentle 6s ease-in-out infinite',
        'pulse-slow': 'pulseSlow 4s ease-in-out infinite',
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography"),
    function({ addUtilities }) {
      addUtilities({
        '.px-safe': {
          'padding-left': SAFE_INSET_LEFT,
          'padding-right': SAFE_INSET_RIGHT,
        },
        '.py-safe': {
          'padding-top': SAFE_INSET_TOP,
          'padding-bottom': SAFE_INSET_BOTTOM,
        },
        '.pt-safe': {
          'padding-top': SAFE_INSET_TOP,
        },
        '.pb-safe': {
          'padding-bottom': SAFE_INSET_BOTTOM,
        },
      });
    }
  ]
};
