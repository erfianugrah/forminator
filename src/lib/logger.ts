import pino from 'pino';

// Create logger instance
// Note: env label is static since Workers don't have process.env at module level.
// The actual ENVIRONMENT value is available per-request via Hono context.
export const logger = pino({
	level: 'info',
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
});

// Log levels: trace, debug, info, warn, error, fatal

export default logger;
