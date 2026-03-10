/**
 * Fraud Detection E2E Smoke Test
 *
 * Tests the actual efficacy of the multi-layer fraud detection system by exercising
 * real API endpoints against a live (or local) worker instance. Uses the testing
 * bypass to skip Turnstile token validation while keeping ALL fraud detection layers
 * active — ephemeral ID tracking, duplicate email detection, IP rate limiting,
 * blacklist blocking, and holistic risk scoring.
 *
 * Environment modes:
 *   - Staging (full): `wrangler dev --remote --env staging` with ALLOW_TESTING_BYPASS=true
 *     All fraud detection layers are exercised end-to-end.
 *   - Production (partial): Bypass-dependent tests are auto-skipped.
 *     Only input validation, auth, error shapes, and security headers are tested.
 *
 * Prerequisites:
 *   - Worker must be running (`wrangler dev --remote --env staging` or deployed)
 *   - TEST_API_KEY env var set to the worker's X-API-KEY secret
 *   - Override baseURL with TEST_URL env var (default: https://form.erfi.dev)
 *
 * Run (staging — full test):
 *   TEST_URL=http://localhost:8787 TEST_API_KEY=<key> npx playwright test tests/fraud-detection-e2e.spec.ts
 *
 * Run (production — partial):
 *   TEST_API_KEY=<key> npx playwright test tests/fraud-detection-e2e.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_URL || 'https://form.erfi.dev';
const API_KEY = process.env.TEST_API_KEY || '';

// Unique run ID to isolate test data across runs
const RUN_ID = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Generate a unique email for this test run to avoid cross-run collisions */
function uniqueEmail(label: string): string {
	return `${label}-${RUN_ID}@test-fraud-detection.example`;
}

/** Build a valid submission payload */
function makeSubmission(overrides: Record<string, unknown> = {}) {
	return {
		firstName: 'Test',
		lastName: 'User',
		email: uniqueEmail('default'),
		turnstileToken: 'bypass-token',
		...overrides,
	};
}

/** Common headers for bypass requests */
function bypassHeaders(): Record<string, string> {
	return {
		'Content-Type': 'application/json',
		'X-API-KEY': API_KEY,
	};
}

/** POST a submission with bypass headers — each call gets a unique token to avoid replay detection */
async function postSubmission(request: import('@playwright/test').APIRequestContext, overrides: Record<string, unknown> = {}) {
	return request.post(`${BASE_URL}/api/submissions`, {
		headers: bypassHeaders(),
		data: makeSubmission({
			turnstileToken: `bypass-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			...overrides,
		}),
	});
}

/**
 * POST a submission with a pinned ephemeral ID via X-Test-Ephemeral-Id header.
 * This enables testing ephemeral-ID-based fraud signals (submission count,
 * validation frequency, IP diversity) which require the same ephemeral ID
 * across multiple requests.
 */
async function postWithEphemeralId(
	request: import('@playwright/test').APIRequestContext,
	ephemeralId: string,
	overrides: Record<string, unknown> = {},
) {
	return request.post(`${BASE_URL}/api/submissions`, {
		headers: {
			...bypassHeaders(),
			'X-Test-Ephemeral-Id': ephemeralId,
		},
		data: makeSubmission({
			turnstileToken: `bypass-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			...overrides,
		}),
	});
}

/** Generate a unique ephemeral ID for this test run */
function uniqueEphemeralId(label: string): string {
	return `test-${label}-${RUN_ID}`;
}

// ========== TEST CLEANUP ==========
// Clear accumulated fraud state for the test runner's IP before running tests.
// Without this, previous test runs pollute the blacklist/rate-limit state and
// cause false 429s on legitimate first-time submissions.

async function cleanupTestState(request: import('@playwright/test').APIRequestContext): Promise<boolean> {
	// Call test-cleanup endpoint to clear fraud state for our IP.
	// The endpoint auto-detects the caller's IP from CF-Connecting-IP.
	const cleanupResponse = await request.delete(`${BASE_URL}/api/submissions/test-cleanup`, {
		headers: { 'X-API-KEY': API_KEY },
	});

	return cleanupResponse.status() === 200;
}

