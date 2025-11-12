import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env } from './lib/types';
import submissionsRoute from './routes/submissions';
import analyticsRoute from './routes/analytics';

const app = new Hono<{ Bindings: Env }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
	origin: (origin) => origin, // Allow all origins for demo (restrict in production)
	allowMethods: ['GET', 'POST', 'OPTIONS'],
	allowHeaders: ['Content-Type'],
	maxAge: 86400,
}));

// API Routes
app.route('/api/submissions', submissionsRoute);
app.route('/api/analytics', analyticsRoute);

// Health check
app.get('/api/health', (c) => {
	return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static assets from Astro build
app.get('*', async (c) => {
	const url = new URL(c.req.url);

	// Request static asset from ASSETS binding
	const assetResponse = await c.env.ASSETS.fetch(c.req.raw);

	return assetResponse;
});

export default app;
