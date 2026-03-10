import type { RequestMetadata } from './types';
import type { FraudDetectionConfig } from './config';
import logger from './logger';
import { isFingerprintBaselineKnown, recordFingerprintBaseline } from './fingerprint-baseline';
import { toSQLiteDateTime } from './utils/datetime';

type FingerprintTrigger = 'header_fingerprint' | 'tls_anomaly' | 'latency_mismatch';

interface HeaderReuseStats {
	total: number;
	ipCount: number;
	ja4Count: number;
}

interface TlsStats {
	ja4Count: number;
	pairCount: number;
}

interface LatencyStats {
	rtt?: number;
	platform?: string;
	deviceType?: string;
	claimedMobile?: boolean;
	suspectAsn?: boolean;
}

export interface FingerprintSignalsResult {
	headerFingerprintScore: number;
	tlsAnomalyScore: number;
	latencyMismatchScore: number;
	warnings: string[];
	trigger?: FingerprintTrigger;
	detectionType?: string;
	details: {
		headerReuse?: HeaderReuseStats;
		tlsAnomaly?: TlsStats;
		latency?: LatencyStats;
	};
}

const ZERO_RESULT: FingerprintSignalsResult = {
	headerFingerprintScore: 0,
	tlsAnomalyScore: 0,
	latencyMismatchScore: 0,
	warnings: [],
	details: {},
};

function normalizeHint(value?: string | null): string | undefined {
	if (!value) {
		return undefined;
	}
	return value.replace(/^"|"$/g, '');
}

function isMobileClaim(metadata: RequestMetadata, config: FraudDetectionConfig): boolean {
	const platform = normalizeHint(metadata.clientHints?.platform);
	const mobileFlag = metadata.clientHints?.mobile === '?1';
	const ua = metadata.userAgent.toLowerCase();
	const inspectedPlatforms = config.fingerprint.latency.inspectPlatforms.map((p) => p.toLowerCase());
	return (
		mobileFlag || (!!platform && inspectedPlatforms.includes(platform.toLowerCase())) || ua.includes('android') || ua.includes('iphone')
	);
}

function selectTrigger(results: FingerprintSignalsResult): FingerprintSignalsResult {
	const candidates: Array<{ score: number; trigger: FingerprintTrigger; detectionType: string }> = [];
	if (results.headerFingerprintScore > 0) {
		candidates.push({
			score: results.headerFingerprintScore,
			trigger: 'header_fingerprint',
			detectionType: 'header_fingerprint_reuse',
		});
	}
	if (results.tlsAnomalyScore > 0) {
		candidates.push({
			score: results.tlsAnomalyScore,
			trigger: 'tls_anomaly',
			detectionType: 'tls_fingerprint_anomaly',
		});
	}
	if (results.latencyMismatchScore > 0) {
		candidates.push({
			score: results.latencyMismatchScore,
			trigger: 'latency_mismatch',
			detectionType: 'latency_mismatch',
		});
	}

	if (candidates.length === 0) {
		return results;
	}

	const highest = candidates.sort((a, b) => b.score - a.score)[0];
	return {
		...results,
		trigger: highest.trigger,
		detectionType: highest.detectionType,
	};
}

