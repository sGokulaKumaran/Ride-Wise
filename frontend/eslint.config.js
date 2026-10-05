import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // dist             build output
  // .kilo / .claude  other tools' working copies of this project — linting
  //                  them reported dozens of "errors" that are not in this code
  globalIgnores(['dist', '.kilo', '.claude']),

  // The app itself: runs in the browser
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // Files that run in Node: the Vite config, the unit tests (node --test)
  // and the small check scripts
  {
    files: ['vite.config.js', '**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
])
