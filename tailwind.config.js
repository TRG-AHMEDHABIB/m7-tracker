/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        sans: ['"Inter Tight"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: '#0a0a0b',
        paper: '#f5f1e8',
        accent: '#d64545',
        muted: '#6b6661',
        line: '#1f1d1a',
      },
    },
  },
  plugins: [],
};
