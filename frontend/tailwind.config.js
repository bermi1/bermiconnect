/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#201F5B', 50: '#EEEEF8', 100: '#DCDCF0', 200: '#B7B6DF', 500: '#33318A', 600: '#201F5B', 700: '#19184B', 800: '#13123A', 900: '#0C0B27' },
        amber: { DEFAULT: '#F5A524', 50: '#FEF6E7', 100: '#FDEBC8', 400: '#F7B54A', 500: '#F5A524', 600: '#D98A0B', 700: '#A86A07' },
        ink: { DEFAULT: '#0E0D2A', 700: '#2A2948', 500: '#5C5B77', 400: '#84839B', 300: '#B2B1C4' },
        paper: '#F6F6FA',
        line: '#E3E3EE',
        ok: '#0A8C6C',
        bad: '#D9473F',
      },
      fontFamily: {
        sans: ['Gabarito', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        lift: '0 1px 0 rgba(14,13,42,.04), 0 8px 24px -12px rgba(14,13,42,.2)',
        bubble: '0 2px 0 #19184B',
      },
      keyframes: {
        rise: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pop: { from: { opacity: '0', transform: 'scale(.94) translateY(-4px)' }, to: { opacity: '1', transform: 'none' } },
      },
      transitionTimingFunction: { spring: 'cubic-bezier(.34,1.56,.64,1)', out: 'cubic-bezier(.22,1,.36,1)' },
      animation: { rise: 'rise .35s ease-out both', pop: 'pop .32s cubic-bezier(.34,1.56,.64,1) both' },
    },
  },
  plugins: [],
};
