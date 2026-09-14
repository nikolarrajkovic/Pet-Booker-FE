/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'react/display-name': 'off',
    },
  },
  {
    // Jest hoists `jest.mock(...)` calls above the imports, so a test file has to declare its
    // mocks before importing the module under test. That is the required order, not a mistake.
    files: ['__tests__/**/*.{ts,tsx}'],
    rules: {
      'import/first': 'off',
      // A test that asserts on module *loading* — resetting modules and re-reading a file to see
      // what it exports under different conditions — has to use `require()`. A static import is
      // hoisted and evaluated once, which is exactly the thing being tested.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    // Flat config does not read `/* eslint-env jest */` comments — that directive was dropped
    // when ESLint moved to this format, so the one at the top of `jest.setup.js` had been doing
    // nothing and every `jest.*` call in the test files reported as an undefined global. Which
    // meant `npm run lint` failed on a clean checkout, so nothing it said could be acted on.
    files: ['__tests__/**/*.{ts,tsx}', 'jest.setup.js', 'jest.config.js'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
  },
]);