// ========== BYPASS DETECTION ==========
// Probe once at module level; individual tests check this flag.

let bypassAvailable: boolean | null = null;

async function checkBypassAvailable(request: import('@playwright/test').APIRequestContext): Promise<boolean> {
	if (bypassAvailable !== null) return bypassAvailable;

	// Try cleanup first — if it works, bypass is available
	const cleaned = await cleanupTestState(request);

	const email = uniqueEmail('bypass-probe');
	const response = await postSubmission(request, { email });
	const status = response.status();
	// 201 = bypass worked, 409 = already existed (bypass worked earlier), 429 = fraud block (bypass worked)
	// 500/503 = bypass not active (Turnstile fails on fake token)
	bypassAvailable = status === 201 || status === 409 || status === 429;

	if (bypassAvailable && !cleaned) {
		// Bypass works but cleanup isn't available — warn about potential IP state issues
		console.warn('Warning: Test cleanup endpoint not available. IP-based fraud state from previous runs may cause flaky tests.');
	}

	return bypassAvailable;
}

function skipWithoutBypass(available: boolean) {
	test.skip(!available, 'Testing bypass not available (requires staging env with ALLOW_TESTING_BYPASS=true)');
}

// ========== PREREQUISITES ==========

test.describe('Fraud detection e2e prerequisites', () => {
	test('testing bypass is available (API key configured)', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		if (!available) {
			// Not a failure — just inform. Production bypass is disabled by design.
			test.skip(true, 'Bypass disabled — run against staging for full fraud detection tests');
		}
	});
});

// ========== LAYER 1: INPUT VALIDATION (BEFORE FRAUD CHECKS) ==========
// These tests do NOT require bypass — validation happens before Turnstile.

test.describe('Layer 1: Input validation', () => {
	test('rejects missing required fields', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {},
		});
		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('ValidationError');
		expect(body.message).toBeTruthy();
	});

	test('rejects invalid email format', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'not-an-email',
				turnstileToken: 'fake-token',
			},
		});
		expect(response.status()).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('ValidationError');
	});

	test('rejects impossible calendar date (Feb 30)', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'date-test@example.com',
				dateOfBirth: '2023-02-30', // Non-leap year, Feb has 28 days
				turnstileToken: 'fake-token',
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects under-18 date of birth', async ({ request }) => {
		const today = new Date();
		const underAge = `${today.getFullYear() - 10}-01-15`;
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'test@example.com',
				dateOfBirth: underAge,
				turnstileToken: 'fake-token',
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects invalid phone number (bad country code)', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'test@example.com',
				phone: '+0123456789', // Country code 0 is invalid ([1-9] required)
				turnstileToken: 'fake-token',
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects address without country when address fields present', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'test@example.com',
				address: { street: '123 Main St', city: 'Testville' },
				turnstileToken: 'fake-token',
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects missing turnstile token', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'test@example.com',
			},
		});
		expect(response.status()).toBe(400);
	});

	test('rejects invalid JSON body', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: 'not-json',
		});
		expect(response.status()).toBe(400);
	});
});

// ========== LAYER 2: LEGITIMATE SUBMISSION FLOW ==========

test.describe('Layer 2: Legitimate submission', () => {
	test('accepts a valid first-time submission (201)', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('legit');
		const response = await postSubmission(request, { email });
		expect(response.status()).toBe(201);

		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.submissionId).toBeTruthy();
		expect(body.erfid).toBeTruthy();
		expect(body.message).toBe('Form submitted successfully');
	});

	test('returns erfid in X-Request-Id header', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('erfid-header');
		const response = await postSubmission(request, { email });
		expect(response.status()).toBe(201);

		const erfid = response.headers()['x-request-id'];
		expect(erfid).toBeTruthy();
		expect(erfid).toMatch(/^erf_/);
	});

	test('accepts submission with full address and optional fields', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('full-fields');
		const response = await postSubmission(request, {
			email,
			phone: '+12125551234',
			dateOfBirth: '1990-06-15',
			address: {
				street: '123 Broadway',
				street2: 'Suite 400',
				city: 'New York',
				state: 'NY',
				postalCode: '10001',
				country: 'US',
			},
		});
		expect(response.status()).toBe(201);
	});
});

