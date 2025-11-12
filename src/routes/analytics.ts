import { Hono } from 'hono';
import type { Env } from '../lib/types';
import {
	getValidationStats,
	getRecentSubmissions,
	getSubmissionsByCountry,
	getBotScoreDistribution,
} from '../lib/database';
import logger from '../lib/logger';

const app = new Hono<{ Bindings: Env }>();

// GET /api/analytics/stats - Get validation statistics
app.get('/stats', async (c) => {
	try {
		const db = c.env.DB;
		const stats = await getValidationStats(db);

		logger.info('Validation stats retrieved');

		return c.json({
			success: true,
			data: stats,
		});
	} catch (error) {
		logger.error({ error }, 'Error fetching validation stats');

		return c.json(
			{
				error: 'Internal server error',
				message: 'Failed to fetch validation statistics',
			},
			500
		);
	}
});

// GET /api/analytics/submissions - Get recent submissions
app.get('/submissions', async (c) => {
	try {
		const db = c.env.DB;

		// Parse query params
		const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100);
		const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

		const submissions = await getRecentSubmissions(db, limit, offset);

		logger.info({ limit, offset, count: submissions.length }, 'Recent submissions retrieved');

		return c.json({
			success: true,
			data: submissions,
			pagination: {
				limit,
				offset,
				count: submissions.length,
			},
		});
	} catch (error) {
		logger.error({ error }, 'Error fetching submissions');

		return c.json(
			{
				error: 'Internal server error',
				message: 'Failed to fetch submissions',
			},
			500
		);
	}
});

// GET /api/analytics/countries - Get submissions by country
app.get('/countries', async (c) => {
	try {
		const db = c.env.DB;
		const countries = await getSubmissionsByCountry(db);

		logger.info({ count: countries.length }, 'Submissions by country retrieved');

		return c.json({
			success: true,
			data: countries,
		});
	} catch (error) {
		logger.error({ error }, 'Error fetching submissions by country');

		return c.json(
			{
				error: 'Internal server error',
				message: 'Failed to fetch country statistics',
			},
			500
		);
	}
});

// GET /api/analytics/bot-scores - Get bot score distribution
app.get('/bot-scores', async (c) => {
	try {
		const db = c.env.DB;
		const distribution = await getBotScoreDistribution(db);

		logger.info('Bot score distribution retrieved');

		return c.json({
			success: true,
			data: distribution,
		});
	} catch (error) {
		logger.error({ error }, 'Error fetching bot score distribution');

		return c.json(
			{
				error: 'Internal server error',
				message: 'Failed to fetch bot score distribution',
			},
			500
		);
	}
});

export default app;
