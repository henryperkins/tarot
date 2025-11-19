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
        // Explicitly ensure the slate/amber/indigo palette used throughout is available.
        slate: {
          950: "#020817"
        },
        amber: {
          50: "#fffbeb",
          100: "#fef3c7",
          200: "#fde68a",
          300: "#fcd34d",
          400: "#fbbf24",
          500: "#f59e0b"
        },
        indigo: {
          900: "#312e81",
          950: "#1e1b4b"
        },
        purple: {
          900: "#581c87"
        }
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
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pop-in': 'popIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography")
  ]
};