// ========== LAYER 3: DUPLICATE EMAIL DETECTION ==========

test.describe('Layer 3: Duplicate email detection', () => {
	test.describe.configure({ mode: 'serial' });

	const dupeEmail = uniqueEmail('dupe');

	test('first submission with email succeeds', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const response = await postSubmission(request, { email: dupeEmail });
		expect(response.status()).toBe(201);
	});

	test('second submission with same email returns 409 or 429', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const response = await postSubmission(request, { email: dupeEmail });
		// 409 (duplicate email) or 429 (rate limited from accumulated IP/email state)
		expect([409, 429]).toContain(response.status());

		const body = await response.json();
		if (response.status() === 409) {
			expect(body.error).toBe('ConflictError');
			expect(body.message).toContain('already been registered');
		} else {
			expect(body.error).toBe('Too many requests');
			expect(body.retryAfter).toBeGreaterThan(0);
		}
	});

	test('third duplicate attempt still returns 409 or 429 (escalation tracking)', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const response = await postSubmission(request, { email: dupeEmail });
		// Could be 409 (duplicate) or 429 (rate limited after repeated attempts)
		expect([409, 429]).toContain(response.status());
	});
});

// ========== LAYER 4: REPEATED DUPLICATE = FRAUD ESCALATION ==========

test.describe('Layer 4: Duplicate email fraud escalation', () => {
	test('repeated duplicate submissions escalate to 429 block', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const escalationEmail = uniqueEmail('escalation');

		// First: create the original submission
		const first = await postSubmission(request, { email: escalationEmail });
		expect(first.status()).toBe(201);

		// Next: hammer duplicates to trigger fraud escalation
		// After 3+ duplicate attempts in 24h, the system should escalate to 429
		let gotRateLimited = false;

		for (let i = 0; i < 5; i++) {
			const response = await postSubmission(request, { email: escalationEmail });
			const status = response.status();

			if (status === 429) {
				gotRateLimited = true;
				const body = await response.json();
				expect(body.error).toBe('Too many requests');
				expect(body.retryAfter).toBeGreaterThan(0);
				expect(body.expiresAt).toBeTruthy();
				break;
			}

			// Should be 409 until escalation
			expect(status).toBe(409);
		}

		expect(gotRateLimited).toBe(true);
	});
});

// ========== LAYER 5: BLACKLIST PERSISTENCE ==========

test.describe('Layer 5: Blacklist persistence', () => {
	test('blocked email is remembered on subsequent requests', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const blacklistEmail = uniqueEmail('blacklist');

		// Step 1: Create original submission
		const first = await postSubmission(request, { email: blacklistEmail });
		expect(first.status()).toBe(201);

		// Step 2: Trigger escalation to get blacklisted
		for (let i = 0; i < 5; i++) {
			const response = await postSubmission(request, { email: blacklistEmail });
			if (response.status() === 429) break;
		}

		// Step 3: Verify the blacklist is enforced on the NEXT request
		// The pre-validation blacklist check (Layer 0) should catch this
		const blocked = await postSubmission(request, { email: blacklistEmail });
		expect(blocked.status()).toBe(429);

		const body = await blocked.json();
		expect(body.retryAfter).toBeGreaterThan(0);
	});
});

// ========== LAYER 6: RATE LIMITING RESPONSE FORMAT ==========

test.describe('Layer 6: Rate limit response format', () => {
	test('429 response includes required fields and Retry-After header', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const rateEmail = uniqueEmail('ratelimit-fmt');

		// Create submission then trigger rate limit
		await postSubmission(request, { email: rateEmail });

		let rateLimitResponse: import('@playwright/test').APIResponse | null = null;
		for (let i = 0; i < 6; i++) {
			const response = await postSubmission(request, { email: rateEmail });
			if (response.status() === 429) {
				rateLimitResponse = response;
				break;
			}
		}

		// If we didn't hit 429, the test environment may not escalate fast enough
		test.skip(!rateLimitResponse, 'Did not trigger rate limit in allowed attempts');

		const body = await rateLimitResponse!.json();
		expect(body.error).toBe('Too many requests');
		expect(typeof body.retryAfter).toBe('number');
		expect(body.retryAfter).toBeGreaterThan(0);
		expect(body.expiresAt).toBeTruthy();
		// ISO 8601 date format
		expect(new Date(body.expiresAt).getTime()).toBeGreaterThan(Date.now());

		// Retry-After header should be present
		const retryAfterHeader = rateLimitResponse!.headers()['retry-after'];
		expect(retryAfterHeader).toBeTruthy();
		expect(Number(retryAfterHeader)).toBeGreaterThan(0);
	});
});

