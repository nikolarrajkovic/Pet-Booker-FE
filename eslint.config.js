/* eslint-env node */
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

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
    },
  },
]);
