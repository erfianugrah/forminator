import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',

	use: {
		baseURL: process.env.TEST_URL || 'https://form.erfi.dev',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],

	webServer: process.env.TEST_URL ? undefined : {
		command: 'wrangler dev --remote',
		url: 'http://localhost:8787',
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
	},
});
