const defaultTheme = require('tailwindcss/defaultTheme')

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
    screens: {
      'xs': '375px',
      ...defaultTheme.screens,
    },
    extend: {
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
        accent: 'var(--text-accent)',
        surface: 'var(--color-charcoal)', // high-contrast text for light CTA backgrounds
      },
      fontSize: {
        'xs-plus': '0.8125rem', // 13px - improved mobile readability
      },
      fontFamily: {
        serif: ["serif"],
        sans: ["system-ui", "sans-serif"]
      },
      backdropBlur: {
        xs: "2px"
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        popIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(1rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        inkSpread: {
          '0%': {
            opacity: '0',
            filter: 'blur(12px)',
            transform: 'scale(0.95)',
          },
          '40%': {
            opacity: '0.5',
            filter: 'blur(6px)',
            transform: 'scale(0.98)',
          },
          '100%': {
            opacity: '1',
            filter: 'blur(0px)',
            transform: 'scale(1)',
          },
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pop-in': 'popIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out forwards',
        'ink-spread': 'inkSpread 1.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography")
  ]
};
