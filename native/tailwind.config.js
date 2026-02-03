module.exports = {
  presets: [require('nativewind/preset')],
  content: ['./App.jsx', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        main: '#1a1a2e',
        surface: '#222340',
        'surface-muted': '#2b2c4a',
        ink: '#e8d5b7',
        'ink-muted': '#cbb79d',
        'ink-accent': '#f1e6c8',
        gold: '#c9a227',
        'gold-muted': '#9c7c1c',
        primary: '#c9a227',
        error: '#d66b6b',
        success: '#6bbf8e'
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Georgia', 'serif'],
        sans: ['Inter', 'System']
      }
    }
  },
  plugins: []
};
