import { Hono } from 'hono';
import type { Env } from '../lib/types';

const geo = new Hono<{ Bindings: Env }>();

/**
 * GET /api/geo
 * Returns the user's country code based on Cloudflare geolocation.
 * Falls back to 'XX' (unknown) instead of assuming US when the header is missing.
 */
geo.get('/', (c) => {
	// Cloudflare provides the country code in the CF-IPCountry header
	// 'XX' = unknown (Cloudflare convention when geolocation is unavailable)
	const countryCode = c.req.header('CF-IPCountry') || 'XX';

	return c.json({
		success: true,
		countryCode: countryCode.toLowerCase(),
	});
});

export default geo;
