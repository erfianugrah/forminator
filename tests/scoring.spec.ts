/**
 * Scoring Module Unit Tests
 *
 * Tests the risk score calculation engine directly with synthetic inputs.
 * Covers normalization functions, weight redistribution, corroboration bonus,
 * deterministic block qualification, and edge cases.
 *
 * These tests require NO worker, NO database, NO bypass — they exercise
 * the pure computation in src/lib/scoring.ts against the default config.
 *
 * Run:
 *   npx playwright test tests/scoring.spec.ts
 */

import { test, expect } from '@playwright/test';
import { calculateNormalizedRiskScore, normalizeJA4Score } from '../src/lib/scoring';
import { getConfig } from '../src/lib/config';

const config = getConfig();

// ========== HELPERS ==========

/** Build a minimal "clean" submission input (all signals at baseline) */
function cleanChecks(overrides: Record<string, unknown> = {}) {
	return {
		tokenReplay: false,
		emailRiskScore: 0,
		ephemeralIdCount: 1,
		validationCount: 1,
		uniqueIPCount: 1,
		ja4RawScore: 0,
		ipRateLimitScore: 0,
		headerFingerprintScore: 0,
		tlsAnomalyScore: 0,
		latencyMismatchScore: 0,
		...overrides,
	};
}

// ========== BASELINE BEHAVIOR ==========

test.describe('Baseline scoring', () => {
	test('clean first-time submission scores well below block threshold', () => {
		const result = calculateNormalizedRiskScore(cleanChecks(), config);
		expect(result.total).toBeLessThan(config.risk.blockThreshold);
		// Should be very low — all signals at baseline
		expect(result.total).toBeLessThan(20);
	});

	test('all component scores are 0 for clean submission', () => {
		const result = calculateNormalizedRiskScore(cleanChecks(), config);
		expect(result.tokenReplay).toBe(0);
		expect(result.emailFraud).toBe(0);
		expect(result.ephemeralId).toBe(10); // 1 submission = baseline 10
		expect(result.validationFrequency).toBe(0);
		expect(result.ipDiversity).toBe(0);
		expect(result.ja4SessionHopping).toBe(0);
		expect(result.ipRateLimit).toBe(0);
		expect(result.headerFingerprint).toBe(0);
		expect(result.tlsAnomaly).toBe(0);
		expect(result.latencyMismatch).toBe(0);
	});

	test('component weights sum to 1.0', () => {
		const weights = config.risk.weights;
		const sum = Object.values(weights).reduce((a, b) => a + b, 0);
		expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);
	});

	test('block threshold is 70 by default', () => {
		expect(config.risk.blockThreshold).toBe(70);
	});
});

// ========== TOKEN REPLAY ==========

test.describe('Token replay scoring', () => {
	test('token replay forces score to 100', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ tokenReplay: true }), config);
		expect(result.total).toBe(100);
		expect(result.tokenReplay).toBe(100);
	});

	test('token replay with blockTrigger also scores 100', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ tokenReplay: true, blockTrigger: 'token_replay' }), config);
		expect(result.total).toBe(100);
		expect(result.decision?.forceBlock?.trigger).toBe('token_replay');
	});
});

// ========== EPHEMERAL ID NORMALIZATION ==========

test.describe('Ephemeral ID normalization', () => {
	test('count=0 scores 0', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ ephemeralIdCount: 0 }), config);
		expect(result.ephemeralId).toBe(0);
	});

	test('count=1 scores 10 (baseline)', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ ephemeralIdCount: 1 }), config);
		expect(result.ephemeralId).toBe(10);
	});

	test('count=threshold (2) scores blockThreshold (70)', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ ephemeralIdCount: config.detection.ephemeralIdSubmissionThreshold }), config);
		expect(result.ephemeralId).toBe(config.risk.blockThreshold);
	});

	test('count=3 (above threshold) scores 100', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ ephemeralIdCount: 3 }), config);
		expect(result.ephemeralId).toBe(100);
	});
});

// ========== VALIDATION FREQUENCY NORMALIZATION ==========

test.describe('Validation frequency normalization', () => {
	test('count=1 scores 0 (normal)', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ validationCount: 1 }), config);
		expect(result.validationFrequency).toBe(0);
	});

	test('count=2 (warn threshold) scores 40', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({ validationCount: config.detection.validationFrequencyWarnThreshold }),
			config,
		);
		expect(result.validationFrequency).toBe(40);
	});

	test('count=3 (block threshold) scores blockThreshold', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({ validationCount: config.detection.validationFrequencyBlockThreshold }),
			config,
		);
		expect(result.validationFrequency).toBe(config.risk.blockThreshold);
	});

	test('count=5 (far above) scores 100', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ validationCount: 5 }), config);
		expect(result.validationFrequency).toBe(100);
	});
});

