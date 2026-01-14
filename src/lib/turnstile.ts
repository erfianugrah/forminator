import { createHash } from 'node:crypto';
import type { TurnstileValidationResult, FraudCheckResult } from './types';
import type { FraudDetectionConfig } from './config';
import logger from './logger';
import { addToBlacklist } from './fraud-prevalidation';
import { calculateNormalizedRiskScore } from './scoring';
import { toSQLiteDateTime } from './utils/datetime';
import {
	getTurnstileError,
	getUserErrorMessage,
	getDebugErrorInfo,
	isConfigurationError,
} from './turnstile-errors';

/**
 * Validate Turnstile token with Cloudflare's siteverify API
 * @see https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
 */
export async function validateTurnstileToken(
	token: string,
	remoteIp: string,
	secretKey: string
): Promise<TurnstileValidationResult> {
	try {
		const response = await fetch(
			'https://challenges.cloudflare.com/turnstile/v0/siteverify',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					secret: secretKey,
					response: token,
					remoteip: remoteIp,
				}),
			}
		);

		if (!response.ok) {
			logger.error(
				{ status: response.status, statusText: response.statusText },
				'Turnstile API request failed'
			);
			return {
				valid: false,
				reason: 'api_request_failed',
				errors: ['API request failed'],
			};
		}

		const result = await response.json<{
			success: boolean;
			challenge_ts?: string;
			hostname?: string;
			action?: string;
			cdata?: string;
			'error-codes'?: string[];
			metadata?: {
				ephemeral_id?: string;
			};
		}>();

		// Extract ephemeral ID if available (Enterprise only)
		// IMPORTANT: Extract ephemeral ID even on failed validations for fraud detection
		const ephemeralId = result.metadata?.ephemeral_id || null;

		if (!result.success) {
			const errorCodes = result['error-codes'] || [];
			const debugInfo = getDebugErrorInfo(errorCodes);

			// Log with enhanced error information
			logger.warn(
				{
					errorCodes,
					errorMessages: debugInfo.messages,
					categories: debugInfo.categories,
					isConfigError: isConfigurationError(errorCodes),
					ephemeralId,
				},
				'Turnstile validation failed'
			);

			// Alert on configuration errors (needs developer attention)
			if (isConfigurationError(errorCodes)) {
				logger.error(
					{ errorCodes, debugInfo },
					'⚠️ CONFIGURATION ERROR: Turnstile misconfigured - immediate attention required'
				);
			}

			return {
				valid: false,
				reason: 'turnstile_validation_failed',
				errors: errorCodes,
				userMessage: getUserErrorMessage(errorCodes),
				debugInfo,
				ephemeralId, // Include ephemeral ID for fraud detection
			};
		}

		if (!ephemeralId) {
			logger.info('⚠️ Ephemeral ID not available (requires Enterprise plan)');
		} else {
			logger.info({ ephemeralId }, 'Ephemeral ID extracted from validation');
		}

		return {
			valid: true,
			data: result,
			ephemeralId,
		};
	} catch (error) {
		logger.error({ error }, 'Turnstile validation error');
		return {
			valid: false,
			reason: 'validation_error',
			errors: ['Internal validation error'],
		};
	}
}

/**
 * Hash token using SHA256 for storage (never store actual token)
 */
export function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

/**
 * Check if token has been used before (replay attack prevention)
 */
export async function checkTokenReuse(
	tokenHash: string,
	db: D1Database
): Promise<boolean> {
	try {
		const result = await db
			.prepare('SELECT id FROM turnstile_validations WHERE token_hash = ? LIMIT 1')
			.bind(tokenHash)
			.first<{ id: number }>();

		return result !== null;
	} catch (error) {
		logger.error({ error }, 'Error checking token reuse');
		// Fail secure: if we can't check, assume it's reused
		return true;
	}
}

/**
 * Calculate progressive timeout based on previous offenses
 * Progressive escalation uses config.timeouts.schedule (default: 1h → 4h → 8h → 12h → 24h)
 *
 * @param offenseCount - Number of previous offenses (1-based)
 * @param config - Fraud detection configuration containing timeout schedule
 * @returns Timeout duration in seconds
 */
export function calculateProgressiveTimeout(
	offenseCount: number,
	config: FraudDetectionConfig
): number {
	const timeWindows = config.timeouts.schedule;
	const maximum = config.timeouts.maximum;

	// Cap at maximum timeout
	const index = Math.min(offenseCount - 1, timeWindows.length - 1);
	const timeout = timeWindows[Math.max(0, index)];

	// Ensure we never exceed the configured maximum
	return Math.min(timeout, maximum);
}

