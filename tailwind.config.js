/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './components/**/*.{js,ts,tsx}', './screens/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Brand green palette tuned to match the screenshot
        brand: {
          50: '#E6FAF0',
          100: '#CFF5E3',
          200: '#9FEBC8',
          300: '#66E6A8',
          400: '#2CE07F',
          500: '#00C870',
          600: '#00A85A',
          700: '#007F42',
          800: '#005B33',
          900: '#003822',
        },
      },
    },
  },
  plugins: [],
};
