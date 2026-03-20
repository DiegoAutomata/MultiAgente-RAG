import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration tailored for the SaaS Factory V4 environment.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 60_000, // per-test timeout
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    navigationTimeout: 45_000, // wait up to 45s for page.goto
    actionTimeout: 15_000,     // wait up to 15s for clicks/fills
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ],

  // Reuse existing dev server; give it time to fully compile before tests run
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000,
  },
});
