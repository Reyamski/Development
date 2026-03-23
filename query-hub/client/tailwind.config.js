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
      },
    },
  },
  plugins: [],
};
