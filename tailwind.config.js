/** @type {import('tailwindcss').Config} */
module.exports = {
  // Every folder that can hold a Tailwind class name, not just the ones that hold JSX.
  //
  // `hooks/useThemeColors.ts` is the app palette and it returns *class names*, so a token defined
  // only there (`bg-[#F1F8F4]`) got no CSS rule generated and silently resolved to transparent.
  // That is what let scrolled content show through ScreenLayout sheet and over the green header.
  // The other eleven tokens in that file worked purely because the same literal happened to be
  // typed somewhere under screens/ or components/ as well.
  //
  // A class-name string is data; it does not have to sit next to a `className` prop. Keep this
  // list matching the source folders --- `__tests__/responsive/tailwindContent.test.ts` fails
  // when a folder holding class names is missing from it.
  content: [
    './App.{js,ts,tsx}',
    './components/**/*.{js,ts,tsx}',
    './screens/**/*.{js,ts,tsx}',
    './hooks/**/*.{js,ts,tsx}',
    './context/**/*.{js,ts,tsx}',
    './navigation/**/*.{js,ts,tsx}',
    './services/**/*.{js,ts,tsx}',
  ],

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
