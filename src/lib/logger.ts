import pino from 'pino';

// Create logger instance
export const logger = pino({
	level: 'info',
	base: {
		env: 'production',
	},
	formatters: {
		level: (label) => {
			return { level: label };
		},
	},
});

// Log levels: trace, debug, info, warn, error, fatal

export default logger;
