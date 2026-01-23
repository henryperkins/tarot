import defaultTheme from 'tailwindcss/defaultTheme';

/**
 * Tailwind configuration for Tableau (Vite + React + Cloudflare Pages).
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
        'sm-mobile': ['0.9375rem', { lineHeight: '1.5' }], // 15px - comfortable mobile body text
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', 'sans-serif']
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
      },
      margin: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
      },
      // Keyframes live in src/styles/tarot.css to keep the app + docs/theme-swatch.html in sync.
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'pop-in': 'popIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'ink-spread': 'inkSpread 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'float-gentle': 'floatGentle 6s ease-in-out infinite',
        'pulse-slow': 'pulseSlow 4s ease-in-out infinite',
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography")
  ]
};
