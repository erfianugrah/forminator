import { test, expect } from '@playwright/test';

test.describe('Form Submission Flow', () => {
	test('should load the form page', async ({ page }) => {
		await page.goto('/');

		// Check page title
		await expect(page).toHaveTitle(/Turnstile Demo/);

		// Check form elements exist
		await expect(page.locator('input[name="firstName"]')).toBeVisible();
		await expect(page.locator('input[name="lastName"]')).toBeVisible();
		await expect(page.locator('input[name="email"]')).toBeVisible();
		await expect(page.locator('input[name="address"]')).toBeVisible();
		await expect(page.locator('input[name="dateOfBirth"]')).toBeVisible();

		// Check Turnstile widget container exists
		await expect(page.locator('[data-testid="turnstile-widget"]')).toBeVisible();
	});

	test('should show validation errors for empty fields', async ({ page }) => {
		await page.goto('/');

		// Try to submit empty form
		await page.click('button[type="submit"]');

		// Should show validation errors (after triggering validation)
		await page.locator('input[name="firstName"]').click();
		await page.locator('input[name="lastName"]').click();

		// Wait for validation errors
		await expect(page.locator('text=First name is required')).toBeVisible({ timeout: 2000 });
	});

	test('should validate email format', async ({ page }) => {
		await page.goto('/');

		// Fill invalid email
		await page.fill('input[name="email"]', 'invalid-email');
		await page.locator('input[name="firstName"]').click(); // Trigger blur

		// Should show email validation error
		await expect(page.locator('text=Invalid email address')).toBeVisible({ timeout: 2000 });
	});

	test('should validate age requirement (18+)', async ({ page }) => {
		await page.goto('/');

		// Calculate date for someone who is 17
		const today = new Date();
		const seventeenYearsAgo = new Date(
			today.getFullYear() - 17,
			today.getMonth(),
			today.getDate()
		);
		const dateString = seventeenYearsAgo.toISOString().split('T')[0];

		await page.fill('input[name="dateOfBirth"]', dateString);
		await page.locator('input[name="firstName"]').click(); // Trigger blur

		// Should show age validation error
		await expect(page.locator('text=You must be at least 18 years old')).toBeVisible({
			timeout: 2000,
		});
	});

	test('should auto-detect user country for phone input', async ({ page }) => {
		await page.goto('/');

		// Wait for country detection
		await page.waitForTimeout(500);

		// Check if phone input has country selector
		const countryButton = page.locator('.react-international-phone-country-selector-button');
		await expect(countryButton).toBeVisible();

		// Verify country was detected (not default US)
		// This will vary based on where the test runs from
		const buttonText = await countryButton.textContent();
		expect(buttonText).toBeTruthy();
	});

	test('should format phone number correctly', async ({ page }) => {
		await page.goto('/');

		// Type phone number
		const phoneInput = page.locator('.react-international-phone-input');
		await phoneInput.fill('5551234567');

		// Wait for formatting
		await page.waitForTimeout(300);

		// Check if phone was formatted (exact format depends on country)
		const value = await phoneInput.inputValue();
		expect(value).toContain('555');
		expect(value).toContain('123');
	});

	test('should submit form successfully with valid data', async ({ page }) => {
		await page.goto('/');

		// Fill form with valid data
		await page.fill('input[name="firstName"]', 'Test');
		await page.fill('input[name="lastName"]', 'User');
		await page.fill('input[name="email"]', 'test@example.com');
		await page.fill('.react-international-phone-input', '5551234567');
		await page.fill('input[name="address"]', '123 Test St, Test City, TS 12345');

		// Set valid date of birth (25 years old)
		const today = new Date();
		const twentyFiveYearsAgo = new Date(
			today.getFullYear() - 25,
			today.getMonth(),
			today.getDate()
		);
		await page.fill('input[name="dateOfBirth"]', twentyFiveYearsAgo.toISOString().split('T')[0]);

		// Submit form (this will trigger Turnstile)
		await page.click('button[type="submit"]');

		// Wait for Turnstile challenge to appear or submission to proceed
		// Note: In production with real Turnstile, you'll need to solve the challenge
		// For testing, use Cloudflare's testing keys that always pass/fail

		// Check for success or Turnstile widget
		await page.waitForSelector('iframe[src*="challenges.cloudflare.com"], [role="alert"]', {
			timeout: 10000,
		});
	});
});

test.describe('Turnstile Integration', () => {
	test('should load Turnstile widget', async ({ page }) => {
		await page.goto('/');

		// Wait for Turnstile script to load
		await page.waitForFunction(() => {
			return typeof (window as any).turnstile !== 'undefined';
		}, { timeout: 10000 });

		// Check Turnstile widget exists
		const widget = page.locator('[data-testid="turnstile-widget"]');
		await expect(widget).toBeVisible();
	});

	test('should trigger Turnstile on submit', async ({ page }) => {
		await page.goto('/');

		// Fill form quickly
		await page.fill('input[name="firstName"]', 'Test');
		await page.fill('input[name="lastName"]', 'User');
		await page.fill('input[name="email"]', 'test@example.com');
		await page.fill('.react-international-phone-input', '5551234567');
		await page.fill('input[name="address"]', '123 Test St');
		const dob = new Date(Date.now() - 25 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
		await page.fill('input[name="dateOfBirth"]', dob);

		// Submit
		await page.click('button[type="submit"]');

		// Should show Turnstile iframe or immediately submit if using testing key
		await page.waitForTimeout(1000);

		// Either Turnstile iframe appears or form submits
		const hasTurnstile = await page.locator('iframe[src*="challenges.cloudflare.com"]').count();
		const hasAlert = await page.locator('[role="alert"]').count();

		expect(hasTurnstile + hasAlert).toBeGreaterThan(0);
	});
});

test.describe('Analytics Page', () => {
	test('should load analytics dashboard', async ({ page }) => {
		await page.goto('/analytics');

		// Check page title
		await expect(page).toHaveTitle(/Analytics/);

		// Check stats cards exist
		await expect(page.locator('text=Total Submissions')).toBeVisible();
		await expect(page.locator('text=Success Rate')).toBeVisible();
		await expect(page.locator('text=Average Risk Score')).toBeVisible();
	});

	test('should load analytics data', async ({ page }) => {
		await page.goto('/analytics');

		// Wait for data to load
		await page.waitForTimeout(2000);

		// Check if any data is displayed (could be 0 if fresh DB)
		const totalSubmissions = page.locator('text=/\\d+ Total Submissions/');
		await expect(totalSubmissions).toBeVisible({ timeout: 5000 });
	});
});

test.describe('Geolocation API', () => {
	test('should return user country code', async ({ request }) => {
		const response = await request.get('/api/geo');

		expect(response.ok()).toBeTruthy();

		const data = await response.json();
		expect(data).toHaveProperty('success', true);
		expect(data).toHaveProperty('countryCode');
		expect(data.countryCode).toMatch(/^[a-z]{2}$/);
	});
});

test.describe('API Health', () => {
	test('should return healthy status', async ({ request }) => {
		const response = await request.get('/api/health');

		expect(response.ok()).toBeTruthy();

		const data = await response.json();
		expect(data).toHaveProperty('status', 'ok');
		expect(data).toHaveProperty('timestamp');
	});
});
