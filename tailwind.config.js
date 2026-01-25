import defaultTheme from 'tailwindcss/defaultTheme';

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
        primary: 'var(--brand-primary)',
        secondary: 'var(--brand-secondary)',
        accent: 'var(--brand-accent)',
        success: 'var(--status-success)',
        error: 'var(--status-error)',
      },
      backgroundColor: {
        main: 'var(--bg-main)',
        surface: 'var(--bg-surface)',
        'surface-muted': 'var(--bg-surface-muted)',
      },
      textColor: {
        main: 'var(--text-main)',
        muted: 'var(--text-muted)',
        'muted-high': 'var(--text-muted-high)', // Higher contrast muted for translucent backgrounds
        accent: 'var(--text-accent)',
        surface: 'var(--text-on-brand)', // text color chosen for brand surfaces
      },
      fontSize: {
        'xs-plus': ['0.875rem', { lineHeight: '1.4' }], // 14px - improved mobile readability
        'sm-mobile': ['var(--text-sm-mobile)', { lineHeight: '1.5' }], // 15px - comfortable mobile body text
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
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
        'safe-t': 'env(safe-area-inset-top, 0px)',
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
      },
      margin: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
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
          'padding-left': 'env(safe-area-inset-left, 0px)',
          'padding-right': 'env(safe-area-inset-right, 0px)',
        },
        '.py-safe': {
          'padding-top': 'env(safe-area-inset-top, 0px)',
          'padding-bottom': 'env(safe-area-inset-bottom, 0px)',
        },
        '.pt-safe': {
          'padding-top': 'env(safe-area-inset-top, 0px)',
        },
        '.pb-safe': {
          'padding-bottom': 'max(1rem, env(safe-area-inset-bottom, 0px))',
        },
      });
    }
  ]
};