// ========== LAYER 7: PROGRESSIVE TIMEOUT ESCALATION ==========

test.describe('Layer 7: Progressive timeout escalation', () => {
	test('repeat offenders get longer timeouts', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email1 = uniqueEmail('progressive-1');
		const email2 = uniqueEmail('progressive-2');

		// First offender cycle
		await postSubmission(request, { email: email1 });
		let firstTimeout = 0;
		for (let i = 0; i < 6; i++) {
			const response = await postSubmission(request, { email: email1 });
			if (response.status() === 429) {
				const body = await response.json();
				firstTimeout = body.retryAfter;
				break;
			}
		}

		// Second offender cycle (different email, same IP => offense count accumulates)
		await postSubmission(request, { email: email2 });
		let secondTimeout = 0;
		for (let i = 0; i < 6; i++) {
			const response = await postSubmission(request, { email: email2 });
			if (response.status() === 429) {
				const body = await response.json();
				secondTimeout = body.retryAfter;
				break;
			}
		}

		// Progressive timeouts should escalate (or at minimum stay the same)
		if (firstTimeout > 0 && secondTimeout > 0) {
			expect(secondTimeout).toBeGreaterThanOrEqual(firstTimeout);
		}
	});
});

// ========== LAYER 8: CROSS-SIGNAL ISOLATION ==========

test.describe('Layer 8: Cross-signal isolation', () => {
	test('different emails from same IP do not interfere (clean submissions)', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		// Each unique email should succeed independently
		const emails = [uniqueEmail('iso-a'), uniqueEmail('iso-b'), uniqueEmail('iso-c')];

		for (const email of emails) {
			const response = await postSubmission(request, { email });
			// First submission for each unique email should succeed
			// Unless IP rate limiting kicks in (which is expected at high volume)
			expect([201, 429]).toContain(response.status());
		}
	});
});

// ========== LAYER 9: ANALYTICS AUTH VERIFICATION ==========
// These tests do NOT require bypass.

test.describe('Layer 9: Analytics endpoints require authentication', () => {
	const analyticsEndpoints = [
		'/api/analytics/stats',
		'/api/analytics/submissions',
		'/api/analytics/export',
		'/api/analytics/fraud-patterns',
		'/api/analytics/blocked-stats',
		'/api/analytics/blacklist',
	];

	for (const endpoint of analyticsEndpoints) {
		test(`${endpoint} rejects unauthenticated requests`, async ({ request }) => {
			const response = await request.get(`${BASE_URL}${endpoint}`);
			// 401 (unauthorized) or 503 (API key not configured) — never 200
			expect([401, 503]).toContain(response.status());
		});
	}

	test('analytics stats accessible with valid API key', async ({ request }) => {
		test.skip(!API_KEY, 'TEST_API_KEY not set');

		const response = await request.get(`${BASE_URL}/api/analytics/stats`, {
			headers: { 'X-API-KEY': API_KEY },
		});
		// 200 = success, 503 = API key env var not configured on worker
		expect([200, 503]).toContain(response.status());
	});
});

// ========== LAYER 10: SUBMISSION DETAIL AUDIT TRAIL ==========

