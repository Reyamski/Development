/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        par: {
          navy: '#0f1b2d',
          purple: '#7c3aed',
          'light-purple': '#a78bfa',
          'light-blue': '#67e8f9',
          orange: '#f97316',
          text: '#1e293b',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        par: '0 1px 3px 0 rgb(124 58 237 / 0.08), 0 4px 12px -2px rgb(15 27 45 / 0.06)',
        'par-glow': '0 0 0 3px rgb(124 58 237 / 0.15)',
        'glow-purple': '0 4px 20px rgba(124, 58, 237, 0.2)',
        'glow-red': '0 4px 20px rgba(249, 115, 22, 0.2)',
        'glow-yellow': '0 4px 20px rgba(245, 158, 11, 0.2)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
