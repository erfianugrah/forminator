/**
 * Configuration API Endpoint
 *
 * Exposes fraud detection configuration to the frontend
 * Allows UI to dynamically adapt to threshold changes
 */

import { Hono } from 'hono';
import { getConfig } from '../lib/config';
import type { Env } from '../lib/types';

const config = new Hono<{ Bindings: Env }>();

/**
 * GET /api/config
 *
 * Returns public-facing fraud detection configuration.
 * Only exposes risk level ranges needed by the frontend for UI display.
 * Internal thresholds, weights, and detection params are NOT exposed
 * to prevent attackers from crafting evasion strategies.
 */
config.get('/', (c) => {
	try {
		const configuration = getConfig(c.env);

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
			500
		);
	}
});

export { config };
