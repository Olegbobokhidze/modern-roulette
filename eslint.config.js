// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * Conventions (AGENTS.md, ADR-0001):
 *  - No `enum` / `interface`: `as const` objects + `type` aliases.
 *  - Layers: config ← engine ← renderer / audio ← ui. Lower layers never import upper ones.
 *  - Only src/ui may use React. The engine is pure TypeScript with no DOM globals.
 */
const noEnumNoInterface = [
  { selector: 'TSEnumDeclaration', message: 'Use a `const X = {...} as const` object plus a derived union type instead of `enum`.' },
  { selector: 'TSInterfaceDeclaration', message: 'Use a `type` alias instead of `interface`.' },
];

const REACT = { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'Only src/ui may use React (ADR-0001).' };
const layer = (name, banned) => ({
  group: banned.flatMap((b) => [`**/${b}/**`, `../${b}`, `../../${b}`]),
  message: `${name} must not import from ${banned.join(', ')} (ADR-0001).`,
});

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'e2e/screenshots/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      'no-restricted-syntax': ['error', ...noEnumNoInterface],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/config/**/*.ts'],
    languageOptions: { globals: {} },
    rules: { 'no-restricted-imports': ['error', { patterns: [REACT, layer('config', ['engine', 'renderer', 'audio', 'ui'])] }] },
  },
  {
    files: ['src/engine/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': ['error', { patterns: [REACT, layer('engine', ['renderer', 'audio', 'ui'])] }],
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'requestAnimationFrame',
        'AudioContext',
        'fetch',
        'setTimeout',
        'setInterval',
        'performance',
      ],
    },
  },
  {
    files: ['src/renderer/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [REACT, layer('renderer', ['ui', 'audio'])] }] },
  },
  {
    files: ['src/audio/**/*.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [REACT, layer('audio', ['ui', 'renderer'])] }] },
  },
  {
    files: ['src/**/*.tsx', 'src/ui/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  { files: ['scripts/**/*.mjs', '*.js'], languageOptions: { globals: globals.node } },
  { files: ['e2e/**/*.mjs'], languageOptions: { globals: { ...globals.node, ...globals.browser } } },
);
