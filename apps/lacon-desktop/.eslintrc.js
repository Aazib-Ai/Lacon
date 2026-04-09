module.exports = {
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Allow console in main process for logging
    'no-console': ['warn', { allow: ['error', 'warn', 'info', 'log'] }],
    // Allow for...of loops in data operations
    'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
    // Allow await in loops for sequential data operations
    'no-await-in-loop': 'off',
    // Allow ++ in migrations
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    // Allow function hoisting for handlers
    '@typescript-eslint/no-use-before-define': ['error', { functions: false }],
    // Disable import extensions for TypeScript
    'import/extensions': 'off',
    // Allow unused vars for type imports
    '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    // Allow default case to be omitted when all cases are covered
    'default-case': 'off',
  },
}
