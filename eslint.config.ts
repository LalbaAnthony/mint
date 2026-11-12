import { defineConfig, globalIgnores } from 'eslint/config'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

const typeScriptFiles = ['**/*.ts', '**/*.mts', '**/*.cts', '**/*.vue']

const typesDirectories = [
  'front/types/**/*.ts',
  'api/types/**/*.ts',
  'shared/types/**/*.ts',
]

const typeDeclarationOutsideTypesMessage =
  'Declare types and interfaces in the types/ directory of the package (CODE-08).'

export default defineConfig(
  globalIgnores(['**/dist/', '**/coverage/']),
  {
    files: typeScriptFiles,
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: { parser: tseslint.parser },
  },
  pluginVue.configs['flat/base'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      'vue/no-restricted-html-elements': ['error', 'svg'],
    },
  },
  {
    files: typeScriptFiles,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true },
      ],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSTypeAliasDeclaration',
          message: typeDeclarationOutsideTypesMessage,
        },
        {
          selector: 'TSInterfaceDeclaration',
          message: typeDeclarationOutsideTypesMessage,
        },
      ],
    },
  },
  {
    files: typesDirectories,
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
)
