/**
 * IP-Based Behavioral Signal Collection (Layer 0.5)
 *
 * Collects submission frequency signal by IP address for holistic risk scoring.
 * This is a BEHAVIORAL SIGNAL, not a hard block.
 *
 * Use Case - Detects attacks that bypass fingerprint-based detection by:
 * - Switching browsers (different JA4)
 * - Using incognito mode (different ephemeral_id)
 * - Any combination that changes fingerprints
 *
 * Philosophy:
 * - IP count is ONE signal among many (ephemeral_id, JA4, email, etc.)
 * - Contributes to total risk score with configurable weight
 * - Block decision made holistically when combined risk >= threshold
 * - Reduces false positives from shared IPs (offices, universities)
 *
 * Benefits vs Hard Blocking:
 * - ✅ More nuanced: Shared IP + legitimate email = low risk
 * - ✅ More nuanced: Shared IP + fraud patterns = high risk
 * - ✅ Tunable: Adjust weight if false positives occur
 * - ✅ Transparent: Users see risk breakdown, not arbitrary block
 */

import logger from './logger';
import type { FraudDetectionConfig } from './config';
import { toSQLiteDateTime } from './utils/datetime';

export interface IPRateLimitSignals {
	/** Number of submissions from this IP in the time window */
	submissionCount: number;
	/** Risk score contribution (0-100) based on submission frequency */
	riskScore: number;
	/** Warning messages for transparency */
	warnings: string[];
}

/**
 * Collect IP-based behavioral signals for holistic risk scoring
 *
 * This function collects signals ONLY - does NOT make blocking decisions.
 * The calling code combines this with other signals (ephemeral_id, JA4, email)
 * to calculate total risk score and decide whether to block.
 *
 * Risk Score Calculation:
 * - 0 submissions (count=1): 0% - First time visitor
 * - 1 submission (count=2): 25% - Legitimate retry
 * - 2 submissions (count=3): 50% - Multiple retries (suspicious)
 * - 3 submissions (count=4): 75% - High frequency (very suspicious)
 * - 4+ submissions (count=5+): 100% - Extreme frequency (definite attack)
 *
 * @param remoteIp - IP address to check
 * @param db - D1 database instance
 * @param config - Fraud detection configuration
 * @returns Behavioral signals for risk scoring
 */
/**
 * Check for email diversity from the same IP — a classic form-spam indicator.
 * Counts distinct emails submitted from an IP within a time window.
 * 3+ distinct emails from one IP in 1 hour is highly suspicious.
 *
 * @returns A score 0-100 based on email diversity count
 */
export async function collectEmailDiversitySignal(
	remoteIp: string,
	db: D1Database,
	config: FraudDetectionConfig,
): Promise<{ distinctEmails: number; riskScore: number; warning?: string }> {
	const timeWindowSeconds = config.detection.ipRateLimitWindow || 3600;
	const timeAgo = toSQLiteDateTime(new Date(Date.now() - timeWindowSeconds * 1000));

	try {
		const result = await db
			.prepare(
				`SELECT COUNT(DISTINCT email) as count
				 FROM submissions
				 WHERE remote_ip = ?
				 AND created_at > ?`,
			)
			.bind(remoteIp, timeAgo)
			.first<{ count: number }>();

		const distinctEmails = (result?.count || 0) + 1; // +1 for current submission

		let riskScore: number;
		if (distinctEmails <= 1) {
			riskScore = 0;
		} else if (distinctEmails === 2) {
			riskScore = 20; // Could be household
		} else if (distinctEmails === 3) {
			riskScore = 60; // Suspicious
		} else {
			riskScore = 100; // Definite form spam
		}

		const warning =
			distinctEmails >= 3 ? `${distinctEmails} distinct emails from same IP in ${Math.round(timeWindowSeconds / 60)} minutes` : undefined;

		return { distinctEmails, riskScore, warning };
	} catch (error) {
		logger.error({ error, remote_ip: remoteIp }, 'Error collecting email diversity signal');
		return { distinctEmails: 0, riskScore: 0 };
	}
}

export async function collectIPRateLimitSignals(
	remoteIp: string,
	db: D1Database,
	config: FraudDetectionConfig,
): Promise<IPRateLimitSignals> {
	const timeWindowSeconds = config.detection.ipRateLimitWindow || 3600; // Default 1 hour
	const threshold = config.detection.ipRateLimitThreshold || 3; // Default 3 for risk calculation

	const timeAgo = toSQLiteDateTime(new Date(Date.now() - timeWindowSeconds * 1000));

	try {
		// Count ALL activity from this IP in time window — both successful submissions
		// and blocked validation attempts. Without this, an attacker blocked 100 times
		// would still show IP count=0 since blocked requests don't create submissions.
		const result = await db
			.prepare(
				`SELECT
					(SELECT COUNT(*) FROM submissions WHERE remote_ip = ? AND created_at > ?) +
					(SELECT COUNT(*) FROM turnstile_validations WHERE remote_ip = ? AND allowed = 0 AND created_at > ?)
				 AS count`,
			)
			.bind(remoteIp, timeAgo, remoteIp, timeAgo)
			.first<{ count: number }>();

		const submissionCount = result?.count || 0;
		const effectiveCount = submissionCount + 1; // +1 for current submission

		// Calculate risk score (non-linear scaling for better sensitivity)
		// count=1 → 0%, count=2 → 25%, count=3 → 50%, count=4 → 75%, count=5+ → 100%
		let riskScore: number;
		if (effectiveCount === 1) {
			riskScore = 0; // First submission
		} else if (effectiveCount === 2) {
			riskScore = 25; // Legitimate retry
		} else if (effectiveCount === 3) {
			riskScore = 50; // Multiple retries (suspicious)
		} else if (effectiveCount === 4) {
			riskScore = 75; // High frequency (very suspicious)
		} else {
			riskScore = 100; // Extreme frequency (definite attack)
		}

		const warnings: string[] = [];

		if (effectiveCount >= threshold + 1) {
			// Very high count
			warnings.push(`${effectiveCount} submissions from same IP in ${Math.round(timeWindowSeconds / 60)} minutes - extreme frequency`);
		} else if (effectiveCount >= threshold) {
			// At threshold
			warnings.push(`${effectiveCount} submissions from same IP in ${Math.round(timeWindowSeconds / 60)} minutes`);
		} else if (effectiveCount >= 2) {
			// Multiple submissions
			warnings.push(`Multiple submissions from same IP (${effectiveCount} in ${Math.round(timeWindowSeconds / 60)} min)`);
		}

		logger.info(
			{
				detection_type: 'ip_rate_limit_signal',
				remote_ip: remoteIp,
				submission_count: effectiveCount,
				risk_score: riskScore,
				threshold,
			},
			'IP rate limit signals collected',
		);

		return {
			submissionCount: effectiveCount,
			riskScore,
			warnings,
		};
	} catch (error) {
		logger.error({ error, remote_ip: remoteIp }, 'Error collecting IP rate limit signals');

		// Fail open: Return clean signals if collection fails
		return {
			submissionCount: 0,
			riskScore: 0,
			warnings: ['IP rate limit signal collection error - failing open'],
		};
	}
}