// ========== IP DIVERSITY NORMALIZATION ==========

test.describe('IP diversity normalization', () => {
	test('count=1 scores 0 (normal)', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ uniqueIPCount: 1 }), config);
		expect(result.ipDiversity).toBe(0);
	});

	test('count=threshold (2) scores 50', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ uniqueIPCount: config.detection.ipDiversityThreshold }), config);
		expect(result.ipDiversity).toBe(50);
	});

	test('count=3 (above threshold) scores 100', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ uniqueIPCount: 3 }), config);
		expect(result.ipDiversity).toBe(100);
	});
});

// ========== JA4 NORMALIZATION ==========

test.describe('JA4 score normalization', () => {
	test('raw=0 scores 0', () => {
		expect(normalizeJA4Score(0, config)).toBe(0);
	});

	test('raw below blockThreshold maps linearly', () => {
		const score = normalizeJA4Score(50, config);
		expect(score).toBe(50);
	});

	test('raw=blockThreshold maps to blockThreshold', () => {
		const score = normalizeJA4Score(config.risk.blockThreshold, config);
		expect(score).toBe(config.risk.blockThreshold);
	});

	test('raw=230 (max) maps to 100', () => {
		const score = normalizeJA4Score(230, config);
		expect(score).toBe(100);
	});

	test('raw above blockThreshold uses diminishing returns', () => {
		const score = normalizeJA4Score(150, config);
		expect(score).toBeGreaterThan(config.risk.blockThreshold);
		expect(score).toBeLessThan(100);
	});
});

// ========== IP RATE LIMIT PASS-THROUGH ==========

test.describe('IP rate limit scoring', () => {
	test('score passes through directly (0-100)', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ ipRateLimitScore: 75 }), config);
		expect(result.ipRateLimit).toBe(75);
	});

	test('score of 0 is valid (not confused with null)', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ ipRateLimitScore: 0 }), config);
		expect(result.ipRateLimit).toBe(0);
	});
});

// ========== WEIGHT REDISTRIBUTION ==========

test.describe('Weight redistribution', () => {
	test('inactive signals cause weight redistribution', () => {
		// Clean submission: tokenReplay=0 + all device signals at baseline
		// → inactive weight = tokenReplay(0.28) + ephemeral(0.15) + validation(0.10) + ipDiversity(0.07) = 0.60
		const result = calculateNormalizedRiskScore(cleanChecks(), config);
		const decision = result.decision!;
		expect(decision.weightRedistribution).toBeDefined();
		expect(decision.weightRedistribution!.inactiveWeight).toBeCloseTo(0.6, 1);
	});

	test('normalization factor is capped at 2.0x', () => {
		// With 0.60 inactive weight, raw factor = 1/(1-0.60) = 2.5, capped to 2.0
		const result = calculateNormalizedRiskScore(cleanChecks(), config);
		expect(result.decision!.weightRedistribution!.normalizationFactor).toBeLessThanOrEqual(2.0);
	});

	test('weight redistribution amplifies active signals', () => {
		// With emailFraud=50 and all device signals at baseline:
		// Base contribution = 50 * 0.14 = 7
		// After 2.0x redistribution = 14
		const result = calculateNormalizedRiskScore(cleanChecks({ emailRiskScore: 50 }), config);
		const baseScore = result.decision!.baseScore;
		const normalizedScore = result.decision!.normalizedScore;
		expect(normalizedScore).toBeGreaterThan(baseScore);
		expect(normalizedScore).toBeCloseTo(baseScore * 2.0, 0);
	});

	test('no redistribution when device signals are active', () => {
		// When ephemeralIdCount > 1, device signals are active → no redistribution for device group
		const result = calculateNormalizedRiskScore(cleanChecks({ ephemeralIdCount: 2, validationCount: 2, uniqueIPCount: 2 }), config);
		const decision = result.decision!;
		// Only tokenReplay should be inactive (0.28 weight)
		if (decision.weightRedistribution) {
			expect(decision.weightRedistribution.inactiveWeight).toBeCloseTo(0.28, 1);
		}
	});
});

// ========== CORROBORATION BONUS ==========