/**
 * Collect ephemeral ID fraud signals without blocking (Phase 3: Holistic Risk Scoring)
 *
 * Extracts behavioral signals from ephemeral ID patterns:
 * - Submission count (24h window)
 * - Validation attempt frequency (1h window)
 * - IP diversity (24h window)
 *
 * @param ephemeralId - Turnstile ephemeral ID
 * @param db - D1 database instance
 * @param config - Fraud detection configuration
 * @returns Signal data for risk scoring (does NOT make blocking decision)
 */
export async function collectEphemeralIdSignals(
	ephemeralId: string,
	db: D1Database,
	config: FraudDetectionConfig
): Promise<{
	submissionCount: number;
	validationCount: number;
	uniqueIPCount: number;
	warnings: string[];
}> {
	const warnings: string[] = [];

	try {
		const oneHourAgo = toSQLiteDateTime(new Date(Date.now() - 60 * 60 * 1000));
		const oneDayAgo = toSQLiteDateTime(new Date(Date.now() - 24 * 60 * 60 * 1000));

		// Signal 1: Submission count (changed to 24h window for consistency)
		const recentSubmissions = await db
			.prepare(
				`SELECT COUNT(*) as count
				 FROM submissions
				 WHERE ephemeral_id = ?
				 AND created_at > ?`
			)
			.bind(ephemeralId, oneDayAgo)
			.first<{ count: number }>();

		const submissionCount = recentSubmissions?.count || 0;
		const effectiveCount = submissionCount + 1; // +1 for current attempt

		if (effectiveCount >= config.detection.ephemeralIdSubmissionThreshold) {
			warnings.push(
				`Multiple submissions detected (${effectiveCount} total in 24h) - registration forms should only be submitted once`
			);
		}

		// Signal 2: Validation frequency (1h window for rapid-fire detection)
		const recentValidations = await db
			.prepare(
				`SELECT COUNT(*) as count
				 FROM turnstile_validations
				 WHERE ephemeral_id = ?
				 AND created_at > ?`
			)
			.bind(ephemeralId, oneHourAgo)
			.first<{ count: number }>();

		const validationCount = recentValidations?.count || 0;
		const effectiveValidationCount = validationCount + 1; // +1 for current attempt

		if (effectiveValidationCount >= config.detection.validationFrequencyBlockThreshold) {
			warnings.push(
				`Excessive validation attempts (${effectiveValidationCount} in 1h) - possible automated attack`
			);
		} else if (effectiveValidationCount >= config.detection.validationFrequencyWarnThreshold) {
			warnings.push(`Multiple validation attempts detected (${effectiveValidationCount} in 1h)`);
		}

		// Signal 3: IP diversity (24h window)
		// Query both submissions AND turnstile_validations to catch proxy rotation
		// attacks that may not result in successful submissions
		const uniqueIps = await db
			.prepare(
				`SELECT COUNT(DISTINCT remote_ip) as count FROM (
					SELECT remote_ip FROM submissions
					WHERE ephemeral_id = ? AND created_at > ?
					UNION
					SELECT remote_ip FROM turnstile_validations
					WHERE ephemeral_id = ? AND created_at > ?
				)`
			)
			.bind(ephemeralId, oneDayAgo, ephemeralId, oneDayAgo)
			.first<{ count: number }>();

		const ipCount = uniqueIps?.count || 0;

		if (ipCount >= config.detection.ipDiversityThreshold && submissionCount > 0) {
			warnings.push(`Multiple IPs for same ephemeral ID (${ipCount} IPs) - proxy rotation detected`);
		}

		logger.info(
			{
				ephemeralId,
				submissions_24h: effectiveCount,
				validations_1h: effectiveValidationCount,
				unique_ips: ipCount,
				warnings,
			},
			'Ephemeral ID signals collected'
		);

		return {
			submissionCount: effectiveCount,
			validationCount: effectiveValidationCount,
			uniqueIPCount: ipCount,
			warnings,
		};
	} catch (error) {
		logger.error({ error, ephemeralId }, 'Error collecting ephemeral ID signals');
		// Fail-open: Return minimal signals if collection fails
		return {
			submissionCount: 1,
			validationCount: 1,
			uniqueIPCount: 1,
			warnings: ['Signal collection error'],
		};
	}
}

/**
 * Create mock validation for testing bypass
 * ONLY used when ALLOW_TESTING_BYPASS=true and X-API-KEY is valid
 *
 * This allows automated testing without solving Turnstile CAPTCHA
 * while still running all fraud detection layers
 */
export function createMockValidation(
	ip: string,
	hostname: string = 'test'
): TurnstileValidationResult {
	// Generate unique ephemeral ID for each test
	const mockEphemeralId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

	return {
		valid: true,
		data: {
			success: true,
			challenge_ts: new Date().toISOString(),
			hostname,
			action: 'test',
			cdata: 'test',
			metadata: {
				ephemeral_id: mockEphemeralId
			}
		},
		ephemeralId: mockEphemeralId
	};
}
