/**
 * Tailwind configuration for Mystic Tarot (Vite + React + Cloudflare Pages).
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
      fontFamily: {
        serif: ["serif"],
        sans: ["system-ui", "sans-serif"]
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/typography")
  ]
};