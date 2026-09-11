/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fae: {
          900: '#0b2545',
          800: '#13315c',
          700: '#1b4079',
          600: '#2a6f97',
          100: '#dbe9f4',
        },
      },
    },
  },
  plugins: [],
}