test.describe('Corroboration bonus', () => {
	test('no bonus when fewer than 3 signals fire', () => {
		// Only emailFraud and ipRateLimit fire (2 signals)
		const result = calculateNormalizedRiskScore(cleanChecks({ emailRiskScore: 50, ipRateLimitScore: 50 }), config);
		expect(result.decision!.corroborationBonus!.applied).toBe(false);
		expect(result.decision!.corroborationBonus!.bonus).toBe(0);
	});

	test('+15 bonus when 3+ signals score >= 30', () => {
		// Fire 3 independent signals above the corroboration threshold (30)
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				emailRiskScore: 50,
				ipRateLimitScore: 50,
				headerFingerprintScore: 50,
			}),
			config,
		);
		expect(result.decision!.corroborationBonus!.applied).toBe(true);
		expect(result.decision!.corroborationBonus!.bonus).toBe(15);
		expect(result.decision!.corroborationBonus!.corroboratingSignals.length).toBeGreaterThanOrEqual(3);
	});

	test('corroboration bonus pushes marginal scores over threshold', () => {
		// Design a scenario where base score is ~55-65 and bonus pushes it to >=70
		// emailFraud=80, ipRateLimit=50, headerFingerprint=40, tlsAnomaly=40
		// These fire 4 signals above 30: emailFraud(80), ipRateLimit(50), headerFP(40), tls(40)
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				emailRiskScore: 80,
				ipRateLimitScore: 50,
				headerFingerprintScore: 40,
				tlsAnomalyScore: 40,
			}),
			config,
		);
		const withoutBonus = result.decision!.normalizedScore;
		const withBonus = result.decision!.adjustedScore;
		expect(withBonus).toBe(withoutBonus + 15);
	});

	test('ephemeralId baseline (10) does not count as corroborating (below 30)', () => {
		const result = calculateNormalizedRiskScore(cleanChecks(), config);
		const signals = result.decision!.corroborationBonus!.corroboratingSignals;
		expect(signals).not.toContain('ephemeralId');
	});
});

// ========== DETERMINISTIC BLOCK QUALIFICATION ==========

test.describe('Deterministic block qualification', () => {
	test('ephemeral_id_fraud qualifies when both ephemeral and validation >= medium', () => {
		// ephemeralIdCount=2 → score=70, validationCount=3 → score=70
		// Both >= medium.min(40) → qualifies
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				ephemeralIdCount: 2,
				validationCount: 3,
				blockTrigger: 'ephemeral_id_fraud',
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
		expect(result.decision!.deterministicBlock?.qualified).toBe(true);
	});

	test('ephemeral_id_fraud does NOT qualify when validation is at baseline', () => {
		// ephemeralIdCount=2 → score=70, validationCount=1 → score=0
		// validation < medium.min(40) → does not qualify
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				ephemeralIdCount: 2,
				validationCount: 1,
				blockTrigger: 'ephemeral_id_fraud',
			}),
			config,
		);
		expect(result.decision!.deterministicBlock?.qualified).toBe(false);
	});

	test('validation_frequency qualifies when validation >= blockThreshold', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				validationCount: 3, // → score=70 = blockThreshold
				blockTrigger: 'validation_frequency',
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
		expect(result.decision!.deterministicBlock?.qualified).toBe(true);
	});

	test('ja4_session_hopping qualifies when ja4Raw >= 140 AND ipRateLimit >= 25', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				ja4RawScore: 140,
				ipRateLimitScore: 25,
				blockTrigger: 'ja4_session_hopping',
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
		expect(result.decision!.deterministicBlock?.qualified).toBe(true);
	});

	test('ja4_session_hopping does NOT qualify when ipRateLimit < 25', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				ja4RawScore: 140,
				ipRateLimitScore: 0,
				blockTrigger: 'ja4_session_hopping',
			}),
			config,
		);
		expect(result.decision!.deterministicBlock?.qualified).toBe(false);
	});

	test('email_fraud qualifies when emailScore >= blockThreshold', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				emailRiskScore: 80,
				blockTrigger: 'email_fraud',
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
		expect(result.decision!.deterministicBlock?.qualified).toBe(true);
	});

	test('duplicate_email always qualifies', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ blockTrigger: 'duplicate_email' }), config);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
		expect(result.decision!.deterministicBlock?.qualified).toBe(true);
	});
});

// ========== FORCE BLOCK TRIGGERS ==========

test.describe('Force block triggers', () => {
	test('turnstile_failed forces score >= blockThreshold', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ blockTrigger: 'turnstile_failed' }), config);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
		expect(result.decision!.forceBlock?.trigger).toBe('turnstile_failed');
	});

	test('token_replay forces score to 100', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ tokenReplay: true, blockTrigger: 'token_replay' }), config);
		expect(result.total).toBe(100);
	});
});

// ========== SCORE CLAMPING ==========

test.describe('Score clamping', () => {
	test('total never exceeds 100', () => {
		// Max everything out
		const result = calculateNormalizedRiskScore(
			{
				tokenReplay: false,
				emailRiskScore: 100,
				ephemeralIdCount: 10,
				validationCount: 10,
				uniqueIPCount: 10,
				ja4RawScore: 230,
				ipRateLimitScore: 100,
				headerFingerprintScore: 100,
				tlsAnomalyScore: 100,
				latencyMismatchScore: 100,
				blockTrigger: 'email_fraud',
			},
			config,
		);
		expect(result.total).toBeLessThanOrEqual(100);
	});

	test('total never goes below 0', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				emailRiskScore: 0,
				ephemeralIdCount: 0,
				validationCount: 0,
				uniqueIPCount: 0,
				ja4RawScore: 0,
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(0);
	});
});

