import { createHash } from 'node:crypto';
import type { TurnstileValidationResult, FraudCheckResult } from './types';
import logger from './logger';

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

		if (!result.success) {
			logger.warn(
				{ errorCodes: result['error-codes'] },
				'Turnstile validation failed'
			);
			return {
				valid: false,
				reason: 'turnstile_validation_failed',
				errors: result['error-codes'] || [],
			};
		}

		// Extract ephemeral ID if available (Enterprise only)
		const ephemeralId = result.metadata?.ephemeral_id || null;

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
 * Check for fraud patterns based on ephemeral ID
 * Only checks last 7 days while ephemeral ID is likely still active
 */
export async function checkEphemeralIdFraud(
	ephemeralId: string,
	db: D1Database
): Promise<FraudCheckResult> {
	const warnings: string[] = [];
	let riskScore = 0;

	try {
		// Check submissions in last 7 days (while ephemeral ID is likely active)
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

		const recentSubmissions = await db
			.prepare(
				`SELECT COUNT(*) as count
				 FROM submissions
				 WHERE ephemeral_id = ?
				 AND created_at > ?`
			)
			.bind(ephemeralId, sevenDaysAgo)
			.first<{ count: number }>();

		if (recentSubmissions && recentSubmissions.count >= 5) {
			warnings.push('Multiple submissions in last 7 days');
			riskScore += 30;
		}

		if (recentSubmissions && recentSubmissions.count >= 10) {
			warnings.push('Excessive submissions detected');
			riskScore += 40;
		}

		// Check validation attempts in last hour
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

		const recentValidations = await db
			.prepare(
				`SELECT COUNT(*) as count
				 FROM turnstile_validations
				 WHERE ephemeral_id = ?
				 AND created_at > ?`
			)
			.bind(ephemeralId, oneHourAgo)
			.first<{ count: number }>();

		if (recentValidations && recentValidations.count >= 10) {
			warnings.push('Multiple validation attempts in last hour');
			riskScore += 25;
		}

		const allowed = riskScore < 70;

		logger.info(
			{
				ephemeralId,
				riskScore,
				allowed,
				warnings,
				recentSubmissions: recentSubmissions?.count || 0,
				recentValidations: recentValidations?.count || 0,
			},
			'Fraud check completed'
		);

		return {
			allowed,
			reason: allowed ? undefined : 'High risk based on recent activity',
			riskScore,
			warnings,
		};
	} catch (error) {
		logger.error({ error, ephemeralId }, 'Error during fraud check');
		// Fail secure: if fraud check fails, allow but log warning
		return {
			allowed: true,
			reason: 'Fraud check failed (allowing)',
			riskScore: 0,
			warnings: ['Fraud check error'],
		};
	}
}

/**
 * Fallback fraud check based on IP when ephemeral ID is not available
 */
export async function checkIpFraud(
	remoteIp: string,
	db: D1Database
): Promise<FraudCheckResult> {
	const warnings: string[] = [];
	let riskScore = 0;

	try {
		// Check IP submissions in last hour
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

		const recentSubmissions = await db
			.prepare(
				`SELECT COUNT(*) as count
				 FROM submissions
				 WHERE remote_ip = ?
				 AND created_at > ?`
			)
			.bind(remoteIp, oneHourAgo)
			.first<{ count: number }>();

		if (recentSubmissions && recentSubmissions.count >= 3) {
			warnings.push('Multiple submissions from IP in last hour');
			riskScore += 40;
		}

		if (recentSubmissions && recentSubmissions.count >= 5) {
			warnings.push('Excessive submissions from IP');
			riskScore += 30;
		}

		const allowed = riskScore < 70;

		logger.info(
			{
				remoteIp,
				riskScore,
				allowed,
				warnings,
				recentSubmissions: recentSubmissions?.count || 0,
			},
			'IP-based fraud check completed'
		);

		return {
			allowed,
			reason: allowed ? undefined : 'High risk based on IP activity',
			riskScore,
			warnings,
		};
	} catch (error) {
		logger.error({ error, remoteIp }, 'Error during IP fraud check');
		return {
			allowed: true,
			reason: 'Fraud check failed (allowing)',
			riskScore: 0,
			warnings: ['Fraud check error'],
		};
	}
}
