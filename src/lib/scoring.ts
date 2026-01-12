/**
 * Risk Score Normalization Module
 *
 * Implements weighted component system to normalize risk scores to 0-100 scale
 *
 * Component Weights (configurable, defaults sum to 100%):
 * - Token Replay: 28% (instant block, highest priority)
 * - Email Fraud: 14% (pattern detection via markov-mail)
 * - Ephemeral ID: 15% (device tracking, core fraud signal)
 * - Validation Frequency: 10% (attempt rate monitoring)
 * - IP Diversity: 7% (proxy rotation detection)
 * - JA4 Session Hopping: 6% (browser hopping detection)
 * - IP Rate Limit: 7% (browser switching detection)
 * - Header Fingerprint Reuse: 7% (shared header stacks across IPs/JA4s)
 * - TLS Anomaly: 4% (spoofed ClientHello fingerprints)
 * - Latency Mismatch: 2% (impossible RTT/platform combos)
 *
 * All thresholds and weights are configurable via src/lib/config.ts
 * Block Threshold: Default 70/100 (configurable)
 */

import type { FraudDetectionConfig } from './config';

export interface RiskComponent {
	score: number; // 0-100
	weight: number; // 0.0-1.0
	contribution: number; // score * weight
	rawScore?: number; // Original value before normalization
	reason: string; // Human-readable explanation
}

export interface FingerprintDetailSummary {
	headerReuse?: {
		total: number;
		ipCount: number;
		ja4Count: number;
	};
	tlsAnomaly?: {
		ja4Count: number;
		pairCount: number;
	};
	latency?: {
		rtt?: number;
		platform?: string;
		deviceType?: string;
		claimedMobile?: boolean;
		suspectAsn?: boolean;
	};
}

export interface RiskScoreBreakdown {
	tokenReplay: number;
	emailFraud: number;
	ephemeralId: number;
	validationFrequency: number;
	ipDiversity: number;
	ja4SessionHopping: number;
	ipRateLimit: number;
	headerFingerprint: number;
	tlsAnomaly: number;
	latencyMismatch: number;
	total: number;
	components: Record<string, RiskComponent>;
	fingerprintDetails?: FingerprintDetailSummary;
	fingerprintWarnings?: string[];
}

const FORCE_BLOCK_TRIGGERS = new Set(['token_replay', 'turnstile_failed']);
const DETERMINISTIC_TRIGGERS = new Set([
	'ephemeral_id_fraud',
	'validation_frequency',
	'ja4_session_hopping',
	'email_fraud',
	'duplicate_email',
	'repeat_offender',
]);