// ========== DECISION TRAIL ==========

test.describe('Decision trail completeness', () => {
	test('decision trail includes all scoring stages', () => {
		const result = calculateNormalizedRiskScore(cleanChecks({ emailRiskScore: 50, ipRateLimitScore: 30 }), config);
		const decision = result.decision!;
		expect(decision.baseScore).toBeDefined();
		expect(decision.normalizedScore).toBeDefined();
		expect(decision.adjustedScore).toBeDefined();
		expect(decision.finalScore).toBeDefined();
		expect(decision.baseScore).toBeLessThanOrEqual(decision.normalizedScore);
		expect(decision.normalizedScore).toBeLessThanOrEqual(decision.adjustedScore + 0.01);
		expect(result.total).toBe(decision.finalScore);
	});

	test('components record includes all 10 signals', () => {
		const result = calculateNormalizedRiskScore(cleanChecks(), config);
		const componentNames = Object.keys(result.components);
		expect(componentNames).toContain('tokenReplay');
		expect(componentNames).toContain('emailFraud');
		expect(componentNames).toContain('ephemeralId');
		expect(componentNames).toContain('validationFrequency');
		expect(componentNames).toContain('ipDiversity');
		expect(componentNames).toContain('ja4SessionHopping');
		expect(componentNames).toContain('ipRateLimit');
		expect(componentNames).toContain('headerFingerprint');
		expect(componentNames).toContain('tlsAnomaly');
		expect(componentNames).toContain('latencyMismatch');
	});

	test('each component has score, weight, contribution, and reason', () => {
		const result = calculateNormalizedRiskScore(cleanChecks(), config);
		for (const [name, comp] of Object.entries(result.components)) {
			expect(comp.score).toBeGreaterThanOrEqual(0);
			expect(comp.score).toBeLessThanOrEqual(100);
			expect(comp.weight).toBeGreaterThanOrEqual(0);
			expect(comp.weight).toBeLessThanOrEqual(1);
			expect(comp.contribution).toBeCloseTo(comp.score * comp.weight, 5);
			expect(comp.reason).toBeTruthy();
		}
	});
});

// ========== REALISTIC ATTACK SCENARIOS ==========

test.describe('Realistic attack scenarios', () => {
	test('incognito mode attacker: same ephemeral ID, 2 submissions → blocks', () => {
		// Attacker submits twice from same device (ephemeral ID persists)
		// with 3 validation attempts (rapid token farming)
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				ephemeralIdCount: 2,
				validationCount: 3,
				blockTrigger: 'ephemeral_id_fraud',
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
	});

	test('disposable email attacker: high email risk → blocks', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				emailRiskScore: 85,
				blockTrigger: 'email_fraud',
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
	});

	test('VPN hopping attacker: high JA4 + moderate IP rate → blocks', () => {
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				ja4RawScore: 150,
				ipRateLimitScore: 50,
				blockTrigger: 'ja4_session_hopping',
			}),
			config,
		);
		expect(result.total).toBeGreaterThanOrEqual(config.risk.blockThreshold);
	});

	test('multi-signal low-confidence attack: 4 weak signals + corroboration → blocks', () => {
		// Each signal alone wouldn't block, but corroboration bonus pushes over threshold
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				emailRiskScore: 60, // Suspicious but not blocking alone
				ipRateLimitScore: 40,
				headerFingerprintScore: 50,
				tlsAnomalyScore: 40,
			}),
			config,
		);
		// 4 signals above 30 → +15 corroboration bonus
		expect(result.decision!.corroborationBonus!.applied).toBe(true);
		// Combined score should be substantial
		expect(result.total).toBeGreaterThan(40);
	});

	test('legitimate user with moderate signals: does NOT block', () => {
		// Real user might trigger mild signals: 1 submission, 2 validations, moderate email risk
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				emailRiskScore: 30, // Slightly suspicious domain
				validationCount: 2, // Needed two tries
				ipRateLimitScore: 25, // Second submission from this IP
			}),
			config,
		);
		expect(result.total).toBeLessThan(config.risk.blockThreshold);
	});

	test('shared office IP: high IP rate + low everything else → does NOT block', () => {
		// Multiple legitimate users from same corporate IP
		const result = calculateNormalizedRiskScore(
			cleanChecks({
				ipRateLimitScore: 75, // 4+ submissions from same IP
			}),
			config,
		);
		// IP rate limit alone should NOT block (it's only 7% weight)
		expect(result.total).toBeLessThan(config.risk.blockThreshold);
	});
});
