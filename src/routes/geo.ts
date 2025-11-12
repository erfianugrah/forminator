import { Hono } from 'hono';

const geo = new Hono();

/**
 * GET /api/geo
 * Returns the user's country code based on Cloudflare geolocation
 */
geo.get('/', (c) => {
	// Cloudflare provides the country code in the CF-IPCountry header
	const countryCode = c.req.header('CF-IPCountry') || 'US';

	return c.json({
		success: true,
		countryCode: countryCode.toLowerCase(),
	});
});

export default geo;
