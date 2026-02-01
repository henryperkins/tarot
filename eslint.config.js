import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  // Ignore patterns
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.vscode-server/**',
      '.vscode-server-insiders/**',
      '.wrangler/**',
      '.worker/**',
      'public/**',
      'data/**',
      'venv/**',
      'migrations/**',
      '*.config.js',
      '*.config.mjs',
      '.env*',
      '.dev.vars*',
      'tableu/**',
      'tableu-mobile/**',
    ],
  },

  // Base configuration for all JS files
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-console': 'off', // Allow console for debugging
      'prefer-const': 'warn',
      'no-var': 'error',
    },
  },

  // React components in src/
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      'react/prop-types': 'off', // We're not using PropTypes
      'react/jsx-uses-react': 'off', // Not needed with new JSX transform
      'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
    },
  },

  // Cloudflare Workers Functions in functions/
  {
    files: ['functions/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker, // Cloudflare Workers use Service Worker API
        // Add Cloudflare-specific globals
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        caches: 'readonly',
        // Node.js compatibility APIs available in Cloudflare Workers with nodejs_compat flag
        Buffer: 'readonly',
        process: 'readonly',
        // Wrangler-specific globals
        uint8ToBase64: 'readonly',
      },
    },
    rules: {
      'no-restricted-globals': 'off', // Allow Workers globals
    },
  },

  // Node.js scripts
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.{js,mjs}', 'test-telemetry.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Plugins directory (Node.js environment)
  {
    files: ['plugins/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // Test files
  {
    files: ['tests/**/*.{js,mjs}', '**/*.test.{js,mjs}', '**/__tests__/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-expressions': 'off', // Allow assertions
    },
  },

  // E2E Playwright tests (run in browser context via page.evaluate)
  {
    files: ['e2e/**/*.{js,mjs,spec.js}'],
    languageOptions: {
      globals: {
        ...globals.node, // Playwright runs in Node
        ...globals.browser, // page.evaluate/addInitScript run in browser
      },
    },
    rules: {
      'no-unused-expressions': 'off', // Allow assertions
    },
  },

  // Shared utilities that work in both browser and Workers
  {
    files: ['shared/**/*.js'],
    languageOptions: {
      globals: {
        // Minimal shared globals
        console: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        URL: 'readonly',
        // Node.js compatibility for cross-environment utilities
        Buffer: 'readonly',
        process: 'readonly',
        btoa: 'readonly',
      },
    },
  },
];
