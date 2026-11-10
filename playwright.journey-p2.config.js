import { defineConfig } from '@playwright/test';
import base from './playwright.journey-p1.config.js';

export default defineConfig(base, {
  testMatch: ['journey-p2.spec.js', 'journey-p2-sharing.spec.js'],
  outputDir: 'test-results/journey-p2',
  use: { ...base.use, timezoneId: 'UTC' },
});
