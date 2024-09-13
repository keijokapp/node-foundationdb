import base from '@arbendium/eslint-config-base'
import tseslint from 'typescript-eslint'

export default [
  ...tseslint.configs.recommended,
  ...base,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-use-before-define': ['error', { functions: false, classes: false, variables: false }],
      'import/extensions': 'off',
      'import/no-unresolved': 'off',
      'default-param-last': 'off',
      indent: ['error', 2, { SwitchCase: 1 }],
      'lines-between-class-members': 'off',
      'max-len': 'off',
      'no-dupe-class-members': 'off',
      'no-restricted-globals': 'off',
      'no-underscore-dangle': 'off',
      'no-unused-vars': 'off',
      'no-use-before-define': 'off',
      'no-extra-parens': 'off',
      semi: ['error', 'never']
    }
  },
  {
    files: ['eslint.config.mjs', 'scripts/**', 'test/**'],
    rules: {
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'no-console': 'off'
    }
  }
]
