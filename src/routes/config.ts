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
import { timingSafeCompare } from '../lib/utils/timing-safe';

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

		// Constant-time comparison to prevent timing attacks (does not leak key length)
		const apiKey = c.req.header('X-API-KEY') ?? '';
		const expectedKey = c.env['X-API-KEY'] ?? '';
		const isAuthenticated = timingSafeCompare(apiKey, expectedKey);

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
		// Use structured logging instead of console.error
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorStack = error instanceof Error ? error.stack : undefined;
		// Note: logger is not imported here to keep the config route minimal.
		// Errors in config retrieval are rare (only malformed FRAUD_CONFIG).
		console.error('Config retrieval error:', errorMessage, errorStack);
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
