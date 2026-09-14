import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tailwindcss from './eslint-rules/index.js';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'dev-dist',
      'src-tauri',
      'playwright-report',
      'test-results',
      'src/routeTree.gen.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      tailwindcss,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // docs/DESIGN.md §3 — Arabic is a first-class layout.
      'tailwindcss/no-physical-properties': 'error',

      // CLAUDE.md — no `any` on Supabase rows (or anywhere else).
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // shadcn primitives intentionally co-export their cva variants.
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // CLAUDE.md — colours only via tokens/Tailwind theme, never a hex literal.
    files: ['src/components/**/*.{ts,tsx}', 'src/routes/**/*.{ts,tsx}', 'src/features/**/*.{ts,tsx}'],
    rules: {
      'tailwindcss/no-hex-colors': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'eslint-rules/**/*.js'],
    languageOptions: { globals: globals.node },
  },
);
