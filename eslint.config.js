import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.astro/**',
      'src/content/**',
      'data/raw/soupispamatek/pages/**',
      'scripts/import-soupispamatek.mjs',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2024,
      },
    },
  },
];