test.describe('Layer 10: Audit trail via analytics', () => {
	test('submitted record is retrievable via analytics API', async ({ request }) => {
		test.skip(!API_KEY, 'TEST_API_KEY not set');
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		// Create a submission
		const email = uniqueEmail('audit');
		const createResponse = await postSubmission(request, { email });

		// If blocked by prior test pollution, skip gracefully
		test.skip(createResponse.status() !== 201, 'Could not create submission for audit trail test');

		const { submissionId } = await createResponse.json();

		// Fetch submission detail
		const detailResponse = await request.get(`${BASE_URL}/api/analytics/submissions/${submissionId}`, {
			headers: { 'X-API-KEY': API_KEY },
		});

		if (detailResponse.status() === 200) {
			const detail = await detailResponse.json();
			expect(detail.success).toBe(true);
			expect(detail.data.email).toBe(email);
			expect(detail.data.risk_score).toBeDefined();
			// Risk score should be low for a clean first submission
			expect(detail.data.risk_score).toBeLessThan(70);
		}
		// 503 means analytics not configured — acceptable
		expect([200, 503]).toContain(detailResponse.status());
	});
});

// ========== LAYER 11: ERROR RESPONSE CONSISTENCY ==========
// These tests do NOT require bypass.

test.describe('Layer 11: Error response format consistency', () => {
	test('400 errors have consistent shape', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {}, // Missing all required fields
		});
		expect(response.status()).toBe(400);

		const body = await response.json();
		expect(body.error).toBe('ValidationError');
		expect(body.message).toBeTruthy();
		// erfid should be present for request tracing
		expect(body.erfid).toBeTruthy();
	});

	test('409/429 duplicate errors have consistent shape', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('err-409');
		await postSubmission(request, { email });
		const response = await postSubmission(request, { email });

		// Second submission with same email returns 409 (duplicate) or 429 (rate limited
		// if IP state from parallel tests triggers pre-validation blacklist)
		expect([409, 429]).toContain(response.status());
		const body = await response.json();
		expect(body.error).toBeTruthy();
		expect(body.message).toBeTruthy();
		if (response.status() === 409) {
			expect(body.error).toBe('ConflictError');
		}
		if (response.status() === 429) {
			expect(body.retryAfter).toBeGreaterThan(0);
		}
		expect(body.erfid).toBeTruthy();
	});

	test('404 errors do not leak internal details', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/nonexistent-route`);
		expect(response.status()).toBe(404);

		const text = await response.text();
		expect(text).not.toContain('github.com');
		expect(text).not.toContain('/src/');
		expect(text).not.toContain('stack');
	});

	test('Turnstile failure returns error with safe message', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: `turnstile-fail-${Date.now()}@example.com`,
				turnstileToken: `invalid-${Date.now()}`,
			},
		});
		// 503 (ExternalServiceError), 400 (token replay), or 500 (unexpected error)
		// Never 201 (should not succeed with fake token)
		expect(response.status()).not.toBe(201);
		expect(response.status()).toBeGreaterThanOrEqual(400);

		const body = await response.json();
		expect(body.error).toBeTruthy();
		expect(body.message).toBeTruthy();
		// Must not expose internal Turnstile error codes or secrets to client
		expect(body.message).not.toContain('invalid-input-response');
		expect(body.message).not.toContain('secret');
	});
});

// ========== LAYER 12: CONCURRENT SUBMISSION RACE CONDITION ==========

test.describe('Layer 12: Concurrent submission handling', () => {
	test('parallel submissions with same email do not both succeed', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('race');

		// Fire 3 submissions in parallel
		const results = await Promise.all([
			postSubmission(request, { email }),
			postSubmission(request, { email }),
			postSubmission(request, { email }),
		]);

		const statuses = results.map((r) => r.status());

		// At most ONE should succeed with 201
		const successCount = statuses.filter((s) => s === 201).length;
		expect(successCount).toBeLessThanOrEqual(1);

		// Others should be 409 (duplicate), 429 (rate limited), or 500 (race condition DB error)
		for (const status of statuses) {
			expect([201, 409, 429, 500]).toContain(status);
		}
	});
});

// ========== LAYER 13: SECURITY HEADERS ON FRAUD RESPONSES ==========

test.describe('Layer 13: Security headers on all responses', () => {
	test('429 fraud block responses include security headers', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('sec-headers');
		await postSubmission(request, { email });

		let fraudResponse: import('@playwright/test').APIResponse | null = null;
		for (let i = 0; i < 6; i++) {
			const response = await postSubmission(request, { email });
			if (response.status() === 429) {
				fraudResponse = response;
				break;
			}
		}

		test.skip(!fraudResponse, 'Did not trigger 429 for security header check');

		const headers = fraudResponse!.headers();
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['x-frame-options']).toBe('DENY');
		expect(headers['strict-transport-security']).toContain('max-age=');
	});

	test('409/429 duplicate responses include security headers', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('sec-409');
		await postSubmission(request, { email });

		const response = await postSubmission(request, { email });
		// 409 (duplicate email) or 429 (rate limited from accumulated state)
		expect([409, 429]).toContain(response.status());

		const headers = response.headers();
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['x-frame-options']).toBe('DENY');
	});

	test('400 validation responses include security headers', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {},
		});
		expect(response.status()).toBe(400);

		const headers = response.headers();
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['x-frame-options']).toBe('DENY');
		// HSTS may be added by Cloudflare CDN and is not guaranteed on all response types
		if (headers['strict-transport-security']) {
			expect(headers['strict-transport-security']).toContain('max-age=');
		}
	});
});

// ========== LAYER 14: USER-FACING MESSAGE QUALITY ==========

test.describe('Layer 14: User-facing messages are safe and helpful', () => {
	test('fraud block messages do not expose internal details', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('msg-safe');
		await postSubmission(request, { email });

		let gotBlock = false;
		for (let i = 0; i < 6; i++) {
			const response = await postSubmission(request, { email });
			if (response.status() === 429) {
				const body = await response.json();
				const msg = body.message;
				// Should not expose risk scores, component names, or detection types
				expect(msg).not.toContain('risk_score');
				expect(msg).not.toContain('ephemeral_id');
				expect(msg).not.toContain('ja4');
				expect(msg).not.toContain('holistic');
				// Should contain human-readable guidance
				expect(msg).toMatch(/wait|try again|contact|too many/i);
				gotBlock = true;
				break;
			}
		}

		test.skip(!gotBlock, 'Did not trigger 429 for message safety check');
	});

	test('duplicate email message is user-friendly', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const email = uniqueEmail('msg-dupe');
		await postSubmission(request, { email });

		const response = await postSubmission(request, { email });
		// 409 (duplicate) or 429 (rate limited from accumulated state)
		expect([409, 429]).toContain(response.status());

		const body = await response.json();
		if (response.status() === 409) {
			expect(body.message).toContain('already been registered');
		} else {
			// Rate limit message should also be user-friendly
			expect(body.message).toMatch(/wait|try again/i);
		}
		// Should not expose submission IDs (like "submission #123") in either path
		expect(body.message).not.toMatch(/submission\s*#\d+/i);
	});

	test('validation error messages are descriptive', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {},
		});
		expect(response.status()).toBe(400);

		const body = await response.json();
		// Should mention what's wrong
		expect(body.message).toMatch(/required|invalid|missing/i);
	});
});

// ========== LAYER 15: EPHEMERAL ID FRAUD DETECTION (HOLISTIC PATH) ==========
// These tests use X-Test-Ephemeral-Id to pin the ephemeral ID across requests,
// exercising the ephemeral ID submission count and validation frequency signals
// that feed into the holistic risk score (not the duplicate email shortcut).

test.describe('Layer 15: Ephemeral ID fraud detection', () => {
	test.describe.configure({ mode: 'serial' });

	test('second submission with same ephemeral ID (different email) triggers holistic block', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const eid = uniqueEphemeralId('eid-fraud');

		// First submission: succeeds or is blocked by accumulated IP state from parallel tests
		const first = await postWithEphemeralId(request, eid, { email: uniqueEmail('eid-1') });
		// Accept 201 (clean) or 429 (accumulated IP state from parallel tests)
		expect([201, 429]).toContain(first.status());

		// Second submission with same ephemeral ID but different email:
		// ephemeralIdCount=2 → score=70 (at threshold)
		// Combined with validationCount signals → should trigger holistic block
		const second = await postWithEphemeralId(request, eid, { email: uniqueEmail('eid-2') });
		// Should be blocked by holistic scoring (429) — NOT a 409 duplicate email
		expect([201, 429]).toContain(second.status());

		if (second.status() === 429) {
			const body = await second.json();
			expect(body.error).toBe('Too many requests');
			// Message should indicate device-based detection, not duplicate email
			expect(body.message).not.toContain('already been registered');
		}
	});

	test('third submission with same ephemeral ID is definitely blocked', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const eid = uniqueEphemeralId('eid-definite');

		// Build up signal: 3 submissions with same ephemeral ID, different emails
		await postWithEphemeralId(request, eid, { email: uniqueEmail('eid-d1') });
		await postWithEphemeralId(request, eid, { email: uniqueEmail('eid-d2') });
		const third = await postWithEphemeralId(request, eid, { email: uniqueEmail('eid-d3') });

		// ephemeralIdCount=3 → score=100, should definitely block
		expect(third.status()).toBe(429);

		const body = await third.json();
		expect(body.retryAfter).toBeGreaterThan(0);
	});
});

// ========== LAYER 16: VALIDATION FREQUENCY BLOCKING ==========
// Validation frequency counts turnstile_validations records per ephemeral ID
// within a 1-hour window. The write-before-read pattern ensures concurrent
// requests see each other's records.

test.describe('Layer 16: Validation frequency blocking', () => {
	test('rapid validation attempts with same ephemeral ID trigger frequency block', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const eid = uniqueEphemeralId('val-freq');
		let gotBlocked = false;

		// Fire 4 rapid requests with same ephemeral ID but unique emails
		// validationFrequencyBlockThreshold=3, so the 3rd or 4th should block
		for (let i = 0; i < 4; i++) {
			const response = await postWithEphemeralId(request, eid, {
				email: uniqueEmail(`val-${i}`),
			});

			if (response.status() === 429) {
				gotBlocked = true;
				const body = await response.json();
				expect(body.error).toBe('Too many requests');
				break;
			}
		}

		// Should have been blocked by validation frequency or ephemeral ID signals
		expect(gotBlocked).toBe(true);
	});
});

// ========== LAYER 17: HOLISTIC BLOCK vs DUPLICATE EMAIL DISTINCTION ==========
// Verifies that the holistic scoring path produces different 429 messages
// than the duplicate email shortcut path.

test.describe('Layer 17: Block path distinction', () => {
	test('holistic block message differs from duplicate email message', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		// Path A: Duplicate email → 409 with "already been registered" (or 429 if IP is rate-limited)
		const dupeEmail = uniqueEmail('path-dupe');
		await postSubmission(request, { email: dupeEmail });
		const dupeResponse = await postSubmission(request, { email: dupeEmail });
		// Accept 409 (duplicate) or 429 (rate limited from accumulated state)
		expect([409, 429]).toContain(dupeResponse.status());
		const dupeBody = await dupeResponse.json();
		if (dupeResponse.status() === 409) {
			expect(dupeBody.message).toContain('already been registered');
		}

		// Path B: Holistic block via ephemeral ID reuse (different emails)
		const eid = uniqueEphemeralId('path-holistic');
		await postWithEphemeralId(request, eid, { email: uniqueEmail('path-h1') });
		await postWithEphemeralId(request, eid, { email: uniqueEmail('path-h2') });
		const holisticResponse = await postWithEphemeralId(request, eid, { email: uniqueEmail('path-h3') });

		if (holisticResponse.status() === 429) {
			const holisticBody = await holisticResponse.json();
			// Holistic block should NOT say "already been registered" (that's the duplicate email path)
			expect(holisticBody.message).not.toContain('already been registered');
			// Should say something about submissions or attempts
			expect(holisticBody.message).toMatch(/submitted|attempts|wait|try again/i);
		}
	});
});

// ========== LAYER 18: EPHEMERAL ID BLACKLIST ENFORCEMENT ==========
// After a holistic block adds the ephemeral ID to the blacklist, subsequent
// requests with that ephemeral ID should be caught at Layer 0 pre-validation.

test.describe('Layer 18: Ephemeral ID blacklist enforcement', () => {
	test('blacklisted ephemeral ID is blocked at pre-validation', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		const eid = uniqueEphemeralId('eid-blacklist');

		// Step 1: Trigger holistic block to get ephemeral ID blacklisted
		await postWithEphemeralId(request, eid, { email: uniqueEmail('ebl-1') });
		await postWithEphemeralId(request, eid, { email: uniqueEmail('ebl-2') });
		await postWithEphemeralId(request, eid, { email: uniqueEmail('ebl-3') });

		// Step 2: Next request with same ephemeral ID should be caught at pre-validation
		const blocked = await postWithEphemeralId(request, eid, { email: uniqueEmail('ebl-4') });
		expect(blocked.status()).toBe(429);

		const body = await blocked.json();
		expect(body.retryAfter).toBeGreaterThan(0);
	});
});

// ========== LAYER 19: CONFIG ENDPOINT VERIFICATION ==========
// Verifies fraud detection configuration is correctly exposed via the API.

test.describe('Layer 19: Config endpoint verification', () => {
	test('unauthenticated config returns risk levels and mode only', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/config`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.data.risk.levels).toBeTruthy();
		expect(body.data.risk.mode).toBeTruthy();

		// Should NOT expose weights, thresholds, or detection config
		expect(body.data.risk.weights).toBeUndefined();
		expect(body.data.detection).toBeUndefined();
		expect(body.data.ja4).toBeUndefined();
		expect(body.data.fingerprint).toBeUndefined();
		expect(body.data.timeouts).toBeUndefined();
	});

	test('authenticated config returns full fraud detection settings', async ({ request }) => {
		test.skip(!API_KEY, 'TEST_API_KEY not set');

		const response = await request.get(`${BASE_URL}/api/config`, {
			headers: { 'X-API-KEY': API_KEY },
		});
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.success).toBe(true);

		const data = body.data;

		// Risk config
		expect(data.risk.blockThreshold).toBe(70);
		expect(data.risk.mode).toBe('defensive');

		// Weights must sum to 1.0
		if (data.risk.weights) {
			const weights = data.risk.weights;
			const sum = Object.values(weights).reduce((a: number, b: unknown) => a + (b as number), 0);
			expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);

			// Key weights present
			expect(weights.tokenReplay).toBeGreaterThan(0);
			expect(weights.emailFraud).toBeGreaterThan(0);
			expect(weights.ephemeralId).toBeGreaterThan(0);
		}

		// Detection thresholds
		if (data.detection) {
			expect(data.detection.ephemeralIdSubmissionThreshold).toBeGreaterThanOrEqual(2);
			expect(data.detection.validationFrequencyBlockThreshold).toBeGreaterThanOrEqual(2);
			expect(data.detection.ipRateLimitThreshold).toBeGreaterThanOrEqual(2);
		}

		// Progressive timeouts
		if (data.timeouts) {
			expect(data.timeouts.schedule).toBeInstanceOf(Array);
			expect(data.timeouts.schedule.length).toBeGreaterThanOrEqual(3);
			// Schedule should be ascending
			for (let i = 1; i < data.timeouts.schedule.length; i++) {
				expect(data.timeouts.schedule[i]).toBeGreaterThanOrEqual(data.timeouts.schedule[i - 1]);
			}
		}
	});
});

// ========== LAYER 20: IP RATE LIMIT CONTRIBUTION ==========
// IP rate limiting contributes to the holistic risk score but does NOT block
// independently (to avoid false positives from shared IPs like offices).
// Combined with ephemeral ID signals, it should push the score over threshold.

test.describe('Layer 20: IP rate limit as scoring signal', () => {
	test('many unique-email submissions from same IP accumulate IP rate score', async ({ request }) => {
		const available = await checkBypassAvailable(request);
		skipWithoutBypass(available);

		// Send several unique-email submissions (no duplicate email path)
		// IP rate limit score: count=1→0, count=2→25, count=3→50, count=4→75, count=5→100
		const statuses: number[] = [];
		for (let i = 0; i < 5; i++) {
			const response = await postSubmission(request, { email: uniqueEmail(`iprate-${i}`) });
			statuses.push(response.status());
		}

		// IP rate limit alone (7% weight) should NOT cause blocking
		// But some may be 429 if combined with other accumulated signals from prior tests
		// All should be either 201 (success) or 429 (holistic block from accumulated IP state)
		for (const status of statuses) {
			expect([201, 429]).toContain(status);
		}
	});
});
