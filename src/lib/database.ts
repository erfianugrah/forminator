import type { RequestMetadata, TurnstileValidationResult, FormSubmission } from './types';
import logger from './logger';

/**
 * Log Turnstile validation attempt to database
 */
export async function logValidation(
	db: D1Database,
	data: {
		tokenHash: string;
		validation: TurnstileValidationResult;
		metadata: RequestMetadata;
		riskScore: number;
		allowed: boolean;
		blockReason?: string;
		submissionId?: number;
	}
): Promise<void> {
	try {
		await db
			.prepare(
				`INSERT INTO turnstile_validations (
					token_hash, success, allowed, block_reason, challenge_ts, hostname,
					action, ephemeral_id, risk_score, error_codes, submission_id,
					remote_ip, user_agent, country, region, city, postal_code, timezone,
					continent, is_eu_country, asn, as_organization, colo, http_protocol,
					tls_version, bot_score, client_trust_score, verified_bot, js_detection_passed,
					detection_ids, ja3_hash, ja4, ja4_signals
				) VALUES (
					?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
					?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
					?, ?, ?, ?, ?, ?, ?, ?, ?
				)`
			)
			.bind(
				data.tokenHash,
				data.validation.valid,
				data.allowed,
				data.blockReason || null,
				data.validation.data?.challenge_ts || null,
				data.validation.data?.hostname || null,
				data.validation.data?.action || null,
				data.validation.ephemeralId || null,
				data.riskScore,
				data.validation.errors ? JSON.stringify(data.validation.errors) : null,
				data.submissionId || null,
				// Request metadata
				data.metadata.remoteIp,
				data.metadata.userAgent,
				data.metadata.country || null,
				data.metadata.region || null,
				data.metadata.city || null,
				data.metadata.postalCode || null,
				data.metadata.timezone || null,
				data.metadata.continent || null,
				data.metadata.isEuCountry || null,
				data.metadata.asn || null,
				data.metadata.asOrganization || null,
				data.metadata.colo || null,
				data.metadata.httpProtocol || null,
				data.metadata.tlsVersion || null,
				data.metadata.botScore || null,
				data.metadata.clientTrustScore || null,
				data.metadata.verifiedBot || false,
				data.metadata.jsDetectionPassed || false,
				data.metadata.detectionIds ? JSON.stringify(data.metadata.detectionIds) : null,
				data.metadata.ja3Hash || null,
				data.metadata.ja4 || null,
				data.metadata.ja4Signals ? JSON.stringify(data.metadata.ja4Signals) : null
			)
			.run();

		logger.info({ tokenHash: data.tokenHash, success: data.validation.valid }, 'Validation logged');
	} catch (error) {
		logger.error({ error }, 'Error logging validation');
		throw error;
	}
}

/**
 * Create form submission in database
 */
export async function createSubmission(
	db: D1Database,
	formData: FormSubmission,
	metadata: RequestMetadata,
	ephemeralId?: string | null
): Promise<number> {
	try {
		const result = await db
			.prepare(
				`INSERT INTO submissions (
					first_name, last_name, email, phone, address, date_of_birth,
					ephemeral_id, remote_ip, user_agent, country, region, city,
					postal_code, timezone, latitude, longitude, continent, is_eu_country,
					asn, as_organization, colo, http_protocol, tls_version, tls_cipher,
					bot_score, client_trust_score, verified_bot, detection_ids,
					ja3_hash, ja4, ja4_signals
				) VALUES (
					?, ?, ?, ?, ?, ?,
					?, ?, ?, ?, ?, ?,
					?, ?, ?, ?, ?, ?,
					?, ?, ?, ?, ?, ?,
					?, ?, ?, ?,
					?, ?, ?
				)`
			)
			.bind(
				formData.firstName,
				formData.lastName,
				formData.email,
				formData.phone,
				formData.address,
				formData.dateOfBirth,
				ephemeralId || null,
				metadata.remoteIp,
				metadata.userAgent,
				metadata.country || null,
				metadata.region || null,
				metadata.city || null,
				metadata.postalCode || null,
				metadata.timezone || null,
				metadata.latitude || null,
				metadata.longitude || null,
				metadata.continent || null,
				metadata.isEuCountry || null,
				metadata.asn || null,
				metadata.asOrganization || null,
				metadata.colo || null,
				metadata.httpProtocol || null,
				metadata.tlsVersion || null,
				metadata.tlsCipher || null,
				metadata.botScore || null,
				metadata.clientTrustScore || null,
				metadata.verifiedBot || false,
				metadata.detectionIds ? JSON.stringify(metadata.detectionIds) : null,
				metadata.ja3Hash || null,
				metadata.ja4 || null,
				metadata.ja4Signals ? JSON.stringify(metadata.ja4Signals) : null
			)
			.run();

		// D1 returns lastRowId as a string, convert to number
		const submissionId = typeof result.meta.last_row_id === 'string'
			? parseInt(result.meta.last_row_id, 10)
			: result.meta.last_row_id;

		logger.info(
			{ submissionId, email: formData.email, ephemeralId },
			'Submission created'
		);

		return submissionId;
	} catch (error) {
		logger.error({ error }, 'Error creating submission');
		throw error;
	}
}