export function calculateNormalizedRiskScore(
	checks: {
		tokenReplay: boolean;
		emailRiskScore?: number; // 0-100
		ephemeralIdCount: number;
		validationCount: number;
		uniqueIPCount: number;
		ja4RawScore: number; // 0-230
		ipRateLimitScore?: number; // 0-100
		headerFingerprintScore?: number; // 0-100
		tlsAnomalyScore?: number; // 0-100
		latencyMismatchScore?: number; // 0-100
		recentRepeatOffender?: boolean;
		blockTrigger?: 'token_replay' | 'email_fraud' | 'ephemeral_id_fraud' | 'ja4_session_hopping' | 'ip_diversity' | 'validation_frequency' | 'ip_rate_limit' | 'header_fingerprint' | 'tls_anomaly' | 'latency_mismatch' | 'duplicate_email' | 'turnstile_failed' | 'repeat_offender';
	},
	config: FraudDetectionConfig
): RiskScoreBreakdown {
	// Normalize each component
	const components: Record<string, RiskComponent> = {};

	// Token Replay (instant block)
	const tokenWeight = config.risk.weights.tokenReplay;
	components.tokenReplay = {
		score: checks.tokenReplay ? 100 : 0,
		weight: tokenWeight,
		contribution: checks.tokenReplay ? tokenWeight * 100 : 0,
		reason: checks.tokenReplay ? 'Token already used' : 'Token valid',
	};

	// Email Fraud (markov-mail, already 0-100)
	const emailScore = checks.emailRiskScore || 0;
	const emailWeight = config.risk.weights.emailFraud;
	components.emailFraud = {
		score: emailScore,
		weight: emailWeight,
		contribution: emailScore * emailWeight,
		reason:
			emailScore >= config.risk.blockThreshold
				? 'Fraudulent email pattern'
				: emailScore >= config.risk.levels.medium.min
					? 'Suspicious email pattern'
					: 'Email looks legitimate',
	};

	// Ephemeral ID
	const ephemeralScore = normalizeEphemeralIdScore(checks.ephemeralIdCount, config);
	const ephemeralWeight = config.risk.weights.ephemeralId;
	components.ephemeralId = {
		score: ephemeralScore,
		weight: ephemeralWeight,
		contribution: ephemeralScore * ephemeralWeight,
		rawScore: checks.ephemeralIdCount,
		reason:
			checks.ephemeralIdCount >= 3
				? `${checks.ephemeralIdCount} submissions (likely fraud)`
				: checks.ephemeralIdCount === 2
					? '2 submissions (suspicious)'
					: '1 submission (normal)',
	};

	// Validation Frequency
	const validationScore = normalizeValidationScore(checks.validationCount, config);
	const validationWeight = config.risk.weights.validationFrequency;
	components.validationFrequency = {
		score: validationScore,
		weight: validationWeight,
		contribution: validationScore * validationWeight,
		rawScore: checks.validationCount,
		reason:
			checks.validationCount >= config.detection.validationFrequencyBlockThreshold
				? `${checks.validationCount} attempts in 1 hour`
				: checks.validationCount === config.detection.validationFrequencyWarnThreshold
					? '2 attempts (acceptable)'
					: '1 attempt (normal)',
	};

	// IP Diversity
	const ipScore = normalizeIPScore(checks.uniqueIPCount, config);
	const ipWeight = config.risk.weights.ipDiversity;
	components.ipDiversity = {
		score: ipScore,
		weight: ipWeight,
		contribution: ipScore * ipWeight,
		rawScore: checks.uniqueIPCount,
		reason:
			checks.uniqueIPCount >= 3
				? `${checks.uniqueIPCount} IPs (proxy rotation)`
				: checks.uniqueIPCount === config.detection.ipDiversityThreshold
					? '2 IPs (acceptable)'
					: '1 IP (normal)',
	};

	// JA4 Session Hopping
	const ja4Score = normalizeJA4Score(checks.ja4RawScore, config);
	const ja4Weight = config.risk.weights.ja4SessionHopping;
	const ja4Thresholds = config.ja4.scoreThresholds;
	components.ja4SessionHopping = {
		score: ja4Score,
		weight: ja4Weight,
		contribution: ja4Score * ja4Weight,
		rawScore: checks.ja4RawScore,
		reason:
			checks.ja4RawScore >= ja4Thresholds.browserHopping
				? 'Browser hopping detected'
				: checks.ja4RawScore >= ja4Thresholds.suspiciousClustering
					? 'Suspicious JA4 clustering'
					: 'Normal browser behavior',
	};

	// IP Rate Limit
	const ipRateLimitScore = checks.ipRateLimitScore || 0; // Already normalized to 0-100
	const ipRateLimitWeight = config.risk.weights.ipRateLimit;
	components.ipRateLimit = {
		score: ipRateLimitScore,
		weight: ipRateLimitWeight,
		contribution: ipRateLimitScore * ipRateLimitWeight,
		reason:
			ipRateLimitScore >= 100
				? 'Extreme submission frequency from IP'
				: ipRateLimitScore >= 75
					? 'High submission frequency from IP'
					: ipRateLimitScore >= 50
						? 'Multiple submissions from IP'
						: ipRateLimitScore >= 25
							? 'Legitimate retry from IP'
					: 'First submission from IP',
	};

	// Header Fingerprint Reuse (0-100 provided by collector)
	const headerFingerprintScore = clampScore(checks.headerFingerprintScore || 0);
	const headerWeight = config.risk.weights.headerFingerprint || 0;
	components.headerFingerprint = {
		score: headerFingerprintScore,
		weight: headerWeight,
		contribution: headerFingerprintScore * headerWeight,
		reason:
			headerFingerprintScore >= config.risk.blockThreshold
				? 'Shared header fingerprint across networks'
				: headerFingerprintScore > 0
					? 'Repeated header fingerprint observed'
					: 'Unique header fingerprint',
	};

	// TLS Anomaly
	const tlsAnomalyScore = clampScore(checks.tlsAnomalyScore || 0);
	const tlsWeight = config.risk.weights.tlsAnomaly || 0;
	components.tlsAnomaly = {
		score: tlsAnomalyScore,
		weight: tlsWeight,
		contribution: tlsAnomalyScore * tlsWeight,
		reason:
			tlsAnomalyScore >= config.risk.blockThreshold
				? 'JA4 presented with spoofed TLS fingerprint'
				: tlsAnomalyScore > 0
					? 'Unexpected TLS fingerprint for this JA4'
					: 'TLS fingerprint matches baseline',
	};

	// Latency / Device mismatch
	const latencyMismatchScore = clampScore(checks.latencyMismatchScore || 0);
	const latencyWeight = config.risk.weights.latencyMismatch || 0;
	components.latencyMismatch = {
		score: latencyMismatchScore,
		weight: latencyWeight,
		contribution: latencyMismatchScore * latencyWeight,
		reason:
			latencyMismatchScore >= config.risk.blockThreshold
				? 'Impossible RTT for claimed platform'
				: latencyMismatchScore > 0
					? 'Suspicious RTT/platform combination'
					: 'RTT consistent with platform',
	};

	// Calculate total (weighted sum, capped at 100)
	let total = 0;

	const isForceBlockTrigger = checks.blockTrigger && FORCE_BLOCK_TRIGGERS.has(checks.blockTrigger);
	const isDeterministicTrigger =
		checks.blockTrigger && DETERMINISTIC_TRIGGERS.has(checks.blockTrigger);

	if (components.tokenReplay.score === 100) {
		// Token replay is instant block
		total = 100;
	} else {
		const baseScore = Object.values(components).reduce((sum, c) => sum + c.contribution, 0);

		// When token replay is not applicable (score=0), re-normalize weights
		// so other components can achieve 100% instead of max 72%
		// This ensures the block threshold (70) is meaningful
		const tokenReplayWeight = config.risk.weights.tokenReplay;
		const isTokenReplayApplicable = components.tokenReplay.score > 0;
		const normalizationFactor = isTokenReplayApplicable ? 1.0 : 1.0 / (1.0 - tokenReplayWeight);
		const normalizedScore = baseScore * normalizationFactor;

		if (isForceBlockTrigger) {
			// Only definitive triggers (token replay / Turnstile failure) may override totals
			const blockThreshold = config.risk.blockThreshold;
			switch (checks.blockTrigger) {
				case 'turnstile_failed':
					total = Math.max(normalizedScore, blockThreshold);
					break;
				default:
					total = Math.max(normalizedScore, blockThreshold);
			}
			total = Math.min(100, Math.round(total * 10) / 10);
		} else if (
			isDeterministicTrigger &&
			config.risk.mode !== 'additive' &&
			qualifiesForDeterministicBlock(checks.blockTrigger!, checks, components, config)
		) {
			const blockThreshold = config.risk.blockThreshold;
			total = Math.max(blockThreshold, normalizedScore);
			total = Math.min(100, Math.round(total * 10) / 10);
		} else {
			total = Math.min(100, Math.round(normalizedScore * 10) / 10);
		}
	}

	return {
		tokenReplay: components.tokenReplay.score,
		emailFraud: components.emailFraud.score,
		ephemeralId: components.ephemeralId.score,
		validationFrequency: components.validationFrequency.score,
		ipDiversity: components.ipDiversity.score,
		ja4SessionHopping: components.ja4SessionHopping.score,
		ipRateLimit: components.ipRateLimit.score,
		headerFingerprint: components.headerFingerprint.score,
		tlsAnomaly: components.tlsAnomaly.score,
		latencyMismatch: components.latencyMismatch.score,
		total,
		components,
	};
}

