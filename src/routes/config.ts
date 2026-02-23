/**
 * Configuration API Endpoint
 *
 * Exposes fraud detection configuration to the frontend.
 * The unauthenticated path returns only safe display hints (risk levels).
 * The authenticated path (X-API-KEY) returns the full configuration for
 * the analytics dashboard — weights, thresholds, detection params, etc.
 */

import { Hono } from 'hono';
import { getConfig } from '../lib/config';
import type { Env } from '../lib/types';

const config = new Hono<{ Bindings: Env }>();

/**
 * GET /api/config
 *
 * Without API key: returns only risk levels (safe for public form page).
 * With valid API key: returns the full fraud detection configuration
 * so the analytics dashboard has complete observability.
 */
config.get('/', (c) => {
	try {
		const configuration = getConfig(c.env);

		// Check if caller provided a valid API key
		const apiKey = c.req.header('X-API-KEY') ?? '';
		const expectedKey = c.env['X-API-KEY'] ?? '';
		const encoder = new TextEncoder();
		const a = encoder.encode(apiKey);
		const b = encoder.encode(expectedKey);
		const isAuthenticated =
			apiKey.length > 0 &&
			expectedKey.length > 0 &&
			a.byteLength === b.byteLength &&
			(crypto.subtle as unknown as { timingSafeEqual(a: BufferSource, b: BufferSource): boolean }).timingSafeEqual(a, b);

		if (isAuthenticated) {
			// Full config for authenticated analytics dashboard
			return c.json({
				success: true,
				data: configuration,
				version: '2.0.0',
			});
		}

		// Public: only risk level ranges for UI display
		return c.json({
			success: true,
			data: {
				risk: {
					levels: configuration.risk.levels,
					mode: configuration.risk.mode,
				},
			},
			version: '2.0.0',
		});
	} catch (error) {
		console.error('Config retrieval error:', error);
		return c.json(
			{
				success: false,
				error: 'Failed to retrieve configuration',
			},
			500,
		);
	}
});

export { config };
