/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Geist', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        canvas: v('canvas'),
        surface: v('surface'),
        raised: v('raised'),
        line: v('line'),
        ink: v('ink'),
        muted: v('muted'),
        faint: v('faint'),
        accent: v('accent'),
        'accent-soft': v('accent-soft'),
        good: v('good'),
        warn: v('warn'),
        bad: v('bad'),
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        pop: '0 1px 2px rgb(var(--shadow) / 0.06), 0 8px 24px -6px rgb(var(--shadow) / 0.18)',
      },
    },
  },
  plugins: [],
};