function clampScore(score: number): number {
	if (Number.isNaN(score)) {
		return 0;
	}
	return Math.max(0, Math.min(100, score));
}

// Normalize ephemeral ID submission count to 0-100
function normalizeEphemeralIdScore(count: number, config: FraudDetectionConfig): number {
	if (count === 0) return 0;
	if (count === 1) return 10; // Baseline
	const threshold = config.detection.ephemeralIdSubmissionThreshold;
	if (count === threshold) return config.risk.blockThreshold; // At threshold
	return 100; // Above threshold = definite fraud
}

// Normalize validation attempts to 0-100
function normalizeValidationScore(count: number, config: FraudDetectionConfig): number {
	if (count === 1) return 0; // Normal
	if (count === config.detection.validationFrequencyWarnThreshold) return 40; // Acceptable retry
	return 100; // At block threshold = aggressive
}

// Normalize IP diversity to 0-100
function normalizeIPScore(count: number, config: FraudDetectionConfig): number {
	if (count === 1) return 0; // Normal
	if (count === config.detection.ipDiversityThreshold) return 50; // Suspicious
	return 100; // Above threshold = proxy rotation
}

// Normalize JA4 composite score (0-230) to 0-100
// Exported for use in ja4-fraud-detection.ts (Phase 2)
export function normalizeJA4Score(rawScore: number, config: FraudDetectionConfig): number {
	if (rawScore === 0) return 0;
	const blockThreshold = config.risk.blockThreshold;
	if (rawScore <= blockThreshold) return rawScore; // Linear below threshold

	// Map blockThreshold-230 to blockThreshold-100 (diminishing returns)
	return Math.round(blockThreshold + ((rawScore - blockThreshold) / (230 - blockThreshold)) * (100 - blockThreshold));
}

