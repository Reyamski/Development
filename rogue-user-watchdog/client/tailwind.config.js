/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        qh: '0 1px 3px 0 rgb(104 100 209 / 0.08), 0 4px 12px -2px rgb(48 52 81 / 0.06)',
      },
    },
  },
  plugins: [],
}
