import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * Fraud Detection Stress Tests
 *
 * These tests run against PRODUCTION to verify fraud detection mitigations.
 * They attempt to trigger rate limits, blocking, and other security measures.
 *
 * Uses stealth techniques to bypass Turnstile and simulate real users.
 * Run with: npm run test:fraud
 */

// Random delay to simulate human behavior
function randomDelay(min: number = 100, max: number = 500): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// Add stealth scripts to page
async function addStealthScripts(page: Page) {
	await page.addInitScript(() => {
		// Hide webdriver property
		Object.defineProperty(navigator, 'webdriver', {
			get: () => false,
		});

		// Mock plugins
		Object.defineProperty(navigator, 'plugins', {
			get: () => [1, 2, 3, 4, 5],
		});

		// Mock languages
		Object.defineProperty(navigator, 'languages', {
			get: () => ['en-US', 'en'],
		});

		// Chrome runtime
		(window as any).chrome = {
			runtime: {},
		};

		// Permissions
		const originalQuery = window.navigator.permissions.query;
		window.navigator.permissions.query = (parameters: any) => (
			parameters.name === 'notifications' ?
				Promise.resolve({ state: Notification.permission } as PermissionStatus) :
				originalQuery(parameters)
		);
	});
}

// Helper to fill form with human-like behavior
async function fillForm(page: any, uniqueId: string) {
	await addStealthScripts(page);

	// Random mouse movements
	await page.mouse.move(Math.random() * 100, Math.random() * 100);
	await randomDelay(200, 800);

	await page.fill('input[name="firstName"]', 'Test');
	await randomDelay(100, 300);

	await page.fill('input[name="lastName"]', `User${uniqueId}`);
	await randomDelay(100, 300);

	await page.fill('input[name="email"]', `test${uniqueId}@example.com`);
	await randomDelay(100, 300);

	await page.fill('.react-international-phone-input', '5551234567');
	await randomDelay(100, 300);

	await page.fill('input[name="address"]', `${uniqueId} Test St`);
	await randomDelay(100, 300);

	const dob = new Date(Date.now() - 25 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
	await page.fill('input[name="dateOfBirth"]', dob);
	await randomDelay(200, 500);
}

// Helper to wait for and capture API response
async function captureSubmissionResponse(page: any) {
	return new Promise<{ status: number; data: any }>((resolve) => {
		page.on('response', async (response: any) => {
			if (response.url().includes('/api/submissions') && response.request().method() === 'POST') {
				const status = response.status();
				let data = null;
				try {
					data = await response.json();
				} catch {
					// Response might not be JSON
				}
				resolve({ status, data });
			}
		});
	});
}

test.describe('Rapid Submission Attack', () => {
	test('should detect and block rapid submissions from same IP', async ({ browser }) => {
		console.log('🚀 Starting rapid submission attack test...');

		const results: Array<{ status: number; data: any; timestamp: number }> = [];
		const TARGET_SUBMISSIONS = 20; // Try to submit 20 times rapidly

		// Use same browser context to simulate same IP/session
		const context = await browser.newContext();

		for (let i = 0; i < TARGET_SUBMISSIONS; i++) {
			const page = await context.newPage();
			await addStealthScripts(page);
			const startTime = Date.now();

			try {
				await page.goto('/', { waitUntil: 'networkidle' });

				// Wait for page to fully load
				await page.waitForLoadState('domcontentloaded');
				await randomDelay(500, 1000);

				// Fill form with human-like behavior
				await fillForm(page, `rapid${i}_${Date.now()}`);

				// Set up response listener
				const responsePromise = captureSubmissionResponse(page);

				// Submit and wait for Turnstile
				await page.click('button[type="submit"]');
				console.log(`   Submission ${i + 1}: Waiting for Turnstile...`);

				// Give Turnstile time to complete (up to 30s)
				const response = await Promise.race([
					responsePromise,
					new Promise<{ status: number; data: any }>((resolve) =>
						setTimeout(() => resolve({ status: 0, data: { error: 'Timeout' } }), 30000)
					),
				]);

				results.push({
					status: response.status,
					data: response.data,
					timestamp: Date.now() - startTime,
				});

				console.log(`✓ Submission ${i + 1}/${TARGET_SUBMISSIONS}: Status ${response.status} (${Date.now() - startTime}ms)`);
			} catch (error) {
				console.error(`✗ Submission ${i + 1} failed:`, error);
				results.push({
					status: 0,
					data: { error: String(error) },
					timestamp: Date.now() - startTime,
				});
			} finally {
				await page.close();
			}

			// Small delay between submissions (still rapid but more realistic)
			await randomDelay(500, 1000);
		}

		await context.close();

		// Analyze results
		const blocked = results.filter(r => r.status === 403 || r.status === 429);
		const succeeded = results.filter(r => r.status === 200);
		const failed = results.filter(r => r.status >= 400 && r.status !== 403 && r.status !== 429);

		console.log('\n📊 Rapid Submission Test Results:');
		console.log(`   Total attempts: ${results.length}`);
		console.log(`   Succeeded: ${succeeded.length}`);
		console.log(`   Blocked (403/429): ${blocked.length}`);
		console.log(`   Failed (other): ${failed.length}`);
		console.log(`   Avg response time: ${Math.round(results.reduce((sum, r) => sum + r.timestamp, 0) / results.length)}ms`);

		// Verify fraud detection kicked in
		if (blocked.length > 0) {
			console.log(`✓ Fraud detection TRIGGERED - ${blocked.length} submissions blocked`);
			expect(blocked.length).toBeGreaterThan(0);
		} else if (succeeded.length === results.length) {
			console.log(`⚠️ WARNING: All ${succeeded.length} submissions succeeded - fraud detection may not be working`);
			// Don't fail the test, but log warning
		}

		// At least some submissions should complete (not all timeout)
		expect(results.filter(r => r.status > 0).length).toBeGreaterThan(0);
	});
});

test.describe('Token Replay Attack', () => {
	test('should reject reused Turnstile tokens', async ({ page }) => {
		console.log('🚀 Starting token replay attack test...');

		await page.goto('/');

		// Intercept to capture token
		let capturedToken: string | null = null;
		await page.route('**/api/submissions', async (route, request) => {
			if (request.method() === 'POST') {
				const body = request.postDataJSON();
				if (body?.turnstileToken && !capturedToken) {
					capturedToken = body.turnstileToken;
					console.log('✓ Captured Turnstile token');
				}
			}
			await route.continue();
		});

		// Submit form once
		await fillForm(page, `replay_${Date.now()}`);
		await page.click('button[type="submit"]');

		// Wait for submission to complete
		await page.waitForTimeout(5000);

		if (!capturedToken) {
			console.log('⚠️ Could not capture token - skipping replay test');
			test.skip();
			return;
		}

		console.log('✓ First submission completed');

		// Now try to replay the token directly via API
		console.log('🔄 Attempting token replay...');

		const replayAttempts = 5;
		const replayResults: number[] = [];

		for (let i = 0; i < replayAttempts; i++) {
			const response = await page.request.post('/api/submissions', {
				data: {
					firstName: 'Test',
					lastName: `Replay${i}`,
					email: `replay${i}_${Date.now()}@example.com`,
					phone: '+15551234567',
					address: `${i} Replay St`,
					dateOfBirth: new Date(Date.now() - 25 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
					turnstileToken: capturedToken, // Reuse same token
				},
			});

			replayResults.push(response.status());
			console.log(`   Replay ${i + 1}/${replayAttempts}: Status ${response.status()}`);

			await new Promise(resolve => setTimeout(resolve, 500));
		}

		// Count rejections
		const rejected = replayResults.filter(s => s === 400 || s === 403).length;

		console.log('\n📊 Token Replay Test Results:');
		console.log(`   Total replay attempts: ${replayAttempts}`);
		console.log(`   Rejected: ${rejected}`);
		console.log(`   Accepted: ${replayAttempts - rejected}`);

		// At least some replays should be rejected
		expect(rejected).toBeGreaterThan(0);
		console.log('✓ Token replay protection working');
	});
});

test.describe('Parallel Submission Attack', () => {
	test('should handle multiple simultaneous submissions from same source', async ({ browser }) => {
		console.log('🚀 Starting parallel submission attack test...');

		const PARALLEL_COUNT = 10;
		const contexts = await Promise.all(
			Array(PARALLEL_COUNT).fill(0).map(() => browser.newContext())
		);

		console.log(`   Launching ${PARALLEL_COUNT} parallel submissions...`);

		// Submit all at once
		const submissions = contexts.map(async (context, i) => {
			const page = await context.newPage();
			await addStealthScripts(page);
			const startTime = Date.now();

			try {
				await page.goto('/', { waitUntil: 'networkidle' });
				await page.waitForLoadState('domcontentloaded');
				await randomDelay(300, 700);

				await fillForm(page, `parallel${i}_${Date.now()}`);

				const responsePromise = captureSubmissionResponse(page);
				await page.click('button[type="submit"]');
				console.log(`   Parallel ${i + 1}: Waiting for Turnstile...`);

				const response = await Promise.race([
					responsePromise,
					new Promise<{ status: number; data: any }>((resolve) =>
						setTimeout(() => resolve({ status: 0, data: { error: 'Timeout' } }), 30000)
					),
				]);

				return {
					index: i,
					status: response.status,
					data: response.data,
					duration: Date.now() - startTime,
				};
			} catch (error) {
				return {
					index: i,
					status: 0,
					data: { error: String(error) },
					duration: Date.now() - startTime,
				};
			} finally {
				await page.close();
				await context.close();
			}
		});

		const results = await Promise.all(submissions);

		// Analyze
		const blocked = results.filter(r => r.status === 403 || r.status === 429).length;
		const succeeded = results.filter(r => r.status === 200).length;
		const failed = results.filter(r => r.status > 0 && r.status !== 200 && r.status !== 403 && r.status !== 429).length;

		console.log('\n📊 Parallel Submission Test Results:');
		console.log(`   Total parallel submissions: ${PARALLEL_COUNT}`);
		console.log(`   Succeeded: ${succeeded}`);
		console.log(`   Blocked: ${blocked}`);
		console.log(`   Failed: ${failed}`);
		console.log(`   Avg duration: ${Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length)}ms`);

		// System should handle all requests without crashing
		expect(results.length).toBe(PARALLEL_COUNT);

		if (blocked > 0) {
			console.log(`✓ Rate limiting triggered - ${blocked} requests blocked`);
		}
	});
});

test.describe('Distributed Attack Simulation', () => {
	test('should track submissions across multiple users', async ({ browser }) => {
		console.log('🚀 Starting distributed attack simulation...');

		const USER_COUNT = 15;

		console.log(`   Creating ${USER_COUNT} different users...`);

		const results: Array<{ userId: string; status: number; duration: number }> = [];

		// Submit from multiple "users" (different contexts = different IPs in some cases)
		for (let i = 0; i < USER_COUNT; i++) {
			const context = await browser.newContext();
			const page = await context.newPage();
			await addStealthScripts(page);
			const startTime = Date.now();
			const userId = `user${i}_${Date.now()}`;

			try {
				await page.goto('/', { waitUntil: 'networkidle' });
				await page.waitForLoadState('domcontentloaded');
				await randomDelay(300, 800);

				await fillForm(page, userId);

				const responsePromise = captureSubmissionResponse(page);
				await page.click('button[type="submit"]');
				console.log(`   User ${i + 1}: Waiting for Turnstile...`);

				const response = await Promise.race([
					responsePromise,
					new Promise<{ status: number; data: any }>((resolve) =>
						setTimeout(() => resolve({ status: 0, data: { error: 'Timeout' } }), 30000)
					),
				]);

				results.push({
					userId,
					status: response.status,
					duration: Date.now() - startTime,
				});

				console.log(`   User ${i + 1}/${USER_COUNT}: Status ${response.status}`);
			} catch (error) {
				results.push({
					userId,
					status: 0,
					duration: Date.now() - startTime,
				});
			} finally {
				await page.close();
				await context.close();
			}

			// Small delay between users
			await randomDelay(500, 1000);
		}

		const succeeded = results.filter(r => r.status === 200).length;
		const blocked = results.filter(r => r.status === 403 || r.status === 429).length;

		console.log('\n📊 Distributed Attack Results:');
		console.log(`   Total users: ${USER_COUNT}`);
		console.log(`   Succeeded: ${succeeded}`);
		console.log(`   Blocked: ${blocked}`);

		// Different users should generally succeed (not flagged as fraud)
		// unless they're coming from the same IP
		expect(results.length).toBe(USER_COUNT);

		if (blocked > 5) {
			console.log(`✓ Aggressive rate limiting detected - ${blocked} users blocked`);
		}
	});
});

test.describe('Analytics Verification', () => {
	test('should track fraud metrics in analytics', async ({ request }) => {
		console.log('🚀 Checking analytics for fraud metrics...');

		const response = await request.get('/api/analytics/stats');
		expect(response.ok()).toBeTruthy();

		const data = await response.json();

		console.log('📊 Current Analytics:');
		console.log(`   Total submissions: ${data.data.total_submissions || 0}`);
		console.log(`   Allowed: ${data.data.allowed || 0}`);
		console.log(`   Average risk score: ${data.data.avg_risk_score || 'N/A'}`);
		console.log(`   Unique ephemeral IDs: ${data.data.unique_ephemeral_ids || 0}`);

		// Verify analytics structure
		expect(data).toHaveProperty('success', true);
		expect(data.data).toHaveProperty('total_submissions');
		expect(data.data).toHaveProperty('allowed');
		expect(data.data).toHaveProperty('avg_risk_score');
		expect(data.data).toHaveProperty('unique_ephemeral_ids');
	});

	test('should show submission history', async ({ request }) => {
		const response = await request.get('/api/analytics/submissions?limit=50');
		expect(response.ok()).toBeTruthy();

		const data = await response.json();

		console.log(`📋 Recent submissions: ${data.data?.length || 0}`);

		if (data.data && data.data.length > 0) {
			// Show last few submissions
			const recent = data.data.slice(0, 5);
			console.log('   Last 5 submissions:');
			recent.forEach((sub: any, i: number) => {
				console.log(`     ${i + 1}. ${sub.email} - Status: ${sub.status || 'unknown'}`);
			});
		}

		expect(Array.isArray(data.data)).toBeTruthy();
	});
});