function qualifiesForDeterministicBlock(
	trigger: string,
	checks: {
		ephemeralIdCount: number;
		validationCount: number;
		uniqueIPCount: number;
		ja4RawScore: number;
		ipRateLimitScore?: number;
		emailRiskScore?: number;
		recentRepeatOffender?: boolean;
	},
	components: Record<string, RiskComponent>,
	config: FraudDetectionConfig
): boolean {
	switch (trigger) {
		case 'ephemeral_id_fraud':
			return (
				(components.ephemeralId?.score ?? 0) >= config.risk.levels.medium.min &&
				(components.validationFrequency?.score ?? 0) >= config.risk.levels.medium.min
			);
		case 'validation_frequency':
			return (
				(components.validationFrequency?.score ?? 0) >= config.risk.blockThreshold ||
				(components.ephemeralId?.score ?? 0) >= config.risk.blockThreshold
			);
		case 'ja4_session_hopping':
			return (
				(checks.ja4RawScore ?? 0) >= 140 &&
				(checks.ipRateLimitScore ?? 0) >= 25
			);
		case 'email_fraud':
			return (
				(components.emailFraud?.score ?? 0) >= config.risk.blockThreshold &&
				(checks.uniqueIPCount ?? 1) > 1
			);
		case 'duplicate_email':
			return true;
		case 'repeat_offender':
			return !!checks.recentRepeatOffender;
		default:
			return false;
	}
}
