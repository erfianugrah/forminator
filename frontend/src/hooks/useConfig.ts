import { useState, useEffect } from 'react';

/**
 * Fraud Detection Configuration (from backend)
 */
export interface FraudDetectionConfig {
	risk: {
		mode: 'additive' | 'defensive';
		blockThreshold: number;
		levels: {
			low: { min: number; max: number };
			medium: { min: number; max: number };
			high: { min: number; max: number };
		};
		weights: {
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
		};
	};
	ja4: {
		ipsQuantileThreshold: number;
		reqsQuantileThreshold: number;
		heuristicRatioThreshold: number;
		browserRatioThreshold: number;
		h2h3RatioThreshold: number;
		cacheRatioThreshold: number;
		scoreThresholds: {
			browserHopping: number;
			suspiciousClustering: number;
		};
		riskScoreIncrements: {
			clustering: number;
			velocity: number;
			globalAnomaly: number;
			botPattern: number;
		};
	};
	detection: {
		ephemeralIdSubmissionThreshold: number;
		validationFrequencyBlockThreshold: number;
		validationFrequencyWarnThreshold: number;
		ipDiversityThreshold: number;
		ipRateLimitThreshold: number;
		ipRateLimitWindow: number;
		ja4Clustering: {
			ipClusteringThreshold: number;
			rapidGlobalThreshold: number;
			rapidGlobalWindowMinutes: number;
			extendedGlobalThreshold: number;
			extendedGlobalWindowMinutes: number;
			velocityThresholdMinutes: number;
			useRiskScoreThreshold: boolean;
		};
	};
	fingerprint: {
		headerReuse: {
			windowMinutes: number;
			minRequests: number;
			minDistinctIps: number;
			minDistinctJa4: number;
		};
		tlsAnomaly: {
			baselineHours: number;
			minJa4Observations: number;
		};
		latency: {
			mobileRttThresholdMs: number;
			inspectPlatforms: string[];
		};
		datacenterAsns: number[];
	};
	timeouts: {
		schedule: number[];
		maximum: number;
	};
}

/**
 * Default configuration (fallback if API fails)
 * Matches backend defaults
 */
const DEFAULT_CONFIG: FraudDetectionConfig = {
	risk: {
		mode: 'defensive',
		blockThreshold: 70,
		levels: {
			low: { min: 0, max: 39 },
			medium: { min: 40, max: 69 },
			high: { min: 70, max: 100 },
		},
		weights: {
			tokenReplay: 0.28,
			emailFraud: 0.14,
			ephemeralId: 0.15,
			validationFrequency: 0.1,
			ipDiversity: 0.07,
			ja4SessionHopping: 0.06,
			ipRateLimit: 0.07,
			headerFingerprint: 0.07,
			tlsAnomaly: 0.04,
			latencyMismatch: 0.02,
		},
	},
	ja4: {
		ipsQuantileThreshold: 0.95,
		reqsQuantileThreshold: 0.99,
		heuristicRatioThreshold: 0.8,
		browserRatioThreshold: 0.2,
		h2h3RatioThreshold: 0.9,
		cacheRatioThreshold: 0.5,
		scoreThresholds: {
			browserHopping: 140,
			suspiciousClustering: 80,
		},
		riskScoreIncrements: {
			clustering: 80,
			velocity: 60,
			globalAnomaly: 50,
			botPattern: 40,
		},
	},
	detection: {
		ephemeralIdSubmissionThreshold: 2,
		validationFrequencyBlockThreshold: 3,
		validationFrequencyWarnThreshold: 2,
		ipDiversityThreshold: 2,
		ipRateLimitThreshold: 3,
		ipRateLimitWindow: 3600,
		ja4Clustering: {
			ipClusteringThreshold: 2,
			rapidGlobalThreshold: 3,
			rapidGlobalWindowMinutes: 5,
			extendedGlobalThreshold: 5,
			extendedGlobalWindowMinutes: 60,
			velocityThresholdMinutes: 10,
			useRiskScoreThreshold: true,
		},
	},
	fingerprint: {
		headerReuse: {
			windowMinutes: 60,
			minRequests: 3,
			minDistinctIps: 2,
			minDistinctJa4: 2,
		},
		tlsAnomaly: {
			baselineHours: 24,
			minJa4Observations: 5,
		},
		latency: {
			mobileRttThresholdMs: 6,
			inspectPlatforms: ['Android', 'iOS'],
		},
		datacenterAsns: [16509, 14618, 8075, 15169, 13335, 9009, 61317, 49544],
	},
	timeouts: {
		schedule: [3600, 14400, 28800, 43200, 86400],
		maximum: 86400,
	},
};

/**
 * Recursively merge source into target, preserving defaults for missing keys.
 * Only plain objects are merged; arrays and primitives from source win outright.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
	if (source === null || source === undefined) return target;
	if (typeof source !== 'object' || Array.isArray(source)) return source;
	if (typeof target !== 'object' || target === null || Array.isArray(target)) return source;

	const result = { ...target };
	for (const key of Object.keys(source)) {
		result[key] = deepMerge(target[key], source[key]);
	}
	return result;
}

/**
 * React hook to fetch fraud detection configuration
 * Returns config with loading and error states
 */
export function useConfig(apiKey?: string) {
	const [config, setConfig] = useState<FraudDetectionConfig>(DEFAULT_CONFIG);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		async function fetchConfig() {
			try {
				const headers: Record<string, string> = {};
				if (apiKey) {
					headers['X-API-KEY'] = apiKey;
				}
				const response = await fetch('/api/config', { headers });
				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const json = (await response.json()) as { success: boolean; data?: Partial<FraudDetectionConfig> };
				if (json.success && json.data) {
					// Deep-merge server response into defaults so any fields the backend
					// omits (e.g. unauthenticated path) still have sensible fallbacks
					setConfig((prev) => deepMerge(prev, json.data!) as FraudDetectionConfig);
					setError(null);
				} else {
					throw new Error('Invalid config response format');
				}
			} catch (err) {
				console.error('Failed to fetch config, using defaults:', err);
				setError(err instanceof Error ? err.message : 'Unknown error');
				// Keep using DEFAULT_CONFIG
			} finally {
				setLoading(false);
			}
		}

		fetchConfig();
	}, [apiKey]);

	return { config, loading, error };
}

/**
 * Helper to get risk level classification
 */
export function getRiskLevel(riskScore: number, config: FraudDetectionConfig): 'low' | 'medium' | 'high' {
	const { levels } = config.risk;

	if (riskScore >= levels.high.min) return 'high';
	if (riskScore >= levels.medium.min) return 'medium';
	return 'low';
}

/**
 * Helper to check if score should block
 */
export function shouldBlock(riskScore: number, config: FraudDetectionConfig): boolean {
	return riskScore >= config.risk.blockThreshold;
}
