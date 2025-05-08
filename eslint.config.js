import base from '@arbendium/eslint-config-base'
// eslint-disable-next-line import/no-unresolved
import tseslint from 'typescript-eslint'

export default [
  ...base,
  {
    languageOptions: {
      parser: tseslint.parser,
      sourceType: 'module',
    },
    plugins: {
      typescript: tseslint.plugin,
    },
    rules: {
      'default-param-last': 'off',
      'no-underscore-dangle': 'off',
      'stylistic/indent': ['error', 2, { SwitchCase: 1 }],
      'stylistic/max-len': 'off',
      'stylistic/member-delimiter-style': ['error', {
        multiline: {
          delimiter: 'none',
        },
        singleline: {
          delimiter: 'comma',
        },
      }],
      'stylistic/semi': ['error', 'never'],
      'typescript/ban-ts-comment': ['error', {
        'ts-check': true, 'ts-expect-error': false, 'ts-ignore': true, 'ts-nocheck': true,
      }],
      'no-array-constructor': 'off',
      'typescript/no-array-constructor': 'error',
      'typescript/no-duplicate-enum-values': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-extra-non-null-assertion': 'error',
      'typescript/no-extraneous-class': 'error',
      'typescript/no-invalid-void-type': 'error',
      'typescript/no-misused-new': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-non-null-asserted-nullish-coalescing': 'error',
      'typescript/no-non-null-asserted-optional-chain': 'error',
      'typescript/no-non-null-assertion': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-this-alias': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-declaration-merging': 'error',
      'typescript/no-unsafe-function-type': 'error',
      'no-unused-expressions': 'off',
      'typescript/no-unused-expressions': 'error',
      'no-unused-vars': 'off',
      'typescript/no-unused-vars': 'error',
      'no-use-before-define': 'off',
      'typescript/no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      'no-useless-constructor': 'off',
      'typescript/no-useless-constructor': 'error',
      'typescript/no-wrapper-object-types': 'error',
      'typescript/prefer-as-const': 'error',
      'typescript/prefer-literal-enum-member': 'error',
      'typescript/prefer-namespace-keyword': 'error',
      'typescript/triple-slash-reference': 'error',
      'typescript/unified-signatures': 'error',
    },
  },
  {
    files: ['eslint.config.js', 'scripts/**', 'test/**'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'no-console': 'off',
    },
  },
]
