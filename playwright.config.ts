import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	timeout: 90000, // 90s per test (allow time for Turnstile)

	use: {
		baseURL: process.env.TEST_URL || 'https://form.erfi.dev',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',

		// Simulate real user behavior
		viewport: { width: 1920, height: 1080 },
		userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
		locale: 'en-US',
		timezoneId: 'America/New_York',
		permissions: ['geolocation'],
		geolocation: { latitude: 40.7128, longitude: -74.0060 }, // New York

		// Additional stealth settings
		javaScriptEnabled: true,
		hasTouch: false,
		isMobile: false,
		colorScheme: 'light',
	},

	projects: [
		{
			name: 'chromium-stealth',
			use: {
				...devices['Desktop Chrome'],
				// Launch options to make Chromium appear more real
				launchOptions: {
					args: [
						'--disable-blink-features=AutomationControlled',
						'--disable-dev-shm-usage',
						'--disable-web-security',
						'--disable-features=IsolateOrigins,site-per-process',
						'--no-sandbox',
						'--disable-setuid-sandbox',
						'--disable-infobars',
						'--window-position=0,0',
						'--ignore-certificate-errors',
						'--ignore-certificate-errors-spki-list',
						'--disable-gpu',
					],
					ignoreDefaultArgs: ['--enable-automation'],
				},
			},
		},
	],

	// Don't start local server - tests should run against production
	webServer: undefined,
});