export async function collectFingerprintSignals(
	metadata: RequestMetadata,
	db: D1Database,
	config: FraudDetectionConfig,
): Promise<FingerprintSignalsResult> {
	try {
		const warnings: string[] = [];
		let headerFingerprintScore = 0;
		let tlsAnomalyScore = 0;
		let latencyMismatchScore = 0;
		const details: FingerprintSignalsResult['details'] = {};

		// ---------------------------------------------------------------------
		// Header fingerprint reuse
		// ---------------------------------------------------------------------
		if (metadata.headersFingerprint) {
			const { windowMinutes, minRequests, minDistinctIps, minDistinctJa4 } = config.fingerprint.headerReuse;
			const windowStart = toSQLiteDateTime(new Date(Date.now() - windowMinutes * 60 * 1000));
			const stats = await db
				.prepare(
					`WITH fp_samples AS (
						SELECT remote_ip, ja4
						FROM submissions
						WHERE request_headers IS NOT NULL
							AND extended_metadata IS NOT NULL
							AND json_extract(extended_metadata, '$.headersFingerprint') = ?
							AND created_at > ?
						UNION ALL
						SELECT remote_ip, ja4
						FROM turnstile_validations
						WHERE extended_metadata IS NOT NULL
							AND json_extract(extended_metadata, '$.headersFingerprint') = ?
							AND created_at > ?
					)
					SELECT
						COUNT(*) as total,
						COUNT(DISTINCT remote_ip) as ip_count,
						COUNT(DISTINCT ja4) as ja4_count
					FROM fp_samples`,
				)
				.bind(metadata.headersFingerprint, windowStart, metadata.headersFingerprint, windowStart)
				.first<{ total: number | null; ip_count: number | null; ja4_count: number | null }>();

			const total = stats?.total ?? 0;
			const ipCount = stats?.ip_count ?? 0;
			const ja4Count = stats?.ja4_count ?? 0;
			details.headerReuse = { total, ipCount, ja4Count };

			if (total >= minRequests && ipCount >= minDistinctIps && ja4Count >= minDistinctJa4) {
				// Gradient scoring: scale with how far above each threshold we are.
				// Each factor starts at 1.0 (at threshold) and increases linearly.
				// Combined multiplier produces 50-100 range instead of binary 0/100.
				const totalFactor = Math.min(total / minRequests, 3); // cap at 3x
				const ipFactor = Math.min(ipCount / minDistinctIps, 3);
				const ja4Factor = Math.min(ja4Count / minDistinctJa4, 3);
				// Average of factors: 1.0 → minimum (just met thresholds), 3.0 → maximum (3x all thresholds)
				const avgFactor = (totalFactor + ipFactor + ja4Factor) / 3;
				// Map factor range [1.0, 3.0] to score range [50, 100]
				headerFingerprintScore = Math.round(50 + ((avgFactor - 1) / 2) * 50);
				headerFingerprintScore = Math.min(100, Math.max(50, headerFingerprintScore));
				warnings.push(
					`Header fingerprint reused ${total} times across ${ipCount} IPs and ${ja4Count} JA4 fingerprints in ${windowMinutes} minutes`,
				);
			} else {
				await recordFingerprintBaseline(db, 'header', metadata.headersFingerprint, metadata.ja4, metadata.asn, {
					remoteIp: metadata.remoteIp,
				});
			}
		}

		// ---------------------------------------------------------------------
		// TLS anomaly detection
		// ---------------------------------------------------------------------
		const tlsFingerprintKey = metadata.tlsClientExtensionsSha1;
		if (metadata.ja4 && tlsFingerprintKey) {
			const { baselineHours, minJa4Observations } = config.fingerprint.tlsAnomaly;
			const windowStart = toSQLiteDateTime(new Date(Date.now() - baselineHours * 60 * 60 * 1000));

			const baselineKnown = await isFingerprintBaselineKnown(db, 'tls', tlsFingerprintKey, metadata.ja4, metadata.asn);

			if (baselineKnown) {
				details.tlsAnomaly = { ja4Count: -1, pairCount: 1 };
			} else {
				const ja4CountResult = await db
					.prepare(
						`WITH ja4_samples AS (
								SELECT ja4
								FROM submissions
								WHERE ja4 = ?
									AND created_at > ?
								UNION ALL
								SELECT ja4
								FROM turnstile_validations
								WHERE ja4 = ?
									AND created_at > ?
							)
							SELECT COUNT(*) as count
							FROM ja4_samples`,
					)
					.bind(metadata.ja4, windowStart, metadata.ja4, windowStart)
					.first<{ count: number | null }>();

				const ja4Count = ja4CountResult?.count ?? 0;

				if (ja4Count >= minJa4Observations) {
					const pairResult = await db
						.prepare(
							`WITH tls_pairs AS (
									SELECT ja4
									FROM submissions
									WHERE ja4 = ?
										AND extended_metadata IS NOT NULL
										AND json_extract(extended_metadata, '$.tlsClientExtensionsSha1') = ?
										AND created_at > ?
									UNION ALL
									SELECT ja4
									FROM turnstile_validations
									WHERE ja4 = ?
										AND extended_metadata IS NOT NULL
										AND json_extract(extended_metadata, '$.tlsClientExtensionsSha1') = ?
										AND created_at > ?
								)
								SELECT COUNT(*) as count
								FROM tls_pairs`,
						)
						.bind(metadata.ja4, tlsFingerprintKey, windowStart, metadata.ja4, tlsFingerprintKey, windowStart)
						.first<{ count: number | null }>();

					const pairCount = pairResult?.count ?? 0;
					details.tlsAnomaly = { ja4Count, pairCount };

					if (pairCount === 0) {
						// Gradient scoring: higher confidence when more baseline samples exist.
						// With exactly minJa4Observations (5), score 70 (moderate confidence).
						// At 2x observations (10+), score 100 (high confidence).
						const observationRatio = Math.min(ja4Count / minJa4Observations, 2);
						// Map ratio [1.0, 2.0] to score [70, 100]
						tlsAnomalyScore = Math.round(70 + ((observationRatio - 1) / 1) * 30);
						tlsAnomalyScore = Math.min(100, Math.max(70, tlsAnomalyScore));
						warnings.push(`TLS fingerprint does not match historical samples for this JA4 (${ja4Count} baseline observations)`);
					} else {
						await recordFingerprintBaseline(db, 'tls', tlsFingerprintKey, metadata.ja4, metadata.asn, {
							remoteIp: metadata.remoteIp,
						});
					}
				}
			}
		}

		// ---------------------------------------------------------------------
		// Latency vs. claimed platform
		// ---------------------------------------------------------------------
		const rawRtt = metadata.clientTcpRtt;
		const platform = normalizeHint(metadata.clientHints?.platform);
		const deviceType = metadata.deviceType;
		const mobileClaim = isMobileClaim(metadata, config);
		const datacenterAsns = config.fingerprint.datacenterAsns.map((asn) => Number(asn));
		const suspectAsn = typeof metadata.asn === 'number' ? datacenterAsns.includes(metadata.asn) : false;
		const hasMeasuredRtt = typeof rawRtt === 'number' && rawRtt > 0;
		if (hasMeasuredRtt) {
			const rtt = rawRtt!;
			if (mobileClaim && rtt <= config.fingerprint.latency.mobileRttThresholdMs && (deviceType !== 'mobile' || suspectAsn)) {
				latencyMismatchScore = 80;
				warnings.push(`RTT ${rtt}ms is too low for claimed mobile platform ${platform || 'unknown'} (${deviceType || 'unknown'} device)`);
			}
		}
		details.latency = {
			rtt: hasMeasuredRtt ? rawRtt : undefined,
			platform,
			deviceType,
			claimedMobile: mobileClaim,
			suspectAsn,
		};

		const result: FingerprintSignalsResult = selectTrigger({
			headerFingerprintScore,
			tlsAnomalyScore,
			latencyMismatchScore,
			warnings,
			details,
		});

		if (result.trigger) {
			logger.warn(
				{
					trigger: result.trigger,
					detectionType: result.detectionType,
					warnings: result.warnings,
				},
				'Fingerprint signal detected',
			);
		}

		return result;
	} catch (error) {
		logger.error({ error }, 'Failed to collect fingerprint signals');
		return ZERO_RESULT;
	}
}
