import { createHash } from 'node:crypto';
import type { TurnstileValidationResult, FraudCheckResult } from './types';
import logger from './logger';
import { addToBlacklist } from './fraud-prevalidation';

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
 * Research-based thresholds: Legitimate users submit 1-2 times max, 3+ = abuse
 * Time window: 1 hour for registration forms
 */
export async function checkEphemeralIdFraud(
	ephemeralId: string,
	db: D1Database
): Promise<FraudCheckResult> {
	const warnings: string[] = [];
	let riskScore = 0;

	try {
		// Check submissions in last hour (research: 3-5 per hour is industry standard limit)
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

		const recentSubmissions = await db
			.prepare(
				`SELECT COUNT(*) as count
				 FROM submissions
				 WHERE ephemeral_id = ?
				 AND created_at > ?`
			)
			.bind(ephemeralId, oneHourAgo)
			.first<{ count: number }>();

		const submissionCount = recentSubmissions?.count || 0;

		// Hard block: 3+ submissions in 1 hour (clear abuse)
		if (submissionCount >= 3) {
			warnings.push('Excessive submissions in last hour (3+)');
			riskScore = 100;
		}
		// Warning: 2 submissions in 1 hour (possible duplicate/error)
		else if (submissionCount >= 2) {
			warnings.push('Multiple submissions detected (2)');
			riskScore = 50;
		}

		// Check validation attempts (high-frequency token generation = bot)
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

		// 10+ validation attempts in an hour = suspicious
		if (validationCount >= 10) {
			warnings.push('High-frequency validation attempts (10+)');
			riskScore += 30;
		}

		const allowed = riskScore < 70;

		// Auto-blacklist high-risk ephemeral IDs
		if (!allowed && riskScore >= 70) {
			const confidence = riskScore >= 100 ? 'high' : riskScore >= 80 ? 'medium' : 'low';
			// High confidence (100): 7 days, Medium (80+): 3 days, Low (70+): 1 day
			const expiresIn = riskScore >= 100 ? 86400 * 7 : riskScore >= 80 ? 86400 * 3 : 86400;

			await addToBlacklist(db, {
				ephemeralId,
				blockReason: `Automated: ${submissionCount} submissions in 1 hour - ${warnings.join(', ')}`,
				confidence,
				expiresIn,
				submissionCount: submissionCount,
				detectionMetadata: {
					risk_score: riskScore,
					warnings,
					submissions_1h: submissionCount,
					validations_1h: validationCount,
					detected_at: new Date().toISOString(),
				},
			});

			logger.warn(
				{
					ephemeralId,
					riskScore,
					confidence,
					expiresIn,
					submissionCount,
					validationCount,
				},
				'Ephemeral ID auto-blacklisted'
			);
		}

		logger.info(
			{
				ephemeralId,
				riskScore,
				allowed,
				warnings,
				submissions_1h: submissionCount,
				validations_1h: validationCount,
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
 * Note: Less reliable than ephemeral ID (shared IPs, proxies, NAT)
 * Use same thresholds as ephemeral ID but with lower confidence
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

		const submissionCount = recentSubmissions?.count || 0;

		// Use same thresholds as ephemeral ID but with caution (shared IPs exist)
		if (submissionCount >= 5) {
			warnings.push('Excessive submissions from IP (5+)');
			riskScore = 100;
		} else if (submissionCount >= 3) {
			warnings.push('Multiple submissions from IP (3-4)');
			riskScore = 70;
		}

		const allowed = riskScore < 70;

		// Auto-blacklist high-risk IPs (but with shorter durations due to shared IP concerns)
		if (!allowed && riskScore >= 70) {
			const confidence = riskScore >= 100 ? 'medium' : 'low'; // Never 'high' for IPs (shared IPs exist)
			// Shorter blacklist periods for IPs: 3 days max (vs 7 for ephemeral IDs)
			const expiresIn = riskScore >= 100 ? 86400 * 3 : 86400;

			await addToBlacklist(db, {
				ipAddress: remoteIp,
				blockReason: `Automated: ${submissionCount} submissions in 1 hour - ${warnings.join(', ')}`,
				confidence,
				expiresIn,
				submissionCount: submissionCount,
				detectionMetadata: {
					risk_score: riskScore,
					warnings,
					submissions_1h: submissionCount,
					detected_at: new Date().toISOString(),
					note: 'IP-based detection (less reliable)',
				},
			});

			logger.warn(
				{
					remoteIp,
					riskScore,
					confidence,
					expiresIn,
					submissionCount,
				},
				'IP address auto-blacklisted (fallback detection)'
			);
		}

		logger.info(
			{
				remoteIp,
				riskScore,
				allowed,
				warnings,
				submissions_1h: submissionCount,
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