/**
 * Get submission by ID
 */
export async function getSubmission(db: D1Database, id: number) {
	try {
		return await db
			.prepare('SELECT * FROM submissions WHERE id = ?')
			.bind(id)
			.first();
	} catch (error) {
		logger.error({ error, id }, 'Error fetching submission');
		throw error;
	}
}

/**
 * Get recent submissions for analytics
 */
export async function getRecentSubmissions(
	db: D1Database,
	limit: number = 50,
	offset: number = 0
) {
	try {
		const result = await db
			.prepare(
				`SELECT id, first_name, last_name, email, country, city, bot_score,
				 created_at FROM submissions
				 ORDER BY created_at DESC
				 LIMIT ? OFFSET ?`
			)
			.bind(limit, offset)
			.all();

		return result.results;
	} catch (error) {
		logger.error({ error }, 'Error fetching recent submissions');
		throw error;
	}
}

/**
 * Get validation statistics
 */
export async function getValidationStats(db: D1Database) {
	try {
		const stats = await db
			.prepare(
				`SELECT
					COUNT(*) as total,
					SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
					SUM(CASE WHEN allowed = 1 THEN 1 ELSE 0 END) as allowed,
					AVG(risk_score) as avg_risk_score,
					COUNT(DISTINCT ephemeral_id) as unique_ephemeral_ids
				 FROM turnstile_validations`
			)
			.first<{
				total: number;
				successful: number;
				allowed: number;
				avg_risk_score: number;
				unique_ephemeral_ids: number;
			}>();

		return stats;
	} catch (error) {
		logger.error({ error }, 'Error fetching validation stats');
		throw error;
	}
}

/**
 * Get submissions by country (for analytics)
 */
export async function getSubmissionsByCountry(db: D1Database) {
	try {
		const result = await db
			.prepare(
				`SELECT country, COUNT(*) as count
				 FROM submissions
				 WHERE country IS NOT NULL
				 GROUP BY country
				 ORDER BY count DESC
				 LIMIT 20`
			)
			.all();

		return result.results;
	} catch (error) {
		logger.error({ error }, 'Error fetching submissions by country');
		throw error;
	}
}

/**
 * Get bot score distribution (for analytics)
 */
export async function getBotScoreDistribution(db: D1Database) {
	try {
		const result = await db
			.prepare(
				`SELECT
					CASE
						WHEN bot_score >= 90 THEN '90-100'
						WHEN bot_score >= 70 THEN '70-89'
						WHEN bot_score >= 50 THEN '50-69'
						WHEN bot_score >= 30 THEN '30-49'
						ELSE '0-29'
					END as score_range,
					COUNT(*) as count
				 FROM submissions
				 WHERE bot_score IS NOT NULL
				 GROUP BY score_range
				 ORDER BY score_range DESC`
			)
			.all();

		return result.results;
	} catch (error) {
		logger.error({ error }, 'Error fetching bot score distribution');
		throw error;
	}
}
