/**
 * Smoke Test Suite
 *
 * Verifies core API endpoints and security headers are working correctly.
 * These tests run against a live (or local) worker instance.
 *
 * Prerequisites:
 *   - Worker must be running (`wrangler dev --remote` or deployed)
 *   - Override baseURL with TEST_URL env var if not using production
 *
 * Run:
 *   npx playwright test tests/smoke.spec.ts
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.TEST_URL || 'https://form.erfi.dev';

// ========== HEALTH ENDPOINT ==========

test.describe('Health endpoint', () => {
	test('GET /api/health returns 200 with status ok', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/health`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.status).toBe('ok');
		expect(body.timestamp).toBeTruthy();
		expect(body.version).toBeTruthy();
	});
});

// ========== SECURITY HEADERS ==========

test.describe('Security headers', () => {
	test('responses include required security headers', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/health`);
		const headers = response.headers();

		// Must-have headers set by the worker
		expect(headers['x-content-type-options']).toBe('nosniff');
		expect(headers['x-frame-options']).toBe('DENY');
		expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
		expect(headers['permissions-policy']).toContain('geolocation=()');
		expect(headers['content-security-policy']).toContain("default-src 'self'");

		// HSTS is set by the worker but may be stripped/overridden by Cloudflare CDN
		// in production. Only assert when the header is present.
		if (headers['strict-transport-security']) {
			expect(headers['strict-transport-security']).toContain('max-age=');
		}

		// X-XSS-Protection is intentionally not set by the worker (deprecated in all
		// modern browsers and can introduce vulnerabilities in older IE). However,
		// Cloudflare CDN may inject it at the edge, so we only assert absence when
		// testing against a local worker (not through CDN).
		if (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')) {
			expect(headers['x-xss-protection']).toBeUndefined();
		}
	});

	test('CORS headers present for allowed origin', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/health`, {
			headers: { Origin: 'https://form.erfi.dev' },
		});
		const headers = response.headers();

		expect(headers['access-control-allow-origin']).toBeTruthy();
	});
});

// ========== GEO ENDPOINT ==========

test.describe('Geo endpoint', () => {
	test('GET /api/geo returns country code', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/geo`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.countryCode).toBeTruthy();
		// Should be a lowercase 2-char code or 'xx' for unknown
		expect(body.countryCode).toMatch(/^[a-z]{2}$/);
	});
});

// ========== CONFIG ENDPOINT ==========

test.describe('Config endpoint', () => {
	test('GET /api/config returns public config without API key', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/config`);
		expect(response.status()).toBe(200);

		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.data.risk).toBeTruthy();
		expect(body.data.risk.levels).toBeTruthy();
		expect(body.data.risk.mode).toBeTruthy();

		// Should NOT expose weights/thresholds without auth
		expect(body.data.risk.weights).toBeUndefined();
		expect(body.data.detection).toBeUndefined();
	});
});

// ========== ANALYTICS ENDPOINTS (AUTHENTICATION) ==========

test.describe('Analytics authentication', () => {
	test('GET /api/analytics/stats returns 401 without API key', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/analytics/stats`);
		// Should be 401 (unauthorized) or 503 (not configured) — never 200
		expect([401, 503]).toContain(response.status());
	});

	test('GET /api/analytics/submissions returns 401 without API key', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/analytics/submissions`);
		expect([401, 503]).toContain(response.status());
	});

	test('GET /api/analytics/export returns 401 without API key', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/analytics/export`);
		expect([401, 503]).toContain(response.status());
	});
});

// ========== SUBMISSIONS ENDPOINT ==========

test.describe('Submissions endpoint', () => {
	test('POST /api/submissions rejects empty body', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {},
		});
		// Should be 400 (validation error)
		expect(response.status()).toBe(400);
	});

	test('POST /api/submissions rejects missing turnstile token', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'test@example.com',
			},
		});
		// Should be 400 (missing token) — not 500.
		// May be 429 if the test runner's IP is blacklisted from prior fraud test runs.
		expect([400, 429]).toContain(response.status());
		const body = await response.json();
		// Error responses use {error, message} format — no 'success' field
		expect(body.error).toBeTruthy();
		expect(body.message).toBeTruthy();
	});

	test('POST /api/submissions rejects invalid JSON', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: 'not json',
		});
		expect(response.status()).toBe(400);
	});

	test('POST /api/submissions rejects invalid email', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'notanemail',
				turnstileToken: 'fake-token',
			},
		});
		expect(response.status()).toBe(400);
	});

	test('POST /api/submissions rejects invalid date of birth', async ({ request }) => {
		const response = await request.post(`${BASE_URL}/api/submissions`, {
			headers: { 'Content-Type': 'application/json' },
			data: {
				firstName: 'Test',
				lastName: 'User',
				email: 'test@example.com',
				dateOfBirth: '2023-02-30', // Invalid calendar date
				turnstileToken: 'fake-token',
			},
		});
		expect(response.status()).toBe(400);
	});
});

// ========== 404 HANDLING ==========

test.describe('404 handling', () => {
	test('unknown API route returns 404 without leaking internal URLs', async ({ request }) => {
		const response = await request.get(`${BASE_URL}/api/nonexistent-route`);
		expect(response.status()).toBe(404);

		// Response may be JSON (worker 404) or HTML (ASSETS binding 404 in production).
		// Check the body text regardless of format.
		const text = await response.text();
		expect(text).not.toContain('github.com');
		expect(text).not.toContain('/docs/');

		// If JSON, verify the error shape
		const contentType = response.headers()['content-type'] || '';
		if (contentType.includes('application/json')) {
			const body = JSON.parse(text);
			expect(body.error).toBe('Not Found');
		}
	});
});

// ========== CORS PREFLIGHT ==========

test.describe('CORS preflight', () => {
	test('OPTIONS request returns correct CORS headers', async ({ request }) => {
		const response = await request.fetch(`${BASE_URL}/api/submissions`, {
			method: 'OPTIONS',
			headers: {
				Origin: 'https://form.erfi.dev',
				'Access-Control-Request-Method': 'POST',
				'Access-Control-Request-Headers': 'Content-Type,X-API-KEY',
			},
		});

		// Preflight should succeed (200 or 204)
		expect([200, 204]).toContain(response.status());

		const headers = response.headers();
		expect(headers['access-control-allow-origin']).toBeTruthy();
		expect(headers['access-control-allow-methods']).toContain('POST');
	});
});
