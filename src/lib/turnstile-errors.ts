/**
 * Turnstile Error Code Dictionary
 * Complete reference: https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/
 */

export interface TurnstileError {
	code: string;
	category: 'client' | 'server' | 'network' | 'configuration';
	title: string;
	description: string;
	userMessage: string;
	debugMessage: string;
	action: 'retry' | 'reload' | 'contact_support' | 'check_config';
}

export const TURNSTILE_ERRORS: Record<string, TurnstileError> = {
	// Client-Side Errors (100xxx)
	'100xxx': {
		code: '100xxx',
		category: 'client',
		title: 'Initialization Error',
		description: 'Generic client-side initialization error',
		userMessage: 'Unable to load verification. Please refresh the page.',
		debugMessage: 'Turnstile widget failed to initialize',
		action: 'reload',
	},
	'102xxx': {
		code: '102xxx',
		category: 'client',
		title: 'Execution Error',
		description: 'Generic client-side execution error',
		userMessage: 'Verification failed. Please try again.',
		debugMessage: 'Turnstile execution failed',
		action: 'retry',
	},
	'102001': {
		code: '102001',
		category: 'network',
		title: 'Network Error',
		description: 'Failed to fetch necessary resources from Turnstile',
		userMessage: 'Network connection issue. Please check your internet and try again.',
		debugMessage: 'Failed to fetch Turnstile resources',
		action: 'retry',
	},
	'102002': {
		code: '102002',
		category: 'configuration',
		title: 'Invalid Sitekey',
		description: 'The sitekey is invalid or missing',
		userMessage: 'Configuration error. Please contact support.',
		debugMessage: 'Invalid or missing sitekey',
		action: 'check_config',
	},
	'102003': {
		code: '102003',
		category: 'configuration',
		title: 'Invalid Configuration',
		description: 'Widget configuration is invalid',
		userMessage: 'Configuration error. Please contact support.',
		debugMessage: 'Invalid widget configuration',
		action: 'check_config',
	},
	'106xxx': {
		code: '106xxx',
		category: 'client',
		title: 'Widget Interaction Error',
		description: 'Generic widget interaction error',
		userMessage: 'Verification interaction failed. Please try again.',
		debugMessage: 'Widget interaction error',
		action: 'retry',
	},
	'106001': {
		code: '106001',
		category: 'client',
		title: 'Challenge Timeout',
		description: 'User took too long to complete the challenge',
		userMessage: 'Verification timed out. Please try again.',
		debugMessage: 'Challenge timeout',
		action: 'retry',
	},
	'106002': {
		code: '106002',
		category: 'client',
		title: 'Challenge Closed',
		description: 'User closed the challenge before completion',
		userMessage: 'Verification was cancelled. Please complete the challenge.',
		debugMessage: 'User closed challenge',
		action: 'retry',
	},
	'106010': {
		code: '106010',
		category: 'client',
		title: 'Token Expired',
		description: 'Turnstile token expired before submission',
		userMessage: 'Verification expired. Please complete the verification again.',
		debugMessage: 'Turnstile token expired (tokens valid for ~300 seconds)',
		action: 'retry',
	},
	'110xxx': {
		code: '110xxx',
		category: 'network',
		title: 'Network Error',
		description: 'Generic network error',
		userMessage: 'Network issue detected. Please check your connection and try again.',
		debugMessage: 'Network error during Turnstile operation',
		action: 'retry',
	},
	'110420': {
		code: '110420',
		category: 'network',
		title: 'Rate Limited',
		description: 'Too many requests from this client',
		userMessage: 'Too many verification attempts. Please wait a moment and try again.',
		debugMessage: 'Client rate limited by Turnstile',
		action: 'retry',
	},
	'110500': {
		code: '110500',
		category: 'network',
		title: 'Turnstile Service Error',
		description: 'Internal Turnstile service error',
		userMessage: 'Verification service is temporarily unavailable. Please try again.',
		debugMessage: 'Turnstile API returned 500 error',
		action: 'retry',
	},
	'110501': {
		code: '110501',
		category: 'network',
		title: 'Turnstile Service Error',
		description: 'Turnstile service error (Bad Gateway)',
		userMessage: 'Verification service issue. Please try again.',
		debugMessage: 'Turnstile API returned 501 error',
		action: 'retry',
	},
	'110502': {
		code: '110502',
		category: 'network',
		title: 'Turnstile Service Error',
		description: 'Turnstile service error (Bad Gateway)',
		userMessage: 'Verification service issue. Please try again.',
		debugMessage: 'Turnstile API returned 502 error',
		action: 'retry',
	},
	'110503': {
		code: '110503',
		category: 'network',
		title: 'Turnstile Service Unavailable',
		description: 'Turnstile service temporarily unavailable',
		userMessage: 'Verification service is temporarily down. Please try again in a few minutes.',
		debugMessage: 'Turnstile API returned 503 error',
		action: 'retry',
	},
	'110504': {
		code: '110504',
		category: 'network',
		title: 'Turnstile Gateway Timeout',
		description: 'Turnstile service timeout',
		userMessage: 'Verification service timed out. Please try again.',
		debugMessage: 'Turnstile API returned 504 error',
		action: 'retry',
	},
	'120xxx': {
		code: '120xxx',
		category: 'client',
		title: 'Browser Not Supported',
		description: 'Browser does not support Turnstile',
		userMessage: 'Your browser is not supported. Please use a modern browser (Chrome, Firefox, Safari, Edge).',
		debugMessage: 'Browser unsupported or missing required features',
		action: 'contact_support',
	},
	'200xxx': {
		code: '200xxx',
		category: 'client',
		title: 'Internal Widget Error',
		description: 'Generic internal widget error',
		userMessage: 'Verification system error. Please refresh and try again.',
		debugMessage: 'Internal widget error',
		action: 'reload',
	},
	'300xxx': {
		code: '300xxx',
		category: 'server',
		title: 'Server-Side Validation Error',
		description: 'Generic server-side validation error',
		userMessage: 'Unable to verify your submission. Please try again.',
		debugMessage: 'Server-side validation failed',
		action: 'retry',
	},

	// Server-Side Error Codes (from siteverify API)
	'missing-input-secret': {
		code: 'missing-input-secret',
		category: 'configuration',
		title: 'Missing Secret Key',
		description: 'The secret parameter was not passed',
		userMessage: 'Configuration error. Please contact support.',
		debugMessage: 'Server missing TURNSTILE_SECRET_KEY environment variable',
		action: 'check_config',
	},
	'invalid-input-secret': {
		code: 'invalid-input-secret',
		category: 'configuration',
		title: 'Invalid Secret Key',
		description: 'The secret parameter was invalid or did not exist',
		userMessage: 'Configuration error. Please contact support.',
		debugMessage: 'Invalid TURNSTILE_SECRET_KEY in environment',
		action: 'check_config',
	},
	'missing-input-response': {
		code: 'missing-input-response',
		category: 'server',
		title: 'Missing Token',
		description: 'The response parameter (token) was not passed',
		userMessage: 'Verification token missing. Please complete the verification.',
		debugMessage: 'Turnstile token not included in request',
		action: 'retry',
	},
	'invalid-input-response': {
		code: 'invalid-input-response',
		category: 'server',
		title: 'Invalid Token',
		description: 'The response parameter (token) is invalid or has expired',
		userMessage: 'Verification token invalid or expired. Please verify again.',
		debugMessage: 'Turnstile token invalid, expired, or already used',
		action: 'retry',
	},
	'bad-request': {
		code: 'bad-request',
		category: 'server',
		title: 'Bad Request',
		description: 'The request was malformed',
		userMessage: 'Invalid request. Please try again.',
		debugMessage: 'Malformed siteverify request',
		action: 'retry',
	},
	'timeout-or-duplicate': {
		code: 'timeout-or-duplicate',
		category: 'server',
		title: 'Token Expired or Reused',
		description: 'The response parameter has already been validated or has expired',
		userMessage: 'This verification has already been used or expired. Please verify again.',
		debugMessage: 'Token timeout or duplicate submission detected',
		action: 'retry',
	},
	'internal-error': {
		code: 'internal-error',
		category: 'server',
		title: 'Internal Error',
		description: 'An internal error occurred while validating the response parameter',
		userMessage: 'Verification system error. Please try again.',
		debugMessage: 'Turnstile internal validation error',
		action: 'retry',
	},
};

