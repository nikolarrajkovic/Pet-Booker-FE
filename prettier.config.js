module.exports = {
  printWidth: 100,
  tabWidth: 2,
  singleQuote: true,
  bracketSameLine: true,
  trailingComma: 'es5',

  // The working tree is CRLF (a Windows checkout with git's autocrlf), while Prettier's default
  // is 'lf' — so `prettier -c` rejected all 232 files in the repo on a clean checkout, and the
  // `npm run lint` gate could never pass for anyone. 'auto' takes each file's existing ending as
  // correct, which fixes the gate without a 232-file reformat that would bury every real diff.
  endOfLine: 'auto',

  plugins: [require.resolve('prettier-plugin-tailwindcss')],
  tailwindAttributes: ['className'],
};
