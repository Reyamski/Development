/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        par: {
          purple: '#6864d1',
          orange: '#ff5719',
          navy: '#303451',
          text: '#212438',
          'light-purple': '#e1e0f7',
          'light-blue': '#8c9fff',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        mono: [
          'JetBrains Mono',
          'Fira Code',
          'Cascadia Code',
          'ui-monospace',
          'Segoe UI Mono',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        qh: '0 1px 2px rgba(48, 52, 81, 0.05), 0 8px 28px rgba(104, 100, 209, 0.09)',
        'qh-sm': '0 1px 3px rgba(48, 52, 81, 0.06), 0 2px 8px rgba(104, 100, 209, 0.06)',
        'qh-inset': 'inset 0 1px 2px rgba(48, 52, 81, 0.05)',
      },
    },
  },
  plugins: [],
};