/**
 * Get error details for a given error code
 * Supports both exact matches and wildcard patterns (e.g., "102xxx")
 */
export function getTurnstileError(errorCode: string): TurnstileError {
	// Try exact match first
	if (TURNSTILE_ERRORS[errorCode]) {
		return TURNSTILE_ERRORS[errorCode];
	}

	// Try wildcard match (e.g., "102001" -> "102xxx")
	const wildcardCode = errorCode.slice(0, 3) + 'xxx';
	if (TURNSTILE_ERRORS[wildcardCode]) {
		return { ...TURNSTILE_ERRORS[wildcardCode], code: errorCode };
	}

	// Generic error if not found
	return {
		code: errorCode,
		category: 'client',
		title: 'Unknown Error',
		description: `Unknown Turnstile error: ${errorCode}`,
		userMessage: 'Verification error occurred. Please try again.',
		debugMessage: `Unknown Turnstile error code: ${errorCode}`,
		action: 'retry',
	};
}

/**
 * Get user-friendly error message for display
 */
export function getUserErrorMessage(errorCodes: string[]): string {
	if (!errorCodes || errorCodes.length === 0) {
		return 'Verification failed. Please try again.';
	}

	// Get the first error (usually most relevant)
	const error = getTurnstileError(errorCodes[0]);
	return error.userMessage;
}

/**
 * Get debug information for logging
 */
export function getDebugErrorInfo(errorCodes: string[]): {
	codes: string[];
	messages: string[];
	actions: string[];
	categories: string[];
} {
	const codes = errorCodes || [];
	const errors = codes.map(getTurnstileError);

	return {
		codes,
		messages: errors.map(e => e.debugMessage),
		actions: errors.map(e => e.action),
		categories: errors.map(e => e.category),
	};
}

/**
 * Check if error is configuration-related (needs developer attention)
 */
export function isConfigurationError(errorCodes: string[]): boolean {
	return errorCodes.some(code => {
		const error = getTurnstileError(code);
		return error.category === 'configuration';
	});
}

/**
 * Check if error is user-recoverable (can retry)
 */
export function isRetryableError(errorCodes: string[]): boolean {
	return errorCodes.every(code => {
		const error = getTurnstileError(code);
		return error.action === 'retry';
	});
}
