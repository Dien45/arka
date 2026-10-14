import { defineConfig } from '@playwright/test'

/**
 * Arka Android — native E2E via the Playwright test runner.
 *
 * No browser project: tests drive the real device through `adb`. The runner is
 * used for structure, retries, parallel control and reporting (HTML + JUnit).
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './artifacts/test-results',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [
    ['list'],
    ['html', { outputFolder: './artifacts/html-report', open: 'never' }],
    ['junit', { outputFile: './artifacts/junit.xml' }],
  ],
  use: {
    // The Android device is the target — no Playwright browser is launched.
    trace: 'off',
    video: 'off',
  },
})
